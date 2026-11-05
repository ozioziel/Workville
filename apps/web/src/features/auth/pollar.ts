// Entrar con correo (para quien no conoce cripto), con Pollar (https://docs.pollar.xyz).
// - Pollar crea una wallet de Stellar para la persona y la guarda por ella: la persona no anota 24 palabras.
// - WorkVille nunca tiene esa llave: Pollar firma el mensaje de inicio de sesión (SEP-53) y las transacciones.
// - Solo se carga si el servidor tiene POLLAR_API_KEY (si no, solo aparece la entrada con wallet).
import type { RedStellar } from '@cryptoville/shared';
import type { AuthState, PollarClient } from '@pollar/core';

let cliente: PollarClient | null = null;
let iniciando: Promise<PollarClient> | null = null;

/** Crea (una sola vez) el cliente de Pollar. La librería se descarga solo cuando hace falta. */
export function clientePollar(apiKey: string, red: RedStellar): Promise<PollarClient> {
  if (cliente) return Promise.resolve(cliente);
  iniciando ??= (async () => {
    const { PollarClient: Cliente } = await import('@pollar/core');
    const c = new Cliente({ apiKey, stellarNetwork: red });
    await c.ready();
    cliente = c;
    return c;
  })();
  return iniciando;
}

/** Paso en el que va la entrada con correo (para mostrar el campo que corresponde). */
export type PasoCorreo = 'correo' | 'enviando' | 'codigo' | 'verificando' | 'listo' | 'error';

export function pasoDe(estado: AuthState): { paso: PasoCorreo; mensaje?: string } {
  switch (estado.step) {
    case 'sending_email':
    case 'creating_session':
      return { paso: 'enviando' };
    case 'entering_code':
      return { paso: 'codigo' };
    case 'verifying_email_code':
      return { paso: 'verificando' };
    case 'authenticated':
      return { paso: 'listo' };
    case 'error':
      return { paso: 'error', mensaje: traducir(estado.message) };
    default:
      return { paso: 'correo' };
  }
}

function traducir(mensaje: string): string {
  if (/code|otp/i.test(mensaje) && /invalid|wrong|expired/i.test(mensaje)) return 'El código no es correcto o ya venció. Pide otro.';
  if (/email/i.test(mensaje) && /invalid/i.test(mensaje)) return 'Ese correo no parece válido.';
  if (/network|timeout|fetch/i.test(mensaje)) return 'No pudimos conectarnos con el servicio de cuentas. Intenta de nuevo.';
  return `El servicio de cuentas respondió: ${mensaje}`;
}

/**
 * Entrar con Google (Pollar abre una ventana de Google). Termina cuando Pollar dice que entró;
 * si la persona cierra la ventana, lanza `CanceladoPorUsuario`.
 */
let cancelarGoogle: (() => void) | null = null;

/** Corta la entrada con Google en curso (por ejemplo, si el navegador bloqueó la ventana). */
export function cancelarEntradaConGoogle(): void {
  cancelarGoogle?.();
}

export function entrarConGooglePollar(c: PollarClient, Cancelado: new () => Error): Promise<void> {
  if (c.getAuthState().step === 'authenticated') return Promise.resolve();
  return new Promise<void>((listo, fallo) => {
    let empezo = false;
    cancelarGoogle = () => {
      cancelarGoogle = null;
      quitar();
      c.cancelLogin();
      fallo(new Cancelado());
    };
    const quitar = c.onAuthStateChange((estado) => {
      if (estado.step === 'opening_oauth' || estado.step === 'authenticating' || estado.step === 'creating_session') empezo = true;
      if (estado.step === 'authenticated') {
        cancelarGoogle = null;
        quitar();
        listo();
      } else if (estado.step === 'error') {
        cancelarGoogle = null;
        quitar();
        fallo(/cancel|closed|popup/i.test(estado.message) ? new Cancelado() : new Error(traducir(estado.message)));
      } else if (estado.step === 'idle' && empezo) {
        // Volvió al inicio: cerró la ventana de Google sin entrar.
        cancelarGoogle = null;
        quitar();
        fallo(new Cancelado());
      }
    });
    c.login({ provider: 'google' });
  });
}

/** Nombre de la persona según Google (para la cuenta nueva), si Pollar lo da. */
export function nombreDePollar(c: PollarClient): string | null {
  const p = c.getUserProfile();
  const nombre = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
  return nombre.length >= 2 ? nombre.slice(0, 40) : null;
}

/** Dirección de la wallet de la cuenta de Pollar (cuando ya entró). */
export function direccionPollar(c: PollarClient): string | null {
  return c.getWallet()?.address ?? null;
}

/** Texto del error de una firma de Pollar, en español. */
function errorDeFirma(r: { code?: string; details?: string; message?: string }): Error {
  if (r.code === 'SDK_WALLET_NOT_READY') return new Error('Tu cuenta todavía está preparando su wallet. Intenta en un momento.');
  if (r.code === 'SDK_CONFIRMATION_DECLINED') return new Error('Rechazaste la firma: no se hizo nada.');
  return new Error(`No se pudo firmar con tu cuenta: ${r.message ?? r.details ?? r.code ?? 'error desconocido'}`);
}

/** Firma el mensaje de inicio de sesión de WorkVille (SEP-53) con la wallet de Pollar. */
export async function firmarMensajePollar(c: PollarClient, mensaje: string): Promise<string> {
  const r = await c.stellar.sep53.signMessage(mensaje);
  if (r.status !== 'signed') throw errorDeFirma(r);
  return r.signature;
}

/**
 * Firma una transacción (XDR) armada por WorkVille con la wallet de Pollar.
 * Desde la 0.12, Pollar espera que la app confirme cada firma (política «prompt» del panel de Pollar) y,
 * si nadie la escucha, la rechaza. La persona ya confirmó con el botón de WorkVille que dice qué firma:
 * se confirma solo esta misma transacción y cualquier otra pendiente se deja como está.
 */
export async function firmarTransaccionPollar(c: PollarClient, xdr: string): Promise<string> {
  const quitar = c.onConfirmationRequest((pendientes) => {
    for (const p of pendientes) if (p.kind === 'sign' && p.unsignedXdr === xdr) p.confirm();
  });
  try {
    const r = await c.signTx(xdr);
    if (r.status === 'signed') return r.signedXdr;
    // Wallet co-firmada (Turnkey): el SDK vota solo con este dispositivo; si igual queda pendiente, falta otra aprobación.
    if (r.status === 'cosign_pending') throw new Error('Tu cuenta espera la aprobación de otro dispositivo. Apruébala y vuelve a firmar.');
    throw errorDeFirma(r);
  } finally {
    quitar();
  }
}

export async function salirDePollar(): Promise<void> {
  if (!cliente) return;
  try {
    await cliente.logout();
  } catch {
    // Si no hay red, Pollar igual borra la sesión local.
  }
}
