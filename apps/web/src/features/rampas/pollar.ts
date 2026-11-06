// Rampa con Pollar: moneda local → USDC con la sesión de Pollar de la persona (entró con su correo o Google).
// WorkVille no toca el dinero: lo cambia el proveedor de Pollar. Desde @pollar/core 0.12 una rampa es una orden:
// ruta → cotización → orden (con sus tramos) → seguir la orden hasta que llegue el USDC.
//
// ⚠ SIN PROBAR con dinero real: en testnet se prueba con el sandbox de Pollar (otros países, docs/simulaciones.md).
// Todo lo que se le pide a Pollar pasa por `ClienteRampa`, así las pruebas usan un cliente falso.
import { estadoRampaDePollar, paisRampa, type EstadoRampa, type PaisRampa } from '@cryptoville/shared';
import {
  assertRampStellarSigner,
  describeRampAction,
  rampFieldError,
  rampFieldValid,
  rampLegStatus,
  rampOrderReceive,
  rampOrderStopped,
  rampQuoteFields,
  rampTrustlineAsset,
  rampWalletStep,
  type PollarClient,
  type RampField,
  type RampOrder,
  type RampQuote,
  type RampQuoteRejection,
  type RampRoute,
  type RampScannable,
  type RampSignatureAction,
  type RampWalletStep,
} from '@pollar/core';
import { notaTramo, textoFallaOrden, textoPasoWallet, textoRequisito, textoSinRuta, tituloAccion, tituloTramo } from './pollar-textos';

/** Lo que WorkVille usa del cliente de Pollar. */
export type ClienteRampa = Pick<
  PollarClient,
  'getRampRoutes' | 'quoteRamp' | 'createRampOrder' | 'getRampOrder' | 'checkRampOrder' | 'retryRampOrder' | 'pollRampOrder' | 'signRampLeg' | 'registerRampSigningHandler' | 'runRampWalletStep'
> & { cosign: Pick<PollarClient['cosign'], 'approve'> };

export interface RutaRampa {
  pais: PaisRampa;
  ruta: RampRoute;
}

// ---------------------------------------------------------------
// Rutas y cotización
// ---------------------------------------------------------------

/**
 * Rutas de recarga que entregan el USDC de Circle en Stellar, solo en los países encendidos y en su moneda.
 * Primero la del método de cada país (QR en Bolivia, Pix en Brasil…). `emisorUsdc`: el emisor del USDC de Circle de la red.
 */
export async function rutasDeRecarga(c: Pick<ClienteRampa, 'getRampRoutes'>, paises: readonly string[], emisorUsdc: string): Promise<RutaRampa[]> {
  const { routes } = await c.getRampRoutes('ONRAMP');
  const rutas: RutaRampa[] = [];
  for (const ruta of routes) {
    const pais = paisRampa(ruta.fiat.country);
    if (!pais || !paises.includes(pais.pais) || ruta.fiat.currency !== pais.moneda) continue;
    if (ruta.asset.chain !== 'STELLAR' || ruta.asset.code !== 'USDC') continue;
    if (ruta.asset.identifier && ruta.asset.identifier !== emisorUsdc) continue;
    rutas.push({ pais, ruta });
  }
  const orden = (r: RutaRampa) => paises.indexOf(r.pais.pais) * 2 + (r.ruta.fiat.rail === r.pais.metodo ? 0 : 1);
  return rutas.sort((a, b) => orden(a) - orden(b));
}

export type Cotizacion =
  | { tipo: 'lista'; cotizacion: RampQuote; resumen: ResumenCotizacion }
  | {
      tipo: 'sin_ruta';
      mensaje: string;
      /** La ruta pide un paso de wallet (crearla, prepararla en otra red…): con este botón se resuelve. */
      pasoWallet: (RampWalletStep & { boton: string; ocupado: string }) | null;
      /** La ruta espera una verificación del proveedor. */
      requisito: { mensaje: string; accion: string | null } | null;
      /** Falta la trustline del USDC (se activa desde el saldo). */
      faltaTrustline: boolean;
    };

export interface ResumenCotizacion {
  /** Lo que paga la persona en su moneda. */
  pagas: string;
  moneda: string;
  /** USDC que le llegan. */
  recibes: string;
  /** Comisión del proveedor en la moneda local (lo que cobra él; ya va dentro de `pagas`). */
  comision: string;
  /** Segundos que debería tardar (null si el proveedor no lo dice). */
  segundos: number | null;
  vence: string;
  /** Wallet donde llega el USDC (la de la sesión de Pollar). */
  destino: string | null;
  /** Datos que pide el proveedor antes de la orden. */
  campos: RampField[];
}

/** Cotiza una recarga de `montoUsdc` (lo que tiene que llegar) por una ruta. */
export async function cotizarRecarga(c: Pick<ClienteRampa, 'quoteRamp'>, { ruta, pais }: RutaRampa, montoUsdc: string): Promise<Cotizacion> {
  const { quotes, rejected } = await c.quoteRamp({
    direction: 'ONRAMP',
    fiat: { currency: ruta.fiat.currency, rail: ruta.fiat.rail, country: ruta.fiat.country },
    asset: { code: ruta.asset.code, identifier: ruta.asset.identifier, chain: ruta.asset.chain },
    amount: { value: montoUsdc, denomination: 'out' },
  });
  const cotizacion = quotes[0];
  if (cotizacion) return { tipo: 'lista', cotizacion, resumen: resumir(cotizacion, pais.moneda) };
  return sinRuta(rejected);
}

function sinRuta(rechazadas: RampQuoteRejection[]): Cotizacion {
  const primera = rechazadas[0];
  const paso = rechazadas.map((r) => rampWalletStep(r)).find((p) => p !== null) ?? null;
  const requisito = rechazadas.find((r) => r.requirement)?.requirement;
  return {
    tipo: 'sin_ruta',
    mensaje: rechazadas.length ? textoSinRuta(rechazadas) : 'Ahora no hay una forma de pago para este monto. Prueba con otro monto.',
    pasoWallet: paso ? { ...paso, ...textoPasoWallet(paso) } : null,
    requisito: requisito ? textoRequisito(requisito) : null,
    faltaTrustline: Boolean(primera && rechazadas.some((r) => rampTrustlineAsset(r))),
  };
}

const suma = (montos: string[]) => montos.reduce((t, m) => t + Number(m), 0);

export function resumir(q: RampQuote, moneda: string): ResumenCotizacion {
  const comision = suma(q.legs.flatMap((l) => l.providerFees.filter((f) => f.currency === moneda && f.payer !== 'APPLICATION').map((f) => f.amount)));
  return {
    pagas: q.amountIn,
    moneda,
    recibes: q.amountOut,
    comision: comision.toFixed(2),
    segundos: q.etaSeconds,
    vence: q.expiresAt,
    destino: q.legs.at(-1)?.wallet?.address ?? null,
    campos: rampQuoteFields(q),
  };
}

/** Errores de los datos que pide el proveedor (por `key`); vacío si todo está bien. */
export function erroresDeCampos(campos: RampField[], valores: Record<string, string>): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const campo of campos) {
    const valor = valores[campo.key]?.trim();
    if (rampFieldValid(campo, valor)) continue;
    errores[campo.key] = rampFieldError(campo, valor) ? `Revisa «${campo.label}»${campo.hint ? `: ${campo.hint}` : ''}` : `Completa «${campo.label}»`;
  }
  return errores;
}

// ---------------------------------------------------------------
// Orden
// ---------------------------------------------------------------

/**
 * Crea la orden con la cotización que la persona aceptó. El USDC tiene que llegar a la wallet con la que paga en
 * WorkVille: si la cotización lo manda a otra, no se sigue.
 */
export async function crearOrden(c: Pick<ClienteRampa, 'createRampOrder'>, q: RampQuote, valores: Record<string, string>, direccion: string): Promise<RampOrder> {
  const destino = q.legs.at(-1)?.wallet?.address;
  if (destino && destino !== direccion) throw new Error('El USDC llegaría a otra wallet: entra con la cuenta de Pollar de esta wallet');
  const campos = rampQuoteFields(q);
  const errores = erroresDeCampos(campos, valores);
  const primero = Object.values(errores)[0];
  if (primero) throw new Error(primero);
  const payee = Object.fromEntries(campos.map((f) => [f.key, valores[f.key]?.trim() ?? '']).filter(([, v]) => v));
  return c.createRampOrder({ quoteId: q.quoteId, ...(Object.keys(payee).length ? { payee } : {}) });
}

/**
 * Firmas de los tramos en Stellar: antes de firmar se revisa que la transacción solo gaste de la wallet de la
 * persona (`assertRampStellarSigner`). `firmar` es la firma de la sesión (Pollar). Devuelve cómo quitarlo.
 */
export function prepararFirmas(c: Pick<ClienteRampa, 'registerRampSigningHandler'>, direccion: string, firmar: (xdr: string) => Promise<string>): () => void {
  return c.registerRampSigningHandler('STELLAR', 'xdr', async (accion: RampSignatureAction) => {
    assertRampStellarSigner(accion, direccion);
    return firmar(accion.payload.value);
  });
}

export interface TramoVista {
  titulo: string;
  estado: 'pending' | 'active' | 'done' | 'failed';
  nota: string | null;
}

/** Todo lo que la pantalla muestra de una orden. */
export interface VistaOrden {
  id: string;
  estado: EstadoRampa;
  titulo: string;
  tipoAccion: string | null;
  actionId: string | null;
  /** QR del proveedor (SVG seguro o imagen) y, si hay, el texto para pagar sin escanear. */
  qr: { svg: string } | { src: string } | null;
  textoQr: { etiqueta: string; valor: string } | null;
  /** Datos de una transferencia (cuenta, referencia…). */
  datos: { etiqueta: string; valor: string }[];
  enlace: { url: string; texto: string } | null;
  nota: string | null;
  sinCodigo: boolean;
  pagoCerrado: boolean;
  vence: string | null;
  puedeFirmar: boolean;
  puedeAprobar: boolean;
  cosignId: string | null;
  tramos: TramoVista[];
  recibes: { monto: string; unidad: string; estimado: boolean } | null;
  falla: string | null;
  reintentable: boolean;
  /** Ya no avanza sola: terminó o quedó retenida hasta que alguien la resuelva. */
  detenida: boolean;
  /** Transacción con la que llegó el USDC (el último tramo), cuando ya está. */
  hashUsdc: string | null;
}

function imagenQr(q: RampScannable | null): VistaOrden['qr'] {
  const imagen = q?.image;
  if (!imagen) return null;
  // Los SVG que arma Pollar se pueden insertar tal cual (inlineSafe); el resto va como imagen.
  if (imagen.mediaType === 'image/svg+xml' && imagen.encoding === 'utf8' && imagen.inlineSafe) return { svg: imagen.data };
  return { src: `data:${imagen.mediaType};${imagen.encoding === 'base64' ? 'base64' : 'utf8'},${imagen.encoding === 'base64' ? imagen.data : encodeURIComponent(imagen.data)}` };
}

export function vistaOrden(orden: RampOrder): VistaOrden {
  const d = describeRampAction(orden);
  const accion = orden.pendingAction;
  const tipo = orden.state === 'completed' ? null : (accion?.kind ?? null);
  const monto = accion?.kind === 'FIAT_PAYMENT' ? { amount: accion.instructions.amount, currency: accion.instructions.currency } : undefined;
  const textoEnlace =
    accion?.kind === 'KYC' ? 'Verificar mi identidad' : accion?.kind === 'FIAT_PAYMENT' && accion.instructions.kind === 'hosted' ? 'Pagar en la página del proveedor' : 'Abrir la página del pago';
  const ultimo = orden.legs.at(-1);
  return {
    id: orden.id,
    estado: estadoRampaDePollar(orden.state),
    titulo: orden.state === 'completed' ? 'Llegó: ya tienes el USDC' : tituloAccion(tipo, monto),
    tipoAccion: tipo,
    actionId: accion?.actionId ?? null,
    qr: d.paymentClosed ? null : imagenQr(d.scannable),
    textoQr: d.scannable?.payload && d.scannable.payloadLabel ? { etiqueta: d.scannable.payloadLabel, valor: d.scannable.payload } : null,
    datos: d.details.map((x) => ({ etiqueta: x.label === 'Reference' ? 'Referencia' : x.label, valor: x.value })),
    enlace: d.link ? { url: d.link, texto: textoEnlace } : null,
    nota: d.note,
    sinCodigo: d.codeMissing,
    pagoCerrado: d.paymentClosed,
    vence: d.expiresAt,
    puedeFirmar: d.canSign,
    puedeAprobar: d.canApprove,
    cosignId: accion?.kind === 'COSIGN_APPROVAL' ? accion.cosignRequestId : null,
    tramos: orden.legs.map((l) => ({ titulo: tituloTramo(l), estado: rampLegStatus(l), nota: notaTramo(l) })),
    recibes: (() => {
      const r = rampOrderReceive(orden);
      return r ? { monto: r.amount, unidad: r.unit, estimado: r.estimated } : null;
    })(),
    falla: textoFallaOrden(orden),
    reintentable: Boolean(orden.failure?.retryable),
    detenida: rampOrderStopped(orden),
    hashUsdc: orden.state === 'completed' ? (ultimo?.onchainTxHash ?? null) : null,
  };
}

/** Sigue la orden al ritmo que sugiere Pollar hasta que se detiene. `onCambio` recibe cada lectura. */
export function seguirOrden(c: Pick<ClienteRampa, 'pollRampOrder'>, id: string, onCambio: (o: RampOrder) => void, signal: AbortSignal): Promise<RampOrder> {
  return c.pollRampOrder(id, { signal, onUpdate: onCambio, onError: () => undefined });
}

/** La persona dice que ya pagó: Pollar le pregunta al proveedor ahora mismo. */
export function yaPague(c: Pick<ClienteRampa, 'checkRampOrder'>, id: string): Promise<RampOrder> {
  return c.checkRampOrder(id);
}

/** Firma el tramo que espera la orden (solo desde el botón «Autorizar» que la persona tocó). */
export function firmarTramo(c: Pick<ClienteRampa, 'signRampLeg'>, orden: VistaOrden): Promise<RampOrder> {
  if (!orden.puedeFirmar || !orden.actionId) throw new Error('La orden ya no espera esta firma');
  return c.signRampLeg(orden.id, orden.actionId);
}

/** Aprueba la co-firma desde este dispositivo y vuelve a correr la orden desde donde quedó. */
export async function aprobarCofirma(c: Pick<ClienteRampa, 'cosign' | 'retryRampOrder'>, orden: VistaOrden): Promise<RampOrder> {
  if (!orden.cosignId) throw new Error('La orden ya no espera una aprobación');
  await c.cosign.approve(orden.cosignId);
  return c.retryRampOrder(orden.id);
}

/** Vuelve a correr una orden retenida desde donde quedó (por ejemplo, después de resolver la falla). */
export function reintentar(c: Pick<ClienteRampa, 'retryRampOrder'>, id: string): Promise<RampOrder> {
  return c.retryRampOrder(id);
}

/**
 * Prepara la wallet que pide una ruta (crearla, en otra red como la de Stereum, mover la custodia).
 * `recuperacion`: la wallet nueva necesita una forma de recuperarla antes de poder firmar.
 */
export async function hacerPasoWallet(c: Pick<ClienteRampa, 'runRampWalletStep'>, paso: RampWalletStep): Promise<{ recuperacion: boolean }> {
  const { recoveryRequired } = await c.runRampWalletStep(paso);
  return { recuperacion: recoveryRequired };
}
