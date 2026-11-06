// Rampas: pasar de bolivianos a USDC (pagar con el QR del banco) y de USDC a la cuenta del banco.
// WorkVille nunca recibe ni guarda dinero: lo cambia un proveedor con licencia (en mainnet, Pollar).
//
// ⚠ SIMULADO: en testnet no hay una rampa real, así que todo lo de RAMPA_SIMULADA (tipo de cambio, comisión,
// bancos, el QR) es de mentira, para poder probar el flujo completo. El USDC sí es real (de testnet): sale de una
// wallet «caja» que se llena en el faucet de Circle.
// Qué está simulado y qué hay que revisar antes de mainnet: docs/simulaciones.md.

/** Una recarga (entrada) o un retiro (salida). */
export type SentidoRampa = 'entrada' | 'salida';
export type ProveedorRampa = 'simulada' | 'pollar';

/**
 * Estados de una operación de rampa: los mismos de una orden de rampa de Pollar (`RampOrder.state`), en español,
 * para que la rampa simulada y la de Pollar se vean igual. Hay uno más, `vencida` (el QR venció sin pago),
 * que Pollar informa como `failed`.
 * - Recarga: esperando_pago (el QR) → procesando (el banco pagó) → liquidando (sale el USDC) → completada.
 * - Retiro: esperando_pago (falta que la persona mande el USDC) → procesando (el banco paga) → completada.
 */
export type EstadoRampa = 'creada' | 'esperando_pago' | 'procesando' | 'liquidando' | 'completada' | 'fallida' | 'reembolsada' | 'vencida';

export const ESTADOS_RAMPA: readonly EstadoRampa[] = ['creada', 'esperando_pago', 'procesando', 'liquidando', 'completada', 'fallida', 'reembolsada', 'vencida'];

/** Estado de una orden de rampa de Pollar → el nuestro. Un estado que no se conoce cuenta como «procesando». */
export const ESTADO_RAMPA_DE_POLLAR: Record<string, EstadoRampa> = {
  created: 'creada',
  awaiting_payment: 'esperando_pago',
  processing: 'procesando',
  settling_onchain: 'liquidando',
  completed: 'completada',
  failed: 'fallida',
  refunded: 'reembolsada',
};

export function estadoRampaDePollar(estado: string): EstadoRampa {
  return ESTADO_RAMPA_DE_POLLAR[estado] ?? 'procesando';
}

/** ¿La operación ya terminó (bien o mal)? */
export function rampaTerminada(estado: EstadoRampa): boolean {
  return estado === 'completada' || estado === 'fallida' || estado === 'reembolsada' || estado === 'vencida';
}

export const RAMPA_SIMULADA = {
  pais: 'BO',
  moneda: 'BOB',
  /** SIMULADO: bolivianos por dólar (valor de ejemplo, no se actualiza). */
  tipoCambio: 6.96,
  /** SIMULADO: comisión de la rampa, en % del monto en bolivianos. */
  comisionPct: 1,
  /** Minutos que vale el QR de una recarga. */
  minutosVigencia: 15,
  /** Montos permitidos por operación (USDC). */
  minimoUsdc: 1,
  maximoUsdc: 1000,
  /** SIMULADO: bancos de Bolivia para el retiro (la rampa real trae su propia lista). */
  bancos: ['Banco Nacional de Bolivia (BNB)', 'Banco de Crédito de Bolivia (BCP)', 'Banco Unión', 'Banco Mercantil Santa Cruz', 'Banco Económico', 'Banco Ganadero', 'Banco Bisa', 'Banco FIE', 'BancoSol'],
} as const;

export interface CotizacionRampa {
  sentido: SentidoRampa;
  pais: string;
  moneda: string;
  monto_usdc: string;
  tipo_cambio: number;
  /** Comisión de la rampa (en la moneda local). */
  comision_local: string;
  /** Entrada: lo que paga la persona con el banco. Salida: lo que le llega a su cuenta. */
  monto_local: string;
}

const centavos = (n: number) => Math.round(n * 100) / 100;
const dosDecimales = (n: number) => centavos(n).toFixed(2);

/**
 * Cotización de la rampa simulada.
 * - Entrada: la persona paga (USDC × tipo de cambio) + comisión.
 * - Salida: le llega (USDC × tipo de cambio) − comisión.
 */
export function cotizarRampaSimulada(sentido: SentidoRampa, montoUsdc: string | number): CotizacionRampa {
  const usdc = Number(montoUsdc);
  if (!Number.isFinite(usdc) || usdc <= 0) throw new Error('El monto tiene que ser mayor que 0');
  const base = centavos(usdc * RAMPA_SIMULADA.tipoCambio);
  const comision = centavos((base * RAMPA_SIMULADA.comisionPct) / 100);
  return {
    sentido,
    pais: RAMPA_SIMULADA.pais,
    moneda: RAMPA_SIMULADA.moneda,
    monto_usdc: String(montoUsdc),
    tipo_cambio: RAMPA_SIMULADA.tipoCambio,
    comision_local: dosDecimales(comision),
    monto_local: dosDecimales(sentido === 'entrada' ? base + comision : Math.max(0, base - comision)),
  };
}

// ---------------------------------------------------------------
// QR Simple simulado
// ---------------------------------------------------------------

/** Marca de los QR simulados: va como identificador de la red de pago y en el nombre del comercio. */
export const MARCA_QR_SIMULADO = 'BO.WORKVILLE.SIMULADO';

/** Código numérico ISO 4217 de las monedas que usa la rampa (el QR lleva el número, no las letras). */
const MONEDA_NUMERICA: Record<string, string> = { BOB: '068', USD: '840' };

/** Un campo TLV del estándar EMVCo: id de 2 cifras, largo de 2 cifras y el valor. */
function campo(id: string, valor: string): string {
  if (valor.length > 99) throw new Error(`El campo ${id} del QR es demasiado largo`);
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`;
}

/** CRC-16/CCITT-FALSE (polinomio 0x1021, inicio 0xFFFF): el control con que termina un QR EMVCo. */
export function crcQr(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Texto del QR simulado, con el formato de un QR de cobro EMVCo como el QR Simple de los bancos de Bolivia
 * (dinámico, con monto y referencia). Para que ninguna app de banco lo tome por un cobro real:
 * - la red de pago (campo 26) es `BO.WORKVILLE.SIMULADO`, que no existe, así que ningún banco sabe a quién pagar;
 * - el comercio se llama «WORKVILLE SIMULADO» y la nota dice «SIMULADO - NO PAGAR».
 */
export function qrRampaSimulada(referencia: string, montoLocal: string, moneda: string = RAMPA_SIMULADA.moneda): string {
  const numerica = MONEDA_NUMERICA[moneda];
  if (!numerica) throw new Error(`Moneda sin código para el QR: ${moneda}`);
  const sinControl =
    campo('00', '01') + // versión del formato
    campo('01', '12') + // QR dinámico (de un solo cobro)
    campo('26', campo('00', MARCA_QR_SIMULADO) + campo('01', referencia)) +
    campo('52', '7299') + // rubro: otros servicios
    campo('53', numerica) +
    campo('54', montoLocal) +
    campo('58', RAMPA_SIMULADA.pais) +
    campo('59', 'WORKVILLE SIMULADO') +
    campo('60', 'LA PAZ') +
    campo('62', campo('05', referencia) + campo('08', 'SIMULADO - NO PAGAR')) +
    '6304';
  return sinControl + crcQr(sinControl);
}

/** Lee los campos de primer nivel de un QR EMVCo (id → valor). Lanza un error si el texto no tiene ese formato. */
export function leerQrEmv(texto: string): Record<string, string> {
  const campos: Record<string, string> = {};
  let i = 0;
  while (i < texto.length) {
    const id = texto.slice(i, i + 2);
    const largo = Number(texto.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(largo) || i + 4 + largo > texto.length) throw new Error('El QR no tiene el formato EMVCo');
    campos[id] = texto.slice(i + 4, i + 4 + largo);
    i += 4 + largo;
  }
  return campos;
}

/** ¿Es un QR simulado de WorkVille (y no un cobro real)? */
export function esQrSimulado(texto: string): boolean {
  try {
    const cuenta = leerQrEmv(leerQrEmv(texto)['26'] ?? '');
    return cuenta['00'] === MARCA_QR_SIMULADO;
  } catch {
    return false;
  }
}

const ETIQUETAS_ENTRADA: Record<EstadoRampa, string> = {
  creada: 'Preparando el QR',
  esperando_pago: 'Esperando tu pago desde el banco',
  procesando: 'El banco pagó: el cambio está en curso',
  liquidando: 'Mandando el USDC a tu wallet',
  completada: 'Llegó: ya tienes el USDC',
  fallida: 'No se pudo completar',
  reembolsada: 'Se te devolvió el pago',
  vencida: 'Venció',
};

const ETIQUETAS_SALIDA: Record<EstadoRampa, string> = {
  creada: 'Preparando el retiro',
  esperando_pago: 'Falta que firmes el envío',
  procesando: 'Recibimos tu USDC: el banco está pagando',
  liquidando: 'Recibimos tu USDC: el banco está pagando',
  completada: 'Enviado a tu banco',
  fallida: 'No se pudo completar',
  reembolsada: 'Se te devolvió el USDC',
  vencida: 'Venció',
};

/** Texto para la persona según el estado (cambia entre una recarga y un retiro). */
export function etiquetaEstadoRampa(sentido: SentidoRampa, estado: EstadoRampa): string {
  return (sentido === 'entrada' ? ETIQUETAS_ENTRADA : ETIQUETAS_SALIDA)[estado];
}
