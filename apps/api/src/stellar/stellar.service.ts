import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ERRORES_CONTRATO, PASSPHRASE, activoDeNombreSac, type ActivoClasico } from '@cryptoville/shared';
import { Account, Address, Asset, BASE_FEE, Contract, Keypair, Operation, TransactionBuilder, nativeToScVal, rpc, scValToNative, xdr, type Transaction } from '@stellar/stellar-sdk';
import { CONFIGURACION, type Configuracion } from '../config/configuracion';
import { codigoErrorContrato, contratoOrigenDelError, cuentaSinTrustline, hashDe, transaccionDeXdr } from './cadena';

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type TransaccionConfirmada = rpc.Api.GetSuccessfulTransactionResponse;

/** Error del Stellar Asset Contract cuando la cuenta no tiene trustline del activo. */
const SAC_SIN_TRUSTLINE = 13;

/** Quién tiene que tener la trustline, para el mensaje de error. */
export interface ParteConTrustline {
  direccion: string;
  /** «Tu wallet», «La wallet de cobro del proveedor»… */
  quien: string;
  /** Qué tiene que hacer esa persona (o a quién avisar). */
  solucion: string;
}

/** Errores del contrato v2 que no existen en el v1 (los mismos números del v1 significan lo mismo). */
const ERRORES_EXTRA: Record<number, string> = {
  11: 'El contrato está en pausa: por ahora no se pueden crear pedidos nuevos.',
  12: 'El monto pasa del tope por pedido del contrato.',
  13: 'El plan de fases no es válido (entre 1 y 5 fases, montos mayores que cero y fechas en orden).',
  14: 'Esa fase no existe en el pedido.',
  15: 'Primero tienen que entregarse las fases anteriores.',
  16: 'Ya no se pueden pedir más cambios en esta fase.',
  17: 'No hay una actualización del contrato pendiente.',
  18: 'Todavía no pasaron los días de aviso de la actualización.',
};

/**
 * Lectura de la red de Stellar (RPC de Soroban).
 *
 * - Arma transacciones SIN firmar para que las firme la wallet de la persona.
 * - Envía transacciones YA firmadas y espera la confirmación.
 * - Lee transacciones, eventos y el estado de los contratos para verificar los pagos.
 *
 * El servidor nunca firma por nadie. La única excepción es la llave de mantenimiento
 * (ver `firmarMantenimiento`), que solo ejecuta vencimientos y solo tiene XLM para las comisiones.
 */
@Injectable()
export class StellarService {
  private readonly log = new Logger('Stellar');
  private readonly servidor: rpc.Server;
  /** Activo clásico del token de pago (null si no es un SAC). Se lee una vez de la red. */
  private activo: Promise<ActivoClasico | null> | null = null;

  constructor(@Inject(CONFIGURACION) private readonly config: Configuracion) {
    this.servidor = new rpc.Server(config.stellar.rpcUrl, { allowHttp: config.stellar.rpcUrl.startsWith('http://') });
  }

  get passphrase(): string {
    return PASSPHRASE[this.config.stellar.red];
  }

  /** ¿Se verifican los pasos en la red? (hace falta el RPC y al menos un contrato). */
  get verifica(): boolean {
    const s = this.config.stellar;
    return s.verificar && Boolean(s.contratoId || s.contratoV2Id);
  }

  /** ¿Se verifican en la red los pagos a la plataforma (local extra)? Solo hace falta el RPC. */
  get verificaPagos(): boolean {
    return this.config.stellar.verificar;
  }

  /** ¿Se pueden armar transacciones para firmar en la app? */
  get armaTransacciones(): boolean {
    return Boolean(this.config.stellar.contratoId || this.config.stellar.contratoV2Id) && this.config.entorno !== 'test';
  }

  async cuenta(direccion: string): Promise<Account> {
    try {
      return await this.servidor.getAccount(direccion);
    } catch (e) {
      if (/not found|404/i.test(String((e as Error).message))) {
        throw new BadRequestException(
          this.config.stellar.red === 'testnet'
            ? 'Tu wallet todavía no existe en la red: fondéala con XLM de prueba (Friendbot en Stellar Lab) y vuelve a intentar'
            : 'Tu wallet todavía no existe en la red: necesita un poco de XLM para activarse',
        );
      }
      throw this.sinRed(e);
    }
  }

  /** Arma (y simula) una llamada al contrato para que la firme `fuente`. */
  async preparar(fuente: string, contrato: string, funcion: string, args: xdr.ScVal[]): Promise<{ xdr: string; hash: string }> {
    const cuenta = await this.cuenta(fuente);
    const tx = new TransactionBuilder(cuenta, { fee: BASE_FEE, networkPassphrase: this.passphrase })
      .addOperation(new Contract(contrato).call(funcion, ...args))
      .setTimeout(300)
      .build();
    let preparada: Transaction;
    try {
      preparada = (await this.servidor.prepareTransaction(tx)) as Transaction;
    } catch (e) {
      throw this.errorDeSimulacion(e);
    }
    return { xdr: preparada.toXDR(), hash: hashDe(preparada) };
  }

  /** Envía una transacción firmada y espera a que la red la confirme. */
  async enviar(xdrFirmado: string): Promise<TransaccionConfirmada> {
    let tx: Transaction;
    try {
      tx = transaccionDeXdr(xdrFirmado, this.passphrase);
    } catch {
      throw new BadRequestException('La transacción firmada no se pudo leer');
    }
    let envio: rpc.Api.SendTransactionResponse;
    try {
      envio = await this.servidor.sendTransaction(TransactionBuilder.fromXDR(xdrFirmado, this.passphrase));
    } catch (e) {
      throw this.sinRed(e);
    }
    if (envio.status === 'ERROR') {
      const codigo = envio.errorResult?.result.type ?? 'desconocido';
      throw new BadRequestException(`La red rechazó la transacción (${codigo}). Revisa que tu wallet tenga XLM para la comisión.`);
    }
    if (envio.status === 'TRY_AGAIN_LATER') throw new ServiceUnavailableException('La red está ocupada; intenta de nuevo en unos segundos');
    const r = await this.esperar(hashDe(tx), 30);
    if (r.status === rpc.Api.GetTransactionStatus.SUCCESS) return r;
    if (r.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new BadRequestException(this.textoFallida(r));
    }
    throw new ServiceUnavailableException('La red todavía no confirma la transacción; revisa en unos minutos en «Mis pedidos»');
  }

  /** Busca una transacción por su hash (con algunos reintentos: la red tarda unos segundos en verla). */
  async esperar(hash: string, intentos = 5): Promise<rpc.Api.GetTransactionResponse> {
    let ultima: rpc.Api.GetTransactionResponse | null = null;
    for (let i = 0; i < intentos; i++) {
      try {
        ultima = await this.servidor.getTransaction(hash);
      } catch (e) {
        throw this.sinRed(e);
      }
      if (ultima.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) return ultima;
      if (i < intentos - 1) await espera(1000);
    }
    return ultima!;
  }

  /** Llama a una función de solo lectura del contrato (simulación, sin firmar ni pagar). */
  async leer(contrato: string, funcion: string, args: xdr.ScVal[] = []): Promise<unknown> {
    const fuente = this.config.stellar.arbitro ?? this.config.stellar.tesoreria;
    if (!fuente) throw new ServiceUnavailableException('Falta ARBITRO_DIRECCION para leer el contrato');
    const tx = new TransactionBuilder(new Account(fuente, '0'), { fee: BASE_FEE, networkPassphrase: this.passphrase })
      .addOperation(new Contract(contrato).call(funcion, ...args))
      .setTimeout(60)
      .build();
    let sim: rpc.Api.SimulateTransactionResponse;
    try {
      sim = await this.servidor.simulateTransaction(tx);
    } catch (e) {
      throw this.sinRed(e);
    }
    if (rpc.Api.isSimulationError(sim)) {
      const codigo = codigoErrorContrato(sim.error);
      if (codigo === 2) return null; // PedidoNoExiste
      throw this.errorDeSimulacion(new Error(sim.error));
    }
    const valor = (sim as rpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    return valor ? scValToNative(valor) : null;
  }

  async eventos(contrato: string, desde: { cursor: string } | { ledger: number }, limite = 100) {
    const filtros: rpc.Api.EventFilter[] = [{ type: 'contract', contractIds: [contrato] }];
    const pedido: rpc.Api.GetEventsRequest =
      'cursor' in desde ? { filters: filtros, cursor: desde.cursor, limit: limite } : { filters: filtros, startLedger: desde.ledger, limit: limite };
    return this.servidor.getEvents(pedido);
  }

  async ultimoLedger(): Promise<number> {
    return (await this.servidor.getLatestLedger()).sequence;
  }

  /**
   * Activo clásico detrás del token de pago, leído de su name() («USDC:G…»). Null si el token no es un SAC
   * (el «USDC de prueba» propio no usa trustlines). Si la red no responde, se vuelve a intentar la próxima vez.
   */
  activoDelToken(): Promise<ActivoClasico | null> {
    const { tokenId } = this.config.stellar;
    if (!tokenId) return Promise.resolve(null);
    this.activo ??= this.leer(tokenId, 'name').then(activoDeNombreSac, (e: unknown) => {
      this.activo = null;
      throw e;
    });
    return this.activo;
  }

  /** ¿La cuenta puede recibir y mandar el token de pago? (siempre sí si el token no es un SAC o si es el emisor). */
  async tieneTrustline(direccion: string): Promise<boolean> {
    const activo = await this.activoDelToken();
    if (!activo || direccion === activo.emisor) return true;
    const clave = xdr.LedgerKey.trustline(
      new xdr.LedgerKeyTrustLine({
        accountId: Keypair.fromPublicKey(direccion).xdrAccountId(),
        asset: new Asset(activo.codigo, activo.emisor).toTrustLineXDRObject(),
      }),
    );
    try {
      return (await this.servidor.getLedgerEntries(clave)).entries.length > 0;
    } catch (e) {
      throw this.sinRed(e);
    }
  }

  /** Antes de armar un pago: cada parte que manda o recibe el token tiene que tener la trustline. */
  async exigirTrustlines(partes: ParteConTrustline[]): Promise<void> {
    const activo = await this.activoDelToken();
    if (!activo) return;
    for (const p of partes) {
      if (!(await this.tieneTrustline(p.direccion))) {
        throw new BadRequestException(`${p.quien} todavía no acepta ${activo.codigo} (le falta la trustline): ${p.solucion}`);
      }
    }
  }

  /** Arma (sin firmar) la operación que abre la trustline del token de pago en `direccion`. */
  async prepararTrustline(direccion: string): Promise<{ xdr: string; activo: ActivoClasico }> {
    const activo = await this.activoDelToken();
    if (!activo) throw new BadRequestException('El token de pago de este servidor no necesita trustline');
    const tx = new TransactionBuilder(await this.cuenta(direccion), { fee: BASE_FEE, networkPassphrase: this.passphrase })
      .addOperation(Operation.changeTrust({ asset: new Asset(activo.codigo, activo.emisor) }))
      .setTimeout(300)
      .build();
    return { xdr: tx.toXDR(), activo };
  }

  /**
   * Revisa que una transacción firmada sea SOLO la apertura de la trustline del token de pago (sin límite y sin
   * cerrarla) y devuelve la cuenta que la firma. Así `enviar` no se usa para mandar otra cosa a la red.
   */
  async revisarTrustlineFirmada(xdrFirmado: string): Promise<string> {
    const activo = await this.activoDelToken();
    if (!activo) throw new BadRequestException('El token de pago de este servidor no necesita trustline');
    let tx: Transaction;
    try {
      tx = transaccionDeXdr(xdrFirmado, this.passphrase);
    } catch {
      throw new BadRequestException('La transacción firmada no se pudo leer');
    }
    const [op, ...otras] = tx.operations;
    const esLaTrustline =
      otras.length === 0 &&
      op?.type === 'changeTrust' &&
      !op.source &&
      op.line instanceof Asset &&
      op.line.getCode() === activo.codigo &&
      op.line.getIssuer() === activo.emisor &&
      op.limit === '922337203685.4775807';
    if (!esLaTrustline) throw new BadRequestException('Esa transacción no es la activación de USDC que armó WorkVille');
    return tx.source;
  }

  /**
   * Firma y envía con la llave de mantenimiento. SOLO para funciones del contrato v2 que cualquiera puede llamar
   * y que siempre mandan el dinero a quien corresponde (vencimientos y `extender`).
   */
  async firmarMantenimiento(contrato: string, funcion: string, args: xdr.ScVal[]): Promise<TransaccionConfirmada | null> {
    const secreta = this.config.stellar.llaveMantenimiento;
    if (!secreta) return null;
    if (!['cobrar_por_vencimiento', 'reembolsar_por_vencimiento', 'resolver_por_vencimiento', 'extender'].includes(funcion)) {
      throw new Error(`La llave de mantenimiento no puede llamar a "${funcion}"`);
    }
    const par = Keypair.fromSecret(secreta);
    const { xdr: sinFirmar } = await this.preparar(par.publicKey(), contrato, funcion, args);
    const tx = TransactionBuilder.fromXDR(sinFirmar, this.passphrase) as Transaction;
    tx.sign(par);
    return this.enviar(tx.toXDR());
  }

  /**
   * Rampa SIMULADA (solo testnet): manda USDC desde la wallet caja a una wallet, como si una rampa real hubiera
   * recibido los bolivianos. Es la única excepción a «el servidor no firma pagos»: solo puede llamar a `transfer`
   * del token de pago, desde la caja, y solo con la rampa simulada en testnet.
   */
  async pagarDesdeCaja(llaveCaja: string, destino: string, unidades: string): Promise<{ hash: string; confirmada: TransaccionConfirmada }> {
    const { red, tokenId } = this.config.stellar;
    if (red !== 'testnet' || this.config.rampa !== 'simulada') throw new Error('La rampa simulada solo existe en testnet');
    if (!tokenId) throw new ServiceUnavailableException('Falta PAYMENT_TOKEN_ID');
    if (BigInt(unidades) <= 0n) throw new Error('El monto de la caja tiene que ser mayor que 0');
    const par = Keypair.fromSecret(llaveCaja);
    if (par.publicKey() === destino) throw new Error('La caja no se paga a sí misma');
    const args = [new Address(par.publicKey()).toScVal(), new Address(destino).toScVal(), nativeToScVal(BigInt(unidades), { type: 'i128' })];
    const { xdr: sinFirmar } = await this.preparar(par.publicKey(), tokenId, 'transfer', args);
    const tx = TransactionBuilder.fromXDR(sinFirmar, this.passphrase) as Transaction;
    tx.sign(par);
    return { hash: hashDe(tx), confirmada: await this.enviar(tx.toXDR()) };
  }

  /** Saldo del token de pago de una cuenta, en unidades (0 si no tiene la trustline del USDC). */
  async saldoDe(direccion: string): Promise<bigint> {
    const { tokenId } = this.config.stellar;
    if (!tokenId) throw new ServiceUnavailableException('Falta PAYMENT_TOKEN_ID');
    if (!(await this.tieneTrustline(direccion))) return 0n;
    return BigInt((await this.leer(tokenId, 'balance', [new Address(direccion).toScVal()])) as bigint | number | null ?? 0);
  }

  private textoFallida(r: rpc.Api.GetFailedTransactionResponse): string {
    const codigo = r.resultXdr?.result.type ?? '';
    return `La transacción falló en la red${codigo ? ` (${codigo})` : ''}. Revisa los datos y vuelve a intentar.`;
  }

  private errorDeSimulacion(e: unknown): BadRequestException {
    const mensaje = String((e as Error)?.message ?? e);
    const codigo = codigoErrorContrato(mensaje);
    // El SAC dice qué cuenta no tiene la trustline («trustline entry is missing for account G…»). Se busca por el texto:
    // si el escrow llamó al token, el #13 del SAC no es el #13 del escrow.
    const cuenta = cuentaSinTrustline(mensaje);
    if (cuenta !== null || (codigo === SAC_SIN_TRUSTLINE && contratoOrigenDelError(mensaje) === this.config.stellar.tokenId)) {
      const quien = cuenta ? `La wallet ${cuenta.slice(0, 5)}…${cuenta.slice(-5)}` : 'Una de las wallets del pago';
      return new BadRequestException(`${quien} todavía no acepta USDC (le falta la trustline). Actívala desde el saldo y vuelve a intentar.`);
    }
    if (codigo !== null && this.config.stellar.tokenId && contratoOrigenDelError(mensaje) === this.config.stellar.tokenId) {
      // Falló el token (casi siempre por saldo): sus números de error no son los del escrow.
      return new BadRequestException('Tu wallet no tiene USDC suficiente para este pago. Recarga y vuelve a intentar.');
    }
    if (codigo !== null) {
      const texto = ERRORES_CONTRATO[codigo]?.explicacion ?? ERRORES_EXTRA[codigo] ?? `Error #${codigo} del contrato.`;
      return new BadRequestException(`El contrato no lo permite: ${texto}`);
    }
    this.log.warn(`Simulación fallida: ${mensaje.slice(0, 300)}`);
    return new BadRequestException('La red no aceptó esta operación (falló la simulación). Revisa tu saldo y vuelve a intentar.');
  }

  private sinRed(e: unknown): ServiceUnavailableException {
    this.log.warn(`Sin respuesta del RPC: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
    return new ServiceUnavailableException('No pudimos conectarnos con la red de Stellar; intenta de nuevo en un momento');
  }
}
