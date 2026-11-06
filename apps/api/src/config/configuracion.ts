import {
  CONFIG_INICIAL,
  datosRed,
  esContratoValido,
  paisesRampaEncendidos,
  pareceDireccionStellar,
  reglasDe,
  type RedStellar,
} from '@cryptoville/shared';

/**
 * Servicios externos. Cada uno queda "listo pero apagado": solo se enciende si están TODAS sus variables.
 * Si falta alguna, la función no aparece en la app y nada se rompe.
 */
export interface ServiciosExternos {
  /**
   * Entrar con correo (wallet embebida). La llave es pública: la usa el navegador.
   * `google`: el botón «Entrar con Google» (POLLAR_GOOGLE=si). Apagado por defecto: falta probarlo (docs/simulaciones.md).
   */
  pollar: { apiKey: string; google: boolean } | null;
  /** QR para firmar con la wallet del celular. El id es público. */
  walletConnect: { projectId: string } | null;
  /** KYC (una persona = una cuenta). */
  didit: { apiKey: string; workflowId: string; webhookSecret: string } | null;
  /** Videos de pruebas y del portafolio. */
  mux: { tokenId: string; tokenSecret: string; webhookSecret: string; signingKeyId: string; signingKeyPrivada: string } | null;
  /** Correos de aviso (necesita un dominio propio verificado en Resend). */
  correo: { resendApiKey: string; remitente: string } | null;
  /** Notificaciones del navegador (Web Push). La llave pública la usa el navegador. */
  push: { publica: string; privada: string; contacto: string } | null;
}

/** Configuración de la API, leída y validada desde las variables de entorno (.env de la raíz). */
export interface Configuracion {
  entorno: 'development' | 'production' | 'test';
  puerto: number;
  /** Dominio o IP pública (aparece en el mensaje de inicio de sesión). */
  publicHost: string;
  /** URL pública de la app (para volver desde el KYC y para los enlaces de los correos). */
  urlPublica: string;
  origenesCors: string[];
  logNivel: string;
  supabase: {
    url: string;
    /** URL que usa el navegador (en Docker local puede ser distinta de la que usa la API). */
    urlPublica: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  databaseUrl: string;
  auth: {
    secretoContrasenas: string;
    dominioCorreo: string;
  };
  stellar: {
    red: RedStellar;
    /** Contrato de escrow v1 (pedidos de una sola entrega). */
    contratoId: string | null;
    /** Contrato de escrow v2 (fases, pago directo). Si falta, todo sigue con el v1 y no hay fases. */
    contratoV2Id: string | null;
    tokenId: string | null;
    asset: string | null;
    arbitro: string | null;
    /** Cuenta que recibe las comisiones y el pago de los locales extra. */
    tesoreria: string | null;
    comisionBps: number;
    plazoRevisionSeg: number;
    /** RPC de Soroban para leer la red (armar transacciones y verificar pagos). */
    rpcUrl: string;
    /** Verificar cada paso en la red antes de registrarlo. Apagado en las pruebas automáticas. */
    verificar: boolean;
    /**
     * Llave de mantenimiento (S…): la ÚNICA llave en el servidor. Solo ejecuta vencimientos y `extender`
     * del contrato v2 y solo tiene XLM para las comisiones de red: no puede mover el dinero de nadie.
     */
    llaveMantenimiento: string | null;
  };
  servicios: ServiciosExternos;
  /** "pruebas" o "produccion": en mainnet tiene que ser "produccion" (sandbox de Didit, Mux, Pollar…). */
  entornoServicios: 'pruebas' | 'produccion';
  /** Secreto para la huella del documento del KYC (HMAC). Obligatorio si Didit está encendido. */
  secretoKyc: string | null;
  /** Qué rampa pasa bolivianos ↔ USDC (RAMPA_PROVEEDOR). Null: ninguna, «Pagar con el QR de tu banco» no aparece. */
  rampa: 'simulada' | 'pollar' | null;
  /**
   * Rampa SIMULADA (solo testnet): «pagar con el QR del banco» y «pasar a mi banco» de mentira, para probar el flujo.
   * El USDC sale de una wallet «caja» (RAMPA_CAJA_LLAVE o, en tu PC, la caja de .prueba-keys.json) y los retiros
   * vuelven a ella. `minimoCajaUsdc`: por debajo de ese saldo la API avisa. Ver docs/simulaciones.md.
   */
  rampaSimulada: { llaveCaja: string | null; minimoCajaUsdc: number } | null;
  /**
   * Rampa con Pollar: países encendidos (RAMPA_POLLAR_PAISES, por defecto los activos de PAISES_RAMPA: Bolivia).
   * Vacío si la rampa no es la de Pollar.
   */
  rampaPaises: string[];
}

function requerida(env: NodeJS.ProcessEnv, nombre: string): string {
  const valor = env[nombre]?.trim();
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre} (revisa el .env, ver .env.example)`);
  return valor;
}

function opcional(env: NodeJS.ProcessEnv, nombre: string): string | null {
  const valor = env[nombre]?.trim();
  return valor ? valor : null;
}

function entero(env: NodeJS.ProcessEnv, nombre: string, defecto: number): number {
  const valor = opcional(env, nombre);
  if (valor === null) return defecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${nombre} debe ser un entero positivo`);
  return n;
}

/** Un servicio se enciende con todas sus variables; si hay algunas sí y otras no, se avisa cuáles faltan. */
function servicio<T>(env: NodeJS.ProcessEnv, nombre: string, variables: string[], armar: (v: Record<string, string>) => T): T | null {
  const valores = Object.fromEntries(variables.map((v) => [v, opcional(env, v)]));
  const presentes = variables.filter((v) => valores[v] !== null);
  if (presentes.length === 0) return null;
  const faltan = variables.filter((v) => valores[v] === null);
  if (faltan.length) throw new Error(`Para encender ${nombre} faltan estas variables: ${faltan.join(', ')}`);
  return armar(valores as Record<string, string>);
}

function urlPublicaDe(env: NodeJS.ProcessEnv, publicHost: string): string {
  const explicita = opcional(env, 'PUBLIC_URL');
  if (explicita) return explicita.replace(/\/$/, '');
  const puerto = opcional(env, 'PUERTO_PUBLICO');
  if (publicHost === 'localhost' || publicHost === '127.0.0.1') return 'http://localhost:5173';
  // Una IP sola (o un puerto único) va por HTTP; un nombre (sslip.io o dominio) por HTTPS.
  const esIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(publicHost);
  if (puerto) return `http://${publicHost}:${puerto}`;
  return `${esIp ? 'http' : 'https'}://${publicHost}`;
}

export function leerConfiguracion(env: NodeJS.ProcessEnv = process.env): Configuracion {
  const entorno = (env.NODE_ENV ?? 'development') as Configuracion['entorno'];
  const publicHost = opcional(env, 'PUBLIC_HOST') ?? 'localhost';
  const supabaseUrl = requerida(env, 'SUPABASE_URL').replace(/\/$/, '');

  const secreto = requerida(env, 'AUTH_PASSWORD_SECRET');
  if (secreto.length < 32) throw new Error('AUTH_PASSWORD_SECRET debe tener al menos 32 caracteres');

  const red = (opcional(env, 'STELLAR_NETWORK') ?? 'testnet') as RedStellar;
  if (red !== 'testnet' && red !== 'mainnet') throw new Error('STELLAR_NETWORK debe ser testnet o mainnet');

  const contrato = (nombre: string) => {
    const valor = opcional(env, nombre);
    if (valor && !esContratoValido(valor)) throw new Error(`${nombre} no parece un contrato (C… de 56 caracteres)`);
    return valor;
  };
  const cuenta = (nombre: string) => {
    const valor = opcional(env, nombre);
    if (valor && !pareceDireccionStellar(valor)) throw new Error(`${nombre} no parece una dirección G…`);
    return valor;
  };

  const contratoId = contrato('ESCROW_CONTRACT_ID');
  const contratoV2Id = contrato('ESCROW_V2_CONTRACT_ID');
  if (contratoId && contratoId === contratoV2Id) {
    throw new Error(
      'ESCROW_CONTRACT_ID (v1) y ESCROW_V2_CONTRACT_ID tienen el mismo contrato. Son dos contratos distintos: ' +
        'si solo desplegaste el v2, deja ESCROW_CONTRACT_ID vacío.',
    );
  }
  const tokenId = contrato('PAYMENT_TOKEN_ID');
  const arbitro = cuenta('ARBITRO_DIRECCION');
  const tesoreria = cuenta('TESORERIA_DIRECCION');

  const llaveMantenimiento = opcional(env, 'LLAVE_MANTENIMIENTO');
  if (llaveMantenimiento && !/^S[A-Z2-7]{55}$/.test(llaveMantenimiento)) {
    throw new Error('LLAVE_MANTENIMIENTO debe ser una llave secreta S… (la de la cuenta de mantenimiento)');
  }

  // La verificación en la red está encendida por defecto (menos en las pruebas automáticas, que usan hashes de mentira).
  const verificarTexto = opcional(env, 'STELLAR_VERIFICAR');
  if (verificarTexto && !['si', 'no'].includes(verificarTexto)) throw new Error('STELLAR_VERIFICAR debe ser "si" o "no"');
  const verificar = verificarTexto ? verificarTexto === 'si' : entorno !== 'test';

  const textoGoogle = opcional(env, 'POLLAR_GOOGLE');
  if (textoGoogle && !['si', 'no'].includes(textoGoogle)) throw new Error('POLLAR_GOOGLE debe ser "si" o "no"');
  const pollarGoogle = textoGoogle === 'si';

  const entornoServicios = (opcional(env, 'ENTORNO_SERVICIOS') ?? 'pruebas') as Configuracion['entornoServicios'];
  if (entornoServicios !== 'pruebas' && entornoServicios !== 'produccion') {
    throw new Error('ENTORNO_SERVICIOS debe ser "pruebas" o "produccion"');
  }

  const servicios: ServiciosExternos = {
    pollar: servicio(env, 'la entrada con correo (Pollar)', ['POLLAR_API_KEY'], (v) => ({ apiKey: v.POLLAR_API_KEY, google: pollarGoogle })),
    walletConnect: servicio(env, 'el QR de WalletConnect', ['WALLETCONNECT_PROJECT_ID'], (v) => ({ projectId: v.WALLETCONNECT_PROJECT_ID })),
    didit: servicio(env, 'el KYC (Didit)', ['DIDIT_API_KEY', 'DIDIT_WORKFLOW_ID', 'DIDIT_WEBHOOK_SECRET', 'KYC_HMAC_SECRET'], (v) => ({
      apiKey: v.DIDIT_API_KEY,
      workflowId: v.DIDIT_WORKFLOW_ID,
      webhookSecret: v.DIDIT_WEBHOOK_SECRET,
    })),
    mux: servicio(
      env,
      'los videos (Mux)',
      ['MUX_TOKEN_ID', 'MUX_TOKEN_SECRET', 'MUX_WEBHOOK_SECRET', 'MUX_SIGNING_KEY_ID', 'MUX_SIGNING_KEY_PRIVATE'],
      (v) => ({
        tokenId: v.MUX_TOKEN_ID,
        tokenSecret: v.MUX_TOKEN_SECRET,
        webhookSecret: v.MUX_WEBHOOK_SECRET,
        signingKeyId: v.MUX_SIGNING_KEY_ID,
        signingKeyPrivada: v.MUX_SIGNING_KEY_PRIVATE,
      }),
    ),
    correo: servicio(env, 'los correos (Resend)', ['RESEND_API_KEY', 'CORREO_REMITENTE'], (v) => ({
      resendApiKey: v.RESEND_API_KEY,
      remitente: v.CORREO_REMITENTE,
    })),
    push: servicio(env, 'las notificaciones del navegador', ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_CONTACTO'], (v) => ({
      publica: v.VAPID_PUBLIC_KEY,
      privada: v.VAPID_PRIVATE_KEY,
      contacto: v.VAPID_CONTACTO,
    })),
  };
  const secretoKyc = opcional(env, 'KYC_HMAC_SECRET');
  if (secretoKyc && secretoKyc.length < 32) throw new Error('KYC_HMAC_SECRET debe tener al menos 32 caracteres');

  const rampa = rampaDe(env, red, Boolean(servicios.pollar));
  const llaveCaja = opcional(env, 'RAMPA_CAJA_LLAVE');
  if (llaveCaja && !/^S[A-Z2-7]{55}$/.test(llaveCaja)) throw new Error('RAMPA_CAJA_LLAVE debe ser una llave secreta S… (la de la wallet caja de la rampa simulada)');
  // La caja es la única llave del servidor que manda USDC: en mainnet no puede existir.
  if (llaveCaja && red === 'mainnet') throw new Error('RAMPA_CAJA_LLAVE solo existe en testnet: en mainnet el servidor no guarda llaves que muevan dinero');
  const rampaPaises = rampaPaisesDe(env, red, rampa);

  const reglas = reglasDe(red);
  const origenes = opcional(env, 'CORS_ORIGINS');
  return {
    entorno,
    puerto: entero(env, 'PORT', 3000),
    publicHost,
    urlPublica: urlPublicaDe(env, publicHost),
    origenesCors: origenes ? origenes.split(',').map((o) => o.trim()).filter(Boolean) : [],
    logNivel: opcional(env, 'LOG_LEVEL') ?? (entorno === 'production' ? 'info' : 'debug'),
    supabase: {
      url: supabaseUrl,
      urlPublica: (opcional(env, 'SUPABASE_PUBLIC_URL') ?? supabaseUrl).replace(/\/$/, ''),
      anonKey: requerida(env, 'SUPABASE_ANON_KEY'),
      serviceRoleKey: requerida(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    },
    databaseUrl: requerida(env, 'DATABASE_URL'),
    auth: {
      secretoContrasenas: secreto,
      dominioCorreo: opcional(env, 'AUTH_EMAIL_DOMAIN') ?? 'wallet.cryptoville.test',
    },
    stellar: {
      red,
      contratoId,
      contratoV2Id,
      tokenId,
      asset: opcional(env, 'PAYMENT_ASSET'),
      arbitro,
      tesoreria,
      comisionBps: entero(env, 'COMISION_BPS', reglas.comisiones.garantiaBps ?? CONFIG_INICIAL.comision_bps),
      plazoRevisionSeg: entero(env, 'PLAZO_REVISION_SEG', reglas.plazos.revisionSeg ?? CONFIG_INICIAL.plazo_revision_seg),
      rpcUrl: (opcional(env, 'STELLAR_RPC_URL') ?? datosRed(red).rpcUrl).replace(/\/$/, ''),
      verificar,
      llaveMantenimiento,
    },
    servicios,
    entornoServicios,
    secretoKyc,
    rampa,
    rampaSimulada: rampa === 'simulada' ? { llaveCaja, minimoCajaUsdc: entero(env, 'RAMPA_CAJA_MINIMO', 50) } : null,
    rampaPaises,
  };
}

/** Países de la rampa con Pollar (RAMPA_POLLAR_PAISES=BO,AR…). Los del sandbox (Perú, Colombia) no van en mainnet. */
function rampaPaisesDe(env: NodeJS.ProcessEnv, red: RedStellar, rampa: 'simulada' | 'pollar' | null): string[] {
  const texto = opcional(env, 'RAMPA_POLLAR_PAISES');
  const lista = texto ? texto.split(',').map((p) => p.trim()).filter(Boolean) : null;
  const paises = paisesRampaEncendidos(lista);
  const sandbox = paises.filter((p) => p.soloSandbox);
  if (red === 'mainnet' && sandbox.length) throw new Error(`RAMPA_POLLAR_PAISES: ${sandbox.map((p) => p.pais).join(', ')} solo sirve para probar el sandbox de Pollar (testnet)`);
  return rampa === 'pollar' ? paises.map((p) => p.pais) : [];
}

/**
 * Qué rampa hay para pasar bolivianos ↔ USDC, según RAMPA_PROVEEDOR:
 * - `simulada`: solo testnet (QR de mentira, el USDC sale de la caja).
 * - `pollar`: la maneja la web con el SDK de Pollar y la sesión de la persona; necesita POLLAR_API_KEY.
 * - `ninguna`: no hay rampa.
 * Vacía: `simulada` si RAMPA_SIMULADA=si (el nombre anterior), `pollar` en mainnet con Pollar encendido, y si no, ninguna.
 */
function rampaDe(env: NodeJS.ProcessEnv, red: RedStellar, hayPollar: boolean): 'simulada' | 'pollar' | null {
  const anterior = opcional(env, 'RAMPA_SIMULADA');
  if (anterior && !['si', 'no'].includes(anterior)) throw new Error('RAMPA_SIMULADA debe ser "si" o "no" (mejor usa RAMPA_PROVEEDOR)');
  const elegida = opcional(env, 'RAMPA_PROVEEDOR');
  if (elegida && !['simulada', 'pollar', 'ninguna'].includes(elegida)) throw new Error('RAMPA_PROVEEDOR debe ser "simulada", "pollar" o "ninguna"');
  if (elegida && anterior === 'si' && elegida !== 'simulada') {
    throw new Error(`RAMPA_PROVEEDOR=${elegida} y RAMPA_SIMULADA=si no van juntas: deja solo RAMPA_PROVEEDOR`);
  }
  const rampa = elegida === 'ninguna' ? null : ((elegida as 'simulada' | 'pollar' | null) ?? (anterior === 'si' ? 'simulada' : red === 'mainnet' && hayPollar ? 'pollar' : null));
  if (rampa === 'simulada' && red === 'mainnet') {
    throw new Error('La rampa simulada solo existe en testnet: en mainnet el cambio de bolivianos lo hace una rampa real');
  }
  if (rampa === 'pollar' && !hayPollar) throw new Error('RAMPA_PROVEEDOR=pollar necesita Pollar encendido (POLLAR_API_KEY)');
  return rampa;
}

export const CONFIGURACION = Symbol('CONFIGURACION');

/**
 * Qué rampa hay para pasar bolivianos ↔ USDC: la simulada (solo testnet), la de Pollar (la maneja
 * la web con el SDK de Pollar, con la sesión de la persona) o ninguna.
 */
export function proveedorRampa(c: Configuracion): 'simulada' | 'pollar' | null {
  return c.rampa;
}
