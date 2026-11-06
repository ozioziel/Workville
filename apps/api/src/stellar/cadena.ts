// Funciones puras para leer y armar llamadas a los contratos (sin conexión a la red).
// Las usa StellarService y se prueban sin red en test/cadena.spec.ts.
import { usdcAUnidades } from '@cryptoville/shared';
import { Address, Asset, FeeBumpTransaction, TransactionBuilder, nativeToScVal, scValToNative, xdr, type Transaction } from '@stellar/stellar-sdk';

/** Una llamada a un contrato dentro de una transacción. */
export interface Invocacion {
  contrato: string;
  funcion: string;
  /** Argumentos ya convertidos a valores de JS (Address → "G…", u64/i128 → bigint, enum → ["Cliente"]). */
  args: unknown[];
  /** Cuenta que paga la transacción (la que firma la operación). */
  fuente: string;
}

/** Transacción simple a partir de su XDR (si es fee bump, la de adentro). */
export function transaccionDeXdr(xdrBase64: string, passphrase: string): Transaction {
  const tx = TransactionBuilder.fromXDR(xdrBase64, passphrase);
  return tx instanceof FeeBumpTransaction ? tx.innerTransaction : tx;
}

/** Lee la primera operación de la transacción si es una llamada a un contrato. */
export function invocacionDe(tx: Transaction): Invocacion | null {
  const op = tx.operations[0];
  if (!op || op.type !== 'invokeHostFunction' || tx.operations.length !== 1) return null;
  const funcion = op.func;
  if (funcion.type !== 'hostFunctionTypeInvokeContract') return null;
  const llamada = funcion.invokeContract;
  return {
    contrato: Address.fromScAddress(llamada.contractAddress).toString(),
    funcion: llamada.functionName.toString(),
    args: llamada.args.map((a: xdr.ScVal) => scValToNative(a)),
    fuente: op.source ?? tx.source,
  };
}

/**
 * Unidades del USDC (7 decimales) que la transacción manda a `destino`: pagos, pagos con ruta (lo que se
 * asegura que llega) y `transfer` del contrato del token. Sirve para comprobar que una rampa entregó lo que
 * dice, sin creerle a nadie. `activo` es el USDC clásico detrás del SAC (null si el token no es un SAC).
 */
export function usdcRecibido(tx: Transaction, destino: string, activo: { codigo: string; emisor: string } | null, tokenId: string | null): bigint {
  const esUsdc = (a: Asset) => Boolean(activo) && !a.isNative() && a.getCode() === activo!.codigo && a.getIssuer() === activo!.emisor;
  let total = 0n;
  for (const op of tx.operations) {
    if (op.type === 'payment' && op.destination === destino && esUsdc(op.asset)) total += BigInt(usdcAUnidades(op.amount));
    else if (op.type === 'pathPaymentStrictReceive' && op.destination === destino && esUsdc(op.destAsset)) total += BigInt(usdcAUnidades(op.destAmount));
    // Con «strict send» lo exacto queda en el resultado; aquí se cuenta el mínimo que la red garantiza.
    else if (op.type === 'pathPaymentStrictSend' && op.destination === destino && esUsdc(op.destAsset)) total += BigInt(usdcAUnidades(op.destMin));
    else if (op.type === 'invokeHostFunction' && tokenId && op.func.type === 'hostFunctionTypeInvokeContract') {
      const llamada = op.func.invokeContract;
      if (Address.fromScAddress(llamada.contractAddress).toString() !== tokenId || llamada.functionName.toString() !== 'transfer') continue;
      const [, a, monto] = llamada.args.map((v: xdr.ScVal) => scValToNative(v) as unknown);
      if (a === destino && typeof monto === 'bigint' && monto > 0n) total += monto;
    }
  }
  return total;
}

/**
 * Unidades del USDC que llegaron a `destino` según los eventos del SAC (`transfer` y `mint`). Cuenta también lo que
 * llega a través de otro contrato, que no se ve en las operaciones: por ejemplo el puente CCTP de Circle, cuyo
 * `CctpForwarder` acuña el USDC y lo reenvía. Tópicos (SEP-41/CAP-67): ["transfer", from, to, activo] y
 * ["mint", to, activo]; el dato es el monto (i128) o, con dirección muxed, un mapa { amount, to_muxed_id }.
 */
export function usdcRecibidoEnEventos(eventos: readonly xdr.ContractEvent[], destino: string, tokenId: string): bigint {
  let total = 0n;
  for (const ev of eventos) {
    if (!ev.contractId || Address.contract(ev.contractId.toBytes()).toString() !== tokenId) continue;
    const cuerpo = ev.body.v0;
    const topicos = cuerpo.topics.map((t: xdr.ScVal) => scValToNative(t) as unknown);
    const a = topicos[0] === 'transfer' ? topicos[2] : topicos[0] === 'mint' ? topicos[1] : null;
    if (a !== destino) continue;
    const dato = scValToNative(cuerpo.data) as unknown;
    const monto = typeof dato === 'bigint' ? dato : (dato as { amount?: unknown } | null)?.amount;
    if (typeof monto === 'bigint' && monto > 0n) total += monto;
  }
  return total;
}

export function invocacionDeSobre(sobre: xdr.TransactionEnvelope, passphrase: string): Invocacion | null {
  return invocacionDe(transaccionDeXdr(sobre.toXDR('base64'), passphrase));
}

/** Hash de la transacción en hexadecimal (no depende de las firmas). */
export function hashDe(tx: Transaction): string {
  return Buffer.from(tx.hash()).toString('hex');
}

// ---------------------------------------------------------------
// Argumentos para armar llamadas
// ---------------------------------------------------------------

export const arg = {
  direccion: (g: string) => new Address(g).toScVal(),
  u64: (n: bigint | number | string) => nativeToScVal(BigInt(n), { type: 'u64' }),
  u32: (n: number) => nativeToScVal(n, { type: 'u32' }),
  i128: (n: bigint | string) => nativeToScVal(BigInt(n), { type: 'i128' }),
  /** Enum sin datos de Rust (Parte::Cliente, Resultado::Mitad…). */
  variante: (nombre: string) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(nombre)]),
  bytes32: (hex: string) => {
    if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('La huella debe tener 64 caracteres hexadecimales');
    return xdr.ScVal.scvBytes(Buffer.from(hex, 'hex'));
  },
  /** Struct de Rust: un mapa con las llaves ordenadas (así lo exige Soroban). */
  estructura: (campos: Record<string, xdr.ScVal>) =>
    xdr.ScVal.scvMap(
      Object.keys(campos)
        .sort()
        .map((k) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: campos[k] })),
    ),
  lista: (valores: xdr.ScVal[]) => xdr.ScVal.scvVec(valores),
};

/** Nombre de la variante de un enum leído con scValToNative (["Pagado"] → "Pagado"). */
export function variante(valor: unknown): string | null {
  if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0];
  if (typeof valor === 'string') return valor;
  return null;
}

/** Código de error del contrato dentro de un mensaje de simulación ("Error(Contract, #7)" → 7). */
export function codigoErrorContrato(mensaje: string): number | null {
  const m = /Error\(Contract, #(\d+)\)/.exec(mensaje);
  return m ? Number(m[1]) : null;
}

/**
 * Contrato donde nació el error de una simulación. Si el escrow llama al token y el token falla,
 * el error sube con el número del token: hay que saber de quién es antes de traducirlo.
 * Los eventos van del más nuevo al más viejo; el último «failing with contract error» es el original.
 */
export function contratoOrigenDelError(mensaje: string): string | null {
  const origenes = [...mensaje.matchAll(/contract:(C[A-Z2-7]{55}), topics:\[error, Error\(Contract, #\d+\)\], data:\["failing with contract error"/g)];
  return origenes.length ? origenes[origenes.length - 1][1] : null;
}

/**
 * Cuenta sin trustline según el error del Stellar Asset Contract («trustline entry is missing for account G…»).
 * Devuelve '' si el error es de trustline pero no trae la cuenta, y null si no es un error de trustline.
 */
export function cuentaSinTrustline(mensaje: string): string | null {
  if (!/trustline entry is missing for account/.test(mensaje)) return null;
  return /trustline entry is missing for account[^G]*(G[A-Z2-7]{55})/.exec(mensaje)?.[1] ?? '';
}

/** Compara dos valores leídos de la red (bigint, string o número) sin perder precisión. */
export function mismoValor(a: unknown, b: unknown): boolean {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  try {
    return BigInt(a as string | number | bigint) === BigInt(b as string | number | bigint);
  } catch {
    return String(a) === String(b);
  }
}
