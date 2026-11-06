import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  FAUCET_USDC_TESTNET,
  RAMPA_SIMULADA,
  cotizarRampaSimulada,
  estadoRampaDePollar,
  paisRampa,
  qrRampaSimulada,
  rampaTerminada,
  unidadesAUsdc,
  usdcAUnidades,
  type EstadoRampa,
  type SentidoRampa,
} from '@cryptoville/shared';
import { Keypair } from '@stellar/stellar-sdk';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { MONTO_USDC } from '../common/montos';
import { SesionGuard } from '../common/sesion.guard';
import { serializar } from '../common/serializar';
import { UsuarioActual } from '../common/usuario-actual';
import { CONFIGURACION, proveedorRampa, type Configuracion } from '../config/configuracion';
import type { Rampa, Usuario } from '../generated/prisma/client';
import { KycService } from '../kyc/kyc.module';
import { PrismaService } from '../prisma/prisma.service';
import { arg } from '../stellar/cadena';
import { StellarService } from '../stellar/stellar.service';
import { esWalletDe } from '../wallets/wallets.module';

const DIRECCION = /^G[A-Z2-7]{55}$/;

/** Dónde buscar la caja en tu PC si no está RAMPA_CAJA_LLAVE: la de los datos de prueba (npm run datos:prueba). */
export const RUTAS_PRUEBA_KEYS = [path.resolve(__dirname, '../../../../.prueba-keys.json'), '/app/.prueba-keys.json'];

/** Cada cuánto se revisa el saldo de la caja (además de después de cada recarga). */
const REVISAR_CAJA_MS = 15 * 60_000;

/** Lo último que se supo del saldo de la caja (lo muestra /api/health). */
export interface EstadoCaja {
  direccion: string;
  saldo_usdc: string | null;
  /** true: tiene menos que RAMPA_CAJA_MINIMO y hay que llenarla en el faucet. */
  baja: boolean | null;
  revisada_en: string | null;
}

class CotizacionDto {
  @IsIn(['entrada', 'salida'])
  sentido: SentidoRampa;

  @Matches(MONTO_USDC, { message: 'Monto inválido (USDC mayor que 0, hasta 7 decimales)' })
  monto_usdc: string;
}

class EntradaDto {
  @Matches(MONTO_USDC, { message: 'Monto inválido (USDC mayor que 0, hasta 7 decimales)' })
  monto_usdc: string;

  /** Wallet de la cuenta que recibe el USDC (la misma con la que después se paga). */
  @Matches(DIRECCION, { message: 'La dirección debe empezar con G y tener 56 caracteres' })
  direccion: string;

  /** Pedido que se quiere pagar con esta recarga (opcional). */
  @IsOptional()
  @IsUUID('4')
  pedido_id?: string;
}

class SalidaDto {
  @Matches(MONTO_USDC, { message: 'Monto inválido (USDC mayor que 0, hasta 7 decimales)' })
  monto_usdc: string;

  /** Wallet de la cuenta que manda el USDC. */
  @Matches(DIRECCION, { message: 'La dirección debe empezar con G y tener 56 caracteres' })
  direccion: string;

  @IsString()
  @Length(3, 80)
  banco: string;

  /** Número de cuenta: solo se guardan los últimos 4 dígitos. */
  @Matches(/^[0-9]{6,20}$/, { message: 'El número de cuenta son solo números (de 6 a 20)' })
  cuenta: string;
}

/** Monto en la moneda local como lo da el proveedor (se guarda con 2 decimales). */
const MONTO_LOCAL = /^(?!0+(\.0+)?$)\d{1,14}(\.\d{1,8})?$/;
/** Estado de una orden de Pollar (`RampOrder.state`): created, awaiting_payment, processing… */
const ESTADO_POLLAR = /^[a-z_]{3,40}$/;

class OrdenPollarDto {
  /** Id de la orden de Pollar (`RampOrder.id`). Se guarda como la referencia de la operación. */
  @Matches(/^[A-Za-z0-9_-]{6,80}$/, { message: 'Id de orden de Pollar inválido' })
  orden_id: string;

  /** Por ahora solo recargas: el retiro al banco con Pollar llega en el PR del retiro. */
  @IsIn(['entrada'])
  sentido: SentidoRampa;

  @Matches(DIRECCION, { message: 'La dirección debe empezar con G y tener 56 caracteres' })
  direccion: string;

  @Matches(/^[A-Z]{2}$/, { message: 'País inválido (2 letras)' })
  pais: string;

  @Matches(/^[A-Z]{3}$/, { message: 'Moneda inválida (3 letras)' })
  moneda: string;

  /** USDC que la cotización dice que llegan (el de verdad se lee en la red al completarse). */
  @Matches(MONTO_USDC, { message: 'Monto inválido (USDC mayor que 0, hasta 7 decimales)' })
  monto_usdc: string;

  /** Lo que paga la persona en su moneda. */
  @Matches(MONTO_LOCAL, { message: 'Monto en moneda local inválido' })
  monto_local: string;

  @IsOptional()
  @Matches(/^\d{1,14}(\.\d{1,8})?$/, { message: 'Comisión inválida' })
  comision_local?: string;

  @Matches(ESTADO_POLLAR, { message: 'Estado de la orden inválido' })
  estado: string;

  @IsOptional()
  @IsISO8601()
  expira_en?: string;

  @IsOptional()
  @IsUUID('4')
  pedido_id?: string;
}

class EstadoPollarDto {
  @Matches(ESTADO_POLLAR, { message: 'Estado de la orden inválido' })
  estado: string;

  /** Al completarse: la transacción con la que llegó el USDC (el último tramo de la orden). */
  @IsOptional()
  @Matches(/^[0-9a-f]{64}$/, { message: 'El hash de la transacción son 64 caracteres hexadecimales' })
  tx_hash?: string;
}

/**
 * Rampas: bolivianos → USDC («pagar con el QR del banco») y USDC → cuenta del banco («pasar a mi banco»).
 * La rampa se elige con RAMPA_PROVEEDOR (`simulada`, `pollar` o `ninguna`).
 *
 * WorkVille no recibe ni guarda dinero. Con Pollar el cambio lo hace su proveedor (con su SDK, desde el navegador
 * y con la sesión de la persona). En testnet la rampa puede ser SIMULADA: el QR es de mentira y, al tocar
 * «Simular el pago desde el banco», la API manda USDC de testnet desde una wallet «caja» que se llena en el
 * faucet de Circle; los retiros vuelven a esa caja. Los estados son los de una orden de Pollar (EstadoRampa).
 * Lo simulado y lo que falta revisar está en docs/simulaciones.md.
 */
@Injectable()
export class RampasService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Rampas');
  private temporizador: NodeJS.Timeout | null = null;
  private caja: EstadoCaja | null = null;
  private yaAvisoCajaBaja = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
    private readonly kyc: KycService,
    @Inject(CONFIGURACION) private readonly config: Configuracion,
  ) {}

  onModuleInit(): void {
    if (!this.config.rampaSimulada || this.config.entorno === 'test') return;
    void this.revisarCaja();
    this.temporizador = setInterval(() => void this.revisarCaja(), REVISAR_CAJA_MS);
    this.temporizador.unref();
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  get proveedor() {
    return proveedorRampa(this.config);
  }

  private exigirSimulada(): void {
    if (!this.config.rampaSimulada) {
      throw new ServiceUnavailableException(
        this.proveedor === 'pollar' ? 'Esta operación se hace con tu cuenta de Pollar, desde la app' : 'El pago con el QR del banco todavía no está disponible en este servidor',
      );
    }
  }

  private exigirPollar(): void {
    if (this.proveedor !== 'pollar') throw new ServiceUnavailableException('La rampa con Pollar no está encendida en este servidor');
  }

  private validarMonto(monto: string): void {
    const n = Number(monto);
    if (n < RAMPA_SIMULADA.minimoUsdc || n > RAMPA_SIMULADA.maximoUsdc) {
      throw new BadRequestException(`El monto va de ${RAMPA_SIMULADA.minimoUsdc} a ${RAMPA_SIMULADA.maximoUsdc} USDC por operación`);
    }
  }

  /** Llave de la wallet caja: RAMPA_CAJA_LLAVE o, en tu PC, la caja de .prueba-keys.json. */
  private llaveCaja(): string {
    const delEnv = this.config.rampaSimulada?.llaveCaja;
    if (delEnv) return delEnv;
    for (const ruta of RUTAS_PRUEBA_KEYS) {
      if (!existsSync(ruta)) continue;
      try {
        const llave = (JSON.parse(readFileSync(ruta, 'utf8')) as { extra?: { caja?: { secreta?: string } } }).extra?.caja?.secreta;
        if (llave && /^S[A-Z2-7]{55}$/.test(llave)) return llave;
      } catch {
        // Un archivo que no se puede leer no sirve.
      }
    }
    throw new ServiceUnavailableException('La rampa simulada no tiene la llave de la caja (RAMPA_CAJA_LLAVE o la caja de .prueba-keys.json)');
  }

  /** La wallet caja: manda el USDC de las recargas y recibe el de los retiros (hace de rampa). */
  private direccionCaja(): string {
    return Keypair.fromSecret(this.llaveCaja()).publicKey();
  }

  /** Lo último que se supo de la caja (null si no hay rampa simulada o todavía no se revisó). */
  estadoCaja(): EstadoCaja | null {
    return this.caja;
  }

  /** Lee el saldo de la caja y avisa en el registro si bajó de RAMPA_CAJA_MINIMO (una vez, hasta que se llene). */
  async revisarCaja(): Promise<EstadoCaja | null> {
    const simulada = this.config.rampaSimulada;
    if (!simulada) return null;
    let direccion: string;
    try {
      direccion = this.direccionCaja();
    } catch (e) {
      this.log.warn((e as Error).message);
      return null;
    }
    try {
      const saldo = await this.stellar.saldoDe(direccion);
      const baja = saldo < BigInt(usdcAUnidades(String(simulada.minimoCajaUsdc)));
      this.caja = { direccion, saldo_usdc: unidadesAUsdc(saldo), baja, revisada_en: new Date().toISOString() };
      if (baja && !this.yaAvisoCajaBaja) {
        this.log.warn(
          `La caja de la rampa simulada tiene ${this.caja.saldo_usdc} USDC (mínimo ${simulada.minimoCajaUsdc}). ` +
            `Llénala en ${FAUCET_USDC_TESTNET} (red Stellar, Testnet): ${direccion}`,
        );
      }
      this.yaAvisoCajaBaja = baja;
    } catch (e) {
      this.log.warn(`No se pudo leer el saldo de la caja: ${String((e as Error).message).slice(0, 200)}`);
      this.caja = { direccion, saldo_usdc: null, baja: null, revisada_en: new Date().toISOString() };
    }
    return this.caja;
  }

  /** Antes de mandar desde la caja: tiene que existir, aceptar el USDC y tener el monto. Si no, el problema no es de la persona. */
  private async exigirCajaCon(unidades: bigint): Promise<string> {
    const caja = this.direccionCaja();
    try {
      await this.stellar.cuenta(caja);
    } catch (e) {
      if (e instanceof BadRequestException) {
        throw new ServiceUnavailableException('La wallet caja de la rampa simulada no existe en la red: revisa RAMPA_CAJA_LLAVE (docs/simulaciones.md)');
      }
      throw e;
    }
    const saldo = await this.stellar.saldoDe(caja);
    if (saldo < unidades) {
      void this.revisarCaja();
      throw new ServiceUnavailableException(
        `La rampa simulada se quedó sin USDC (la caja tiene ${unidadesAUsdc(saldo)}). Avisa al equipo de WorkVille para que la llene en el faucet de Circle.`,
      );
    }
    return caja;
  }

  cotizar(sentido: SentidoRampa, monto: string) {
    this.exigirSimulada();
    this.validarMonto(monto);
    return { proveedor: 'simulada' as const, ...cotizarRampaSimulada(sentido, monto) };
  }

  /**
   * Saldo de USDC de una wallet de la cuenta (null si no se pudo leer la red).
   * `trustline` dice si la wallet ya acepta el USDC (false: hay que activarlo; null: no se pudo saber).
   * Sin trustline el saldo es 0: el SAC del USDC de Circle no responde el saldo de una cuenta sin trustline.
   */
  async saldo(yo: Usuario, direccion?: string): Promise<{ direccion: string; saldo_usdc: string | null; trustline: boolean | null }> {
    const dir = direccion ?? yo.direccion;
    if (!(await esWalletDe(this.prisma, yo, dir))) throw new ForbiddenException('Esa wallet no es de tu cuenta');
    const tokenId = this.config.stellar.tokenId;
    if (!tokenId || this.config.entorno === 'test') return { direccion: dir, saldo_usdc: null, trustline: null };
    try {
      if (!(await this.stellar.tieneTrustline(dir))) return { direccion: dir, saldo_usdc: '0', trustline: false };
      const valor = await this.stellar.leer(tokenId, 'balance', [arg.direccion(dir)]);
      return { direccion: dir, saldo_usdc: unidadesAUsdc(BigInt((valor as bigint | number | null) ?? 0)), trustline: true };
    } catch {
      return { direccion: dir, saldo_usdc: null, trustline: null };
    }
  }

  private referencia(): string {
    return `CV-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private vence(): Date {
    return new Date(Date.now() + RAMPA_SIMULADA.minutosVigencia * 60_000);
  }

  private async propia(yo: Usuario, id: string): Promise<Rampa> {
    const r = await this.prisma.rampa.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('No existe esa operación');
    if (r.usuario_id !== yo.id) throw new ForbiddenException('Esa operación no es tuya');
    return r;
  }

  /** La wallet que recibe es de la cuenta y, si la recarga es para un pedido, la persona es su cliente. */
  private async exigirRecargaPropia(yo: Usuario, direccion: string, pedidoId?: string): Promise<void> {
    if (!(await esWalletDe(this.prisma, yo, direccion))) throw new ForbiddenException('Esa wallet no es de tu cuenta');
    if (pedidoId) {
      const pedido = await this.prisma.pedido.findUnique({ where: { id: pedidoId }, select: { cliente_id: true } });
      if (!pedido || pedido.cliente_id !== yo.id) throw new ForbiddenException('Solo el cliente del pedido puede recargar para pagarlo');
    }
  }

  /** Recarga: la persona ve un QR con el monto en bolivianos y lo paga desde su banco. */
  async crearEntrada(yo: Usuario, dto: EntradaDto): Promise<Rampa> {
    this.exigirSimulada();
    this.validarMonto(dto.monto_usdc);
    await this.exigirRecargaPropia(yo, dto.direccion, dto.pedido_id);
    const c = cotizarRampaSimulada('entrada', dto.monto_usdc);
    const referencia = this.referencia();
    return this.prisma.rampa.create({
      data: {
        usuario_id: yo.id,
        sentido: 'entrada',
        proveedor: 'simulada',
        pais: c.pais,
        moneda: c.moneda,
        monto_usdc: dto.monto_usdc,
        monto_local: c.monto_local,
        tipo_cambio: c.tipo_cambio,
        comision_local: c.comision_local,
        direccion: dto.direccion,
        pedido_id: dto.pedido_id ?? null,
        estado: 'esperando_pago',
        referencia,
        qr_payload: qrRampaSimulada(referencia, c.monto_local, c.moneda),
        expira_en: this.vence(),
      },
    });
  }

  /**
   * SIMULADO: hace como si el banco hubiera pagado el QR. La «rampa» (la wallet caja) manda el USDC de testnet
   * a la wallet de la persona. Con Pollar esto lo hace su proveedor, solo. Los estados siguen a una orden de
   * Pollar: esperando_pago → procesando (el banco pagó) → liquidando (sale el USDC) → completada.
   */
  async simularPagoBancario(yo: Usuario, id: string): Promise<Rampa> {
    this.exigirSimulada();
    const r = await this.propia(yo, id);
    if (r.sentido !== 'entrada') throw new BadRequestException('Esa operación no es una recarga');
    if (r.estado === 'completada') return r;
    if (r.estado === 'procesando' || r.estado === 'liquidando') throw new ConflictException('Esta recarga ya se está procesando');
    if (r.estado !== 'esperando_pago') throw new ConflictException('Esta recarga ya no espera un pago');
    if (r.expira_en < new Date()) {
      await this.prisma.rampa.update({ where: { id }, data: { estado: 'vencida' } });
      throw new BadRequestException('El QR venció: arma otro');
    }
    const unidades = usdcAUnidades(r.monto_usdc.toFixed(7));
    if (this.config.entorno !== 'test') {
      await this.exigirCajaCon(BigInt(unidades));
      await this.stellar.exigirTrustlines([
        { direccion: r.direccion, quien: 'Tu wallet', solucion: 'actívala desde el saldo («Activar USDC») y vuelve a intentar.' },
      ]);
    }
    // Se marca primero: dos clics seguidos no mandan dos veces.
    const marcada = await this.prisma.rampa.updateMany({ where: { id, estado: 'esperando_pago' }, data: { estado: 'procesando' } });
    if (marcada.count !== 1) throw new ConflictException('Esta recarga ya se está procesando');
    try {
      await this.prisma.rampa.update({ where: { id }, data: { estado: 'liquidando' } });
      // En las pruebas automáticas no hay red: un hash de mentira.
      const hash =
        this.config.entorno === 'test'
          ? createHash('sha256').update(`rampa-${id}`).digest('hex')
          : (await this.stellar.pagarDesdeCaja(this.llaveCaja(), r.direccion, unidades)).hash;
      this.log.log(`Recarga simulada ${r.referencia}: ${r.monto_usdc.toString()} USDC desde la caja a ${r.direccion.slice(0, 6)}…`);
      if (this.config.entorno !== 'test') void this.revisarCaja();
      return await this.prisma.rampa.update({ where: { id }, data: { estado: 'completada', tx_hash: hash } });
    } catch (e) {
      // Un 4xx (simulación fallida, transacción rechazada o fallida en la red) no mandó nada: se puede reintentar.
      // Ante un 5xx (sin red o sin confirmar) no se sabe si salió el USDC, así que la recarga queda fallida.
      const sinMandar = e instanceof HttpException && e.getStatus() < 500;
      await this.prisma.rampa.update({ where: { id }, data: { estado: sinMandar ? 'esperando_pago' : 'fallida' } });
      throw e;
    }
  }

  /**
   * Rampa con Pollar: la web ya creó la orden con el SDK de Pollar (con la sesión de la persona) y la registra aquí
   * para el historial y para verificar después el USDC en la red. La misma orden da siempre la misma fila.
   */
  async registrarOrdenPollar(yo: Usuario, dto: OrdenPollarDto): Promise<Rampa> {
    this.exigirPollar();
    const pais = paisRampa(dto.pais);
    if (!pais || !this.config.rampaPaises.includes(pais.pais)) throw new BadRequestException('Ese país no tiene rampa en este servidor');
    if (pais.moneda !== dto.moneda) throw new BadRequestException(`La moneda de ${pais.nombre} es ${pais.moneda}`);
    const existente = await this.prisma.rampa.findUnique({ where: { referencia: dto.orden_id } });
    if (existente) {
      if (existente.usuario_id !== yo.id) throw new ForbiddenException('Esa orden no es tuya');
      return existente;
    }
    await this.exigirRecargaPropia(yo, dto.direccion, dto.pedido_id);
    const local = Number(dto.monto_local);
    // Una orden recién creada no puede estar completa: eso se registra con su transacción (actualizarOrdenPollar).
    const estado = estadoRampaDePollar(dto.estado);
    return this.prisma.rampa.create({
      data: {
        usuario_id: yo.id,
        sentido: 'entrada',
        proveedor: 'pollar',
        pais: pais.pais,
        moneda: pais.moneda,
        monto_usdc: dto.monto_usdc,
        monto_local: local.toFixed(2),
        tipo_cambio: (local / Number(dto.monto_usdc)).toFixed(6),
        comision_local: Number(dto.comision_local ?? 0).toFixed(2),
        direccion: dto.direccion,
        pedido_id: dto.pedido_id ?? null,
        estado: estado === 'completada' ? 'liquidando' : estado,
        referencia: dto.orden_id,
        expira_en: dto.expira_en ? new Date(dto.expira_en) : new Date(Date.now() + 60 * 60_000),
      },
    });
  }

  /**
   * La web sigue la orden con el SDK de Pollar y avisa cada cambio de estado. Un estado final no cambia más.
   * «Completada» necesita la transacción con la que llegó el USDC: la API la lee en la red y guarda lo que de
   * verdad llegó a la wallet (no lo que dice la orden).
   */
  async actualizarOrdenPollar(yo: Usuario, id: string, dto: EstadoPollarDto): Promise<Rampa> {
    this.exigirPollar();
    const r = await this.propia(yo, id);
    if (r.proveedor !== 'pollar') throw new BadRequestException('Esa operación no es de la rampa con Pollar');
    if (rampaTerminada(r.estado as EstadoRampa)) return r;
    const estado = estadoRampaDePollar(dto.estado);
    if (estado !== 'completada') {
      return r.estado === estado ? r : this.prisma.rampa.update({ where: { id }, data: { estado } });
    }
    if (!dto.tx_hash) throw new BadRequestException('Falta la transacción con la que llegó el USDC');
    const usada = await this.prisma.rampa.findUnique({ where: { tx_hash: dto.tx_hash }, select: { id: true } });
    if (usada && usada.id !== id) throw new ConflictException('Esa transacción ya se registró en otra operación');
    let monto = r.monto_usdc.toFixed(7);
    if (this.stellar.verifica) {
      const unidades = await this.stellar.usdcRecibidoEn(dto.tx_hash, r.direccion);
      if (unidades === 0n) throw new BadRequestException('Esa transacción no mandó USDC a tu wallet');
      monto = unidadesAUsdc(unidades);
    }
    this.log.log(`Recarga con Pollar ${r.referencia}: llegaron ${monto} USDC a ${r.direccion.slice(0, 6)}…`);
    return this.prisma.rampa.update({ where: { id }, data: { estado: 'completada', tx_hash: dto.tx_hash, monto_usdc: monto } });
  }

  /** Retiro: la persona elige banco y cuenta; después firma el envío del USDC a la rampa. */
  async crearSalida(yo: Usuario, dto: SalidaDto): Promise<Rampa> {
    this.exigirSimulada();
    this.kyc.exigir(yo, 'cobrar');
    this.validarMonto(dto.monto_usdc);
    if (!(await esWalletDe(this.prisma, yo, dto.direccion))) throw new ForbiddenException('Esa wallet no es de tu cuenta');
    if (!(RAMPA_SIMULADA.bancos as readonly string[]).includes(dto.banco)) throw new BadRequestException('Elige un banco de la lista');
    const c = cotizarRampaSimulada('salida', dto.monto_usdc);
    return this.prisma.rampa.create({
      data: {
        usuario_id: yo.id,
        sentido: 'salida',
        proveedor: 'simulada',
        pais: c.pais,
        moneda: c.moneda,
        monto_usdc: dto.monto_usdc,
        monto_local: c.monto_local,
        tipo_cambio: c.tipo_cambio,
        comision_local: c.comision_local,
        direccion: dto.direccion,
        // Como una orden de Pollar: la rampa espera el USDC de la persona.
        estado: 'esperando_pago',
        referencia: this.referencia(),
        banco: dto.banco,
        cuenta_final: dto.cuenta.slice(-4),
        expira_en: this.vence(),
      },
    });
  }

  /** Para armar la transferencia del retiro (la firma la persona): a quién y cuánto. */
  async datosParaEnvio(yo: Usuario, id: string, direccion: string): Promise<{ destino: string; unidades: string }> {
    this.exigirSimulada();
    const r = await this.propia(yo, id);
    if (r.sentido !== 'salida' || r.estado !== 'esperando_pago') throw new ConflictException('Este retiro ya no espera un envío');
    if (r.expira_en < new Date()) {
      await this.prisma.rampa.update({ where: { id }, data: { estado: 'vencida' } });
      throw new BadRequestException('Pasó demasiado tiempo: arma el retiro otra vez');
    }
    if (r.direccion !== direccion) throw new BadRequestException('Firma con la misma wallet que elegiste para el retiro');
    // El USDC vuelve a la caja: así la rampa simulada se rellena con los retiros.
    return { destino: this.direccionCaja(), unidades: usdcAUnidades(r.monto_usdc.toFixed(7)) };
  }

  /**
   * El envío del retiro ya está en la red (lo verificó /transacciones/enviar). SIMULADO: el «banco» paga en el acto,
   * así que pasa directo a completada (con Pollar pasaría por procesando mientras el banco paga).
   */
  async registrarEnvio(yo: Usuario, id: string, hash: string): Promise<Rampa> {
    const marcada = await this.prisma.rampa.updateMany({ where: { id, usuario_id: yo.id, estado: 'esperando_pago' }, data: { estado: 'completada', tx_hash: hash } });
    if (marcada.count !== 1) throw new ConflictException('Este retiro ya se registró');
    if (this.config.entorno !== 'test') void this.revisarCaja();
    return this.prisma.rampa.findUniqueOrThrow({ where: { id } });
  }
}

@Controller('rampas')
@UseGuards(SesionGuard)
export class RampasController {
  constructor(private readonly rampas: RampasService) {}

  @Get('saldo')
  async saldo(@UsuarioActual() yo: Usuario, @Query('direccion') direccion?: string) {
    if (direccion && !DIRECCION.test(direccion)) throw new BadRequestException('Dirección inválida');
    return this.rampas.saldo(yo, direccion);
  }

  @Post('cotizacion')
  cotizacion(@Body() dto: CotizacionDto) {
    return this.rampas.cotizar(dto.sentido, dto.monto_usdc);
  }

  @Post('entradas')
  async entrada(@UsuarioActual() yo: Usuario, @Body() dto: EntradaDto) {
    return serializar(await this.rampas.crearEntrada(yo, dto));
  }

  /** SIMULADO (solo testnet): hacer como si el banco hubiera pagado el QR. */
  @Post('entradas/:id/simular-pago')
  @Throttle({ default: { limit: process.env.NODE_ENV === 'test' ? 10_000 : 10, ttl: 60_000 } })
  async simularPago(@UsuarioActual() yo: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return serializar(await this.rampas.simularPagoBancario(yo, id));
  }

  /** Rampa con Pollar: registrar la orden que la web creó con el SDK de Pollar. */
  @Post('pollar/ordenes')
  async ordenPollar(@UsuarioActual() yo: Usuario, @Body() dto: OrdenPollarDto) {
    return serializar(await this.rampas.registrarOrdenPollar(yo, dto));
  }

  /** Rampa con Pollar: un cambio de estado de la orden (al completarse, con la transacción del USDC). */
  @Post('pollar/ordenes/:id/estado')
  @HttpCode(200)
  async estadoPollar(@UsuarioActual() yo: Usuario, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EstadoPollarDto) {
    return serializar(await this.rampas.actualizarOrdenPollar(yo, id, dto));
  }

  @Post('salidas')
  async salida(@UsuarioActual() yo: Usuario, @Body() dto: SalidaDto) {
    return serializar(await this.rampas.crearSalida(yo, dto));
  }
}

@Module({ controllers: [RampasController], providers: [RampasService], exports: [RampasService] })
export class RampasModule {}
