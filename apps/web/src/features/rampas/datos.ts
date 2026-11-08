// Rampas: pagar con el QR del banco (bolivianos → USDC) y pasar a mi banco (USDC → cuenta del banco).
// En testnet la rampa puede ser SIMULADA (la API manda USDC de testnet desde una wallet caja): ver docs/simulaciones.md.
import { DECIMALES_TOKEN, usdcAUnidades, type EstadoRampa, type SentidoRampa } from '@cryptoville/shared';
import { api } from '../../lib/api';

export interface Rampa {
  id: string;
  sentido: SentidoRampa;
  proveedor: 'simulada' | 'pollar';
  pais: string;
  moneda: string;
  monto_usdc: string;
  monto_local: string;
  tipo_cambio: string;
  comision_local: string;
  direccion: string;
  pedido_id: string | null;
  estado: EstadoRampa;
  referencia: string;
  qr_payload: string | null;
  banco: string | null;
  cuenta_final: string | null;
  tx_hash: string | null;
  expira_en: string;
  creada_en: string;
}

export interface EstadoSaldo {
  /** Null si no se pudo leer la red. */
  saldo_usdc: string | null;
  /** ¿La wallet ya acepta el USDC? false: hay que activarlo (trustline); null: no se pudo saber o no hace falta. */
  trustline: boolean | null;
}

/** Saldo de USDC de una wallet de la cuenta y si ya lo acepta. */
export function estadoSaldo(direccion: string): Promise<EstadoSaldo> {
  return api<EstadoSaldo>(`/rampas/saldo?direccion=${encodeURIComponent(direccion)}`);
}

/** Saldo de USDC de una wallet de la cuenta (null si no se pudo leer la red). */
export async function saldoUsdc(direccion: string): Promise<string | null> {
  return (await estadoSaldo(direccion)).saldo_usdc;
}

/**
 * Activa el USDC en una wallet (abre su trustline): WorkVille arma la operación, la wallet la firma
 * y WorkVille la envía después de revisar que sea solo eso.
 */
export async function activarUsdc(direccion: string, firmar: (xdr: string, direccion: string) => Promise<string>): Promise<void> {
  const { xdr } = await api<{ xdr: string }>('/transacciones/trustline/preparar', { cuerpo: { direccion } });
  const firmada = await firmar(xdr, direccion);
  await api('/transacciones/trustline/enviar', { cuerpo: { xdr_firmado: firmada } });
  avisarCambioDeSaldo();
}

export function crearRecarga(montoUsdc: string, direccion: string, pedidoId?: string): Promise<Rampa> {
  return api<Rampa>('/rampas/entradas', { cuerpo: { monto_usdc: montoUsdc, direccion, ...(pedidoId ? { pedido_id: pedidoId } : {}) } });
}

/** SIMULADO (solo testnet): hace como si el banco hubiera pagado el QR. */
export function simularPagoDelBanco(id: string): Promise<Rampa> {
  return api<Rampa>(`/rampas/entradas/${id}/simular-pago`, { cuerpo: {} });
}

/** Rampa con Pollar: registra en WorkVille la orden que se creó con el SDK de Pollar (la misma orden, la misma fila). */
export function registrarOrdenPollar(d: {
  orden_id: string;
  direccion: string;
  pais: string;
  moneda: string;
  monto_usdc: string;
  monto_local: string;
  comision_local: string;
  estado: string;
  expira_en?: string;
  pedido_id?: string;
}): Promise<Rampa> {
  return api<Rampa>('/rampas/pollar/ordenes', { cuerpo: { sentido: 'entrada', ...d } });
}

/** Rampa con Pollar: avisa un cambio de estado. Al completarse va la transacción del USDC, que la API lee en la red. */
export function avisarEstadoPollar(id: string, estado: string, txHash?: string | null): Promise<Rampa> {
  // La API guarda el hash en minúsculas (como los demás hashes de la app): si llega en mayúsculas, lo rechazaría.
  const hash = txHash?.trim().toLowerCase();
  return api<Rampa>(`/rampas/pollar/ordenes/${id}/estado`, { cuerpo: { estado, ...(hash ? { tx_hash: hash } : {}) } });
}

export function crearRetiro(datos: { monto_usdc: string; direccion: string; banco: string; cuenta: string }): Promise<Rampa> {
  return api<Rampa>('/rampas/salidas', { cuerpo: datos });
}

/** Lo que falta para pagar `monto` con `saldo` (redondeado hacia arriba a centavos; mínimo 1 USDC). */
export function faltaParaPagar(monto: string, saldo: string | null): string {
  // Se cuenta en unidades del token (enteros): con decimales de JS, 1.1 × 100 da 110.00000000000001 y el
  // redondeo hacia arriba pediría un centavo de más (1,11 en vez de 1,10).
  const UNIDADES_POR_CENTAVO = 10n ** BigInt(DECIMALES_TOKEN - 2);
  const MINIMO = 100n; // 1 USDC, en centavos
  try {
    const falta = BigInt(usdcAUnidades(String(monto))) - BigInt(usdcAUnidades(String(saldo ?? '0')));
    const centavos = falta <= 0n ? 0n : (falta + UNIDADES_POR_CENTAVO - 1n) / UNIDADES_POR_CENTAVO;
    const total = centavos > MINIMO ? centavos : MINIMO;
    return `${total / 100n}.${String(total % 100n).padStart(2, '0')}`;
  } catch {
    // Un monto con otro formato (por ejemplo, en notación científica): el cálculo de siempre.
    const falta = Number(monto) - Number(saldo ?? 0);
    return (Math.ceil(Math.max(falta, 1) * 100) / 100).toFixed(2);
  }
}

// El saldo de arriba se vuelve a leer cuando algo lo cambia (pago, recarga, retiro…).
const alCambiarSaldo = new Set<() => void>();

/** Avisa que el saldo pudo cambiar (después de un pago, una recarga o un retiro). */
export function avisarCambioDeSaldo(): void {
  for (const f of alCambiarSaldo) f();
}

export function escucharCambioDeSaldo(f: () => void): () => void {
  alCambiarSaldo.add(f);
  return () => alCambiarSaldo.delete(f);
}
