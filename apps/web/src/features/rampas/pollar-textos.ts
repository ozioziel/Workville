// Textos de la rampa con Pollar, en español. El SDK de Pollar trae los suyos (rampResolutionText, rampLegTitle,
// describeRampAction…) pero en inglés: aquí van los mismos casos, con las mismas claves que usa Pollar.
import type { RampOrderLeg, RampQuoteRejection, RampQuoteRequirement, RampWalletStep } from '@pollar/core';

type Nodo = RampOrderLeg['from'];

const RED: Record<string, string> = { STELLAR: 'Stellar', POLYGON: 'Polygon', SOLANA: 'Solana' };

const nombreNodo = (n: Nodo) => (n.kind === 'fiat' ? n.currency : `${n.code} en ${RED[n.chain] ?? n.chain}`);

/** Qué hace la persona para resolver una falla (`failure.resolutionAction` de Pollar). */
export const TEXTO_SOLUCION: Record<string, string> = {
  accept_new_quote: 'Cambió el precio. Pide una cotización nueva para seguir.',
  add_funds: 'Tu wallet no tiene saldo suficiente. Carga más y vuelve a intentar.',
  approve_again: 'La aprobación venció. Vuelve a aprobar el paso.',
  automatic_retry: 'Se está reintentando solo. No tienes que hacer nada.',
  change_amount: 'Este monto está fuera de lo que acepta el proveedor. Prueba con otro monto.',
  complete_verification: 'Completa la verificación de identidad del proveedor para seguir.',
  correct_input: 'Algunos datos no se aceptaron. Revísalos y empieza de nuevo.',
  link_wallet: 'Esta forma de pago necesita una wallet en otra red.',
  create_wallet: 'Necesitas una wallet para recibir. Créala para seguir.',
  set_up_wallet: 'Este cambio pasa por otra red. Prepara tu wallet en esa red para seguir.',
  migrate_custody: 'Tu wallet todavía la guarda solo Pollar. Pásala a la wallet segura de tu cuenta para seguir.',
  set_up_recovery: 'Tu wallet necesita una forma de recuperarla antes de poder firmar. Agrégala y vuelve a intentar.',
  add_trustline: 'Tu wallet tiene que aceptar USDC para recibirlo. Activa USDC desde tu saldo y vuelve a intentar.',
  sign_again: 'La firma venció. Vuelve a firmar el paso.',
  start_again: 'Este cambio no se pudo hacer. Empieza uno nuevo: no se cobró nada.',
  fund_gas_wallet: 'Esta forma de pago no está disponible ahora. Intenta más tarde.',
  enable_signing_mode: 'Esta forma de pago no está disponible para tu wallet en WorkVille.',
  wait_reconciliation: 'Estamos confirmando dónde está el dinero. No tienes que empezar de nuevo.',
  pollar_follows_up: 'Lo estamos revisando. Tu dinero está a salvo; si necesitas ayuda, escribe a soporte con el número de la orden.',
  contact_pollar: 'Algo salió mal con el proveedor de cambio. Escribe a soporte con el número de la orden.',
};

export function textoSolucion(accion: string): string {
  return TEXTO_SOLUCION[accion] ?? TEXTO_SOLUCION.contact_pollar;
}

/** Texto de la falla de una orden. Si la orden quedó retenida con el dinero ya movido, lo dice. */
export function textoFallaOrden(orden: { failure: { resolutionAction: string } | null; legs: Pick<RampOrderLeg, 'status'>[] }): string | null {
  if (!orden.failure) return null;
  if (orden.failure.resolutionAction === 'start_again' && orden.legs.some((l) => l.status === 'HELD')) {
    return 'La orden del proveedor venció antes de que llegara el pago. Tu dinero está a salvo en tu wallet: vuelve a intentar con el precio de ahora.';
  }
  return textoSolucion(orden.failure.resolutionAction);
}

/** Qué hace un tramo de la orden: «Comprar USDT en Polygon», «Convertir USDT a USDC», «Mandar a Stellar». */
export function tituloTramo(t: Pick<RampOrderLeg, 'kind' | 'from' | 'to'>): string {
  if (t.kind === 'PROVIDER_ONRAMP') return `Comprar ${nombreNodo(t.to)}`;
  if (t.kind === 'PROVIDER_OFFRAMP') return `Recibir ${nombreNodo(t.to)}`;
  if (t.kind === 'SWAP' && t.from.kind === 'asset' && t.to.kind === 'asset') return `Convertir ${t.from.code} a ${t.to.code}`;
  return `Mandar a ${t.to.kind === 'asset' ? (RED[t.to.chain] ?? t.to.chain) : nombreNodo(t.to)}`;
}

/** Si el proveedor entregó otro activo aceptado (USDT en vez de USDC), que la persona no lo lea como una pérdida. */
export function notaTramo(t: Pick<RampOrderLeg, 'kind' | 'to' | 'fundsLocation'>): string | null {
  if (t.kind !== 'PROVIDER_ONRAMP' || t.to.kind !== 'asset' || !t.fundsLocation) return null;
  const entregado = t.fundsLocation.asset;
  if (entregado.toUpperCase() === t.to.code.toUpperCase()) return null;
  return `El proveedor mandó ${entregado} en vez de ${t.to.code}. En el paso siguiente se convierte a ${t.to.code}: no se pierde nada.`;
}

/** Qué dice una ruta que espera una verificación, y el botón que la abre (null si la persona no puede hacer nada). */
export function textoRequisito(r: Pick<RampQuoteRequirement, 'type' | 'status' | 'reviewReason'>): { mensaje: string; accion: string | null } {
  if (r.type === 'FORM') return { mensaje: 'Responde unas preguntas del proveedor para ver esta forma de pago', accion: 'Seguir' };
  if (r.type === 'PROVIDER_REGISTRATION') return { mensaje: 'Regístrate con el proveedor para ver esta forma de pago', accion: 'Seguir' };
  if (r.type === 'REGISTRY_CHECK') {
    return r.status === 'pending' ? { mensaje: 'Tus datos están en revisión', accion: null } : { mensaje: 'Confirma tus datos para ver esta forma de pago', accion: 'Confirmar' };
  }
  switch (r.status) {
    case 'expired':
      return { mensaje: 'Tu verificación venció', accion: 'Verificar otra vez' };
    case 'pending':
      if (!r.reviewReason) return { mensaje: 'Tu verificación está en curso', accion: 'Seguir' };
      return {
        mensaje: r.reviewReason === 'DUPLICATE_DOCUMENT' ? 'Ese documento ya está en otra cuenta: el equipo del proveedor lo está revisando.' : 'Tu verificación está en revisión',
        accion: null,
      };
    case 'rejected':
      return { mensaje: 'Tu verificación no fue aprobada', accion: null };
    default:
      return { mensaje: 'Verifica tu identidad con el proveedor para ver esta forma de pago', accion: 'Verificar' };
  }
}

/** Por qué no hay ninguna forma de pago para este monto. */
export function textoSinRuta(rechazadas: Array<Pick<RampQuoteRejection, 'failure'> & Partial<Pick<RampQuoteRejection, 'requirement'>>>): string {
  const requisitos = rechazadas.map((r) => r.requirement);
  if (requisitos.length && requisitos.every((r) => r && textoRequisito(r).accion === null)) {
    return requisitos.every((r) => r!.status === 'rejected')
      ? 'Tu verificación de identidad no fue aprobada, así que no hay forma de pago disponible.'
      : 'Tu verificación está en revisión. No tienes que hacer nada: vuelve a intentar más tarde.';
  }
  const acciones = [...new Set(rechazadas.map((r) => r.failure.resolutionAction))];
  return acciones.length === 1 ? textoSolucion(acciones[0]) : 'Ahora no hay una forma de pago para este monto. Prueba con otro monto.';
}

/** El botón del paso de wallet que pide una ruta (crear, preparar en otra red, mover la custodia o la recuperación). */
export function textoPasoWallet(p: Pick<RampWalletStep, 'action' | 'chain'>): { boton: string; ocupado: string } {
  switch (p.action) {
    case 'create_wallet':
      return { boton: 'Crear mi wallet', ocupado: 'Creando…' };
    case 'set_up_wallet':
      return { boton: `Preparar mi wallet en ${RED[p.chain ?? ''] ?? p.chain ?? 'la otra red'}`, ocupado: 'Preparando…' };
    case 'migrate_custody':
      return { boton: 'Mover mi wallet', ocupado: 'Moviendo…' };
    default:
      return { boton: 'Agregar una forma de recuperarla', ocupado: 'Abriendo…' };
  }
}

/** Título de lo que la orden espera ahora (el `pendingAction` de Pollar). */
export function tituloAccion(tipo: string | null, monto?: { amount: string; currency: string }): string {
  switch (tipo) {
    case 'FIAT_PAYMENT':
      return monto ? `Paga ${monto.amount} ${monto.currency}` : 'Paga desde tu banco';
    case 'SIGNATURE':
      return 'Autoriza el envío';
    case 'COSIGN_APPROVAL':
      return 'Apruébalo en tu dispositivo';
    case 'KYC':
      return 'Verifica tu identidad con el proveedor';
    default:
      return 'Procesando';
  }
}
