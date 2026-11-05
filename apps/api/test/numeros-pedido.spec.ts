// Pruebas sin red de los números de pedido (`nuevoNumero`): rango, que no se repitan ni dependan
// de la hora, que viajen bien por la base, la API, la web y los contratos, y el reintento si chocan.
//
// La seguridad viene del generador criptográfico de Node (`randomBytes`). Las pruebas con muchas
// muestras solo detectan errores groseros (bits fijos, secuencias, la hora); no demuestran que el
// número sea impredecible.
import { argumentosContrato } from '@cryptoville/shared';
import { Account, BASE_FEE, Contract, Keypair, Networks, TransactionBuilder, scValToNative, xdr } from '@stellar/stellar-sdk';
import { ConflictException } from '@nestjs/common';
import crypto = require('node:crypto');
import { serializar } from '../src/common/serializar';
import { Prisma, type Usuario } from '../src/generated/prisma/client';
import { OrdersService, nuevoNumero } from '../src/orders/orders.service';
import { argumentosCrearV2, verificarInvocacionV2 } from '../src/pagos/cadena-v2';
import { arg, invocacionDe, mismoValor } from '../src/stellar/cadena';

const MINIMO = 2n ** 52n;
const MAXIMO_SEGURO = BigInt(Number.MAX_SAFE_INTEGER); // 2^53 - 1
const MAXIMO_BIGINT_POSTGRES = 2n ** 63n - 1n; // BIGINT con signo
const MAXIMO_U64 = 2n ** 64n - 1n;

const muestra = (n: number): bigint[] => Array.from({ length: n }, () => nuevoNumero());

/** Hace que `randomBytes` devuelva estos 8 bytes una sola vez. */
function bytesAlAzar(...bytes: number[]) {
  const espia = jest.spyOn(crypto as unknown as { randomBytes: (n: number) => Buffer }, 'randomBytes');
  espia.mockReturnValueOnce(Buffer.from(bytes));
  return espia;
}

afterEach(() => jest.restoreAllMocks());

describe('nuevoNumero: rango y tipo', () => {
  const numeros = muestra(10_000);

  // Cada prueba junta los números que fallan: si algo se rompe, el mensaje los muestra.
  it('devuelve un bigint entre 2^52 y 2^53 - 1', () => {
    expect(numeros.filter((n) => typeof n !== 'bigint' || n < MINIMO || n > MAXIMO_SEGURO)).toEqual([]);
  });

  it('cabe en el BIGINT con signo de PostgreSQL y en el u64 de los contratos', () => {
    expect(numeros.filter((n) => n <= 0n || n > MAXIMO_BIGINT_POSTGRES || n > MAXIMO_U64)).toEqual([]);
  });

  it('pasa a number de JavaScript sin perder cifras y siempre tiene 16 cifras', () => {
    expect(numeros.filter((n) => !Number.isSafeInteger(Number(n)) || BigInt(Number(n)) !== n)).toEqual([]);
    expect(numeros.filter((n) => String(n).length !== 16)).toEqual([]);
  });
});

describe('nuevoNumero: sale de randomBytes y no de la hora', () => {
  it('usa 8 bytes del generador criptográfico de Node', () => {
    const espia = jest.spyOn(crypto as unknown as { randomBytes: (n: number) => Buffer }, 'randomBytes');
    nuevoNumero();
    expect(espia).toHaveBeenCalledWith(8);
  });

  it('se queda con los 52 bits bajos y fija el bit 2^52', () => {
    bytesAlAzar(0, 0, 0, 0, 0, 0, 0, 0);
    expect(nuevoNumero()).toBe(MINIMO);
    bytesAlAzar(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
    expect(nuevoNumero()).toBe(MAXIMO_SEGURO);
    bytesAlAzar(0, 0, 0, 0, 0, 0, 0, 1);
    expect(nuevoNumero()).toBe(MINIMO + 1n);
    // Los 12 bits altos se descartan: no pueden sacar el número del rango.
    bytesAlAzar(0xff, 0xf0, 0, 0, 0, 0, 0, 0);
    expect(nuevoNumero()).toBe(MINIMO);
  });

  it('con los mismos bytes da el mismo número a cualquier hora', () => {
    const hora = jest.spyOn(Date, 'now');
    hora.mockReturnValue(Date.UTC(2026, 0, 1));
    bytesAlAzar(0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0);
    const antes = nuevoNumero();
    hora.mockReturnValue(Date.UTC(2031, 6, 15, 12, 30));
    bytesAlAzar(0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0);
    expect(nuevoNumero()).toBe(antes);
  });

  it('con la hora detenida sigue dando números distintos', () => {
    // El algoritmo viejo daba como mucho 1000 números distintos en el mismo segundo.
    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 4, 12));
    const numeros = muestra(5_000);
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  it('no tiene la forma vieja (segundos Unix × 1000 + 3 cifras)', () => {
    // La forma vieja: 13 cifras y n / 1000 = segundos de ahora. Los nuevos tienen 16 cifras y
    // n / 1000 queda a miles de años de cualquier fecha razonable, así que la hora real no importa.
    const ahoraSeg = BigInt(Math.floor(Date.now() / 1000));
    const diezAnos = 10n * 365n * 86_400n;
    const pareceViejo = (n: bigint) => String(n).length === 13 || (n / 1000n > ahoraSeg - diezAnos && n / 1000n < ahoraSeg + diezAnos);
    expect(muestra(10_000).filter(pareceViejo)).toEqual([]);
  });
});

describe('nuevoNumero: no se repiten ni van en orden', () => {
  it('100 000 números seguidos no se repiten', () => {
    // Con 2^52 valores posibles, la probabilidad de un choque en 100 000 es de ~1 en un millón.
    const numeros = muestra(100_000);
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  it('no son secuenciales: el siguiente es mayor más o menos la mitad de las veces', () => {
    const numeros = muestra(10_000);
    let suben = 0;
    for (let i = 1; i < numeros.length; i++) if (numeros[i] > numeros[i - 1]) suben++;
    // Lo esperado es ~5000 (desviación ~50). Un contador daría ~9999.
    expect(suben).toBeGreaterThan(4_500);
    expect(suben).toBeLessThan(5_500);
  });

  it('los 52 bits al azar cambian (ninguno queda fijo)', () => {
    const numeros = muestra(20_000);
    for (let bit = 0n; bit < 52n; bit++) {
      const encendidos = numeros.filter((n) => (n >> bit) & 1n).length;
      // Lo esperado es ~10 000 por bit (desviación ~70).
      expect(encendidos).toBeGreaterThan(9_000);
      expect(encendidos).toBeLessThan(11_000);
    }
  });
});

describe('nuevoNumero: compatibilidad con la API, la web y los contratos', () => {
  const cliente = Keypair.random().publicKey();
  const proveedor = Keypair.random().publicKey();
  const CONTRATO = 'CCRQGMOX6H2XSGGCY536IONZNRR47RCPMKH7Z4U3SP3JC5L6HHF7AVS7';

  function invocacion(funcion: string, args: xdr.ScVal[]) {
    const tx = new TransactionBuilder(new Account(cliente, '1'), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(new Contract(CONTRATO).call(funcion, ...args))
      .setTimeout(60)
      .build();
    return invocacionDe(tx)!;
  }

  it('la API (serializar) y Supabase lo entregan como número JSON exacto', () => {
    // serializar() convierte bigint a number; Supabase devuelve BIGINT como número JSON.
    // En los dos casos la web hace JSON.parse y Number(p.numero).
    const cambian = muestra(1_000).filter((n) => {
      const enLaWeb = JSON.parse(JSON.stringify(serializar({ numero: n }))) as { numero: unknown };
      return typeof enLaWeb.numero !== 'number' || BigInt(Number(enLaWeb.numero)) !== n;
    });
    expect(cambian).toEqual([]);
  });

  it('se codifica como u64 del contrato y se lee igual (bigint, texto o number)', () => {
    const leido = (v: bigint | string | number) => scValToNative(arg.u64(v)) as bigint;
    const cambian = muestra(200).filter((n) => leido(n) !== n || leido(String(n)) !== n || leido(Number(n)) !== n);
    expect(cambian).toEqual([]);
  });

  it('el argumento id para Stellar Lab (v1) sale del number de la web sin cambiar', () => {
    const n = nuevoNumero();
    const args = argumentosContrato('crear_pedido', {
      numero: Number(n),
      cliente,
      proveedor,
      montoUsdc: '10',
      fechaLimite: '2030-01-01T00:00:00.000Z',
    });
    expect(args.find((a) => a.nombre === 'id')?.valor).toBe(String(n));
  });

  it('el verificador v1 compara el id de la transacción con el número guardado', () => {
    const n = nuevoNumero();
    const enTx = scValToNative(arg.u64(n));
    expect(mismoValor(enTx, n)).toBe(true);
    expect(mismoValor(enTx, n + 1n)).toBe(false);
  });

  it('el contrato v2 acepta crear el pedido con ese número y rechaza otro', () => {
    const n = nuevoNumero();
    const plan = [{ monto: 100_000_000n, fechaLimiteSeg: 1_900_000_000n }];
    const inv = invocacion('crear_pedido', argumentosCrearV2(cliente, proveedor, n, plan));
    const contexto = { contrato: CONTRATO, walletsCliente: [cliente], walletsProveedor: [proveedor], plan };
    // PagosService pasa el número como texto; también sirve como bigint o number.
    expect(verificarInvocacionV2(inv, 'crear_pedido', { ...contexto, numero: String(n) })).toBeNull();
    expect(verificarInvocacionV2(inv, 'crear_pedido', { ...contexto, numero: n })).toBeNull();
    expect(verificarInvocacionV2(inv, 'crear_pedido', { ...contexto, numero: Number(n) })).toBeNull();
    expect(verificarInvocacionV2(inv, 'crear_pedido', { ...contexto, numero: n + 1n })).toMatch(/número de pedido/);
  });
});

describe('crear un pedido cuando el número choca', () => {
  /** Lo que lanza Prisma 7 cuando el índice único de pedidos.numero rechaza el número. */
  const choque = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the constraint: `pedidos_numero_key`', {
      code: 'P2002',
      clientVersion: 'prueba',
    });

  const cliente = { id: 'cliente-1', nombre: 'Ana' } as Usuario;

  function preparar(create: jest.Mock) {
    const servicio = { id: 'servicio-1', titulo: 'Logo', precio_usdc: '10', activo: true, local: { activo: true, usuario_id: 'proveedor-1' } };
    const prisma = { servicio: { findUnique: jest.fn().mockResolvedValue(servicio) }, pedido: { create } };
    const avisos = { crear: jest.fn().mockResolvedValue(undefined) };
    const moderacion = { exigirSinBloqueo: jest.fn().mockResolvedValue(undefined) };
    const pedidos = new OrdersService(prisma as never, avisos as never, {} as never, moderacion as never);
    return { pedidos, avisos };
  }

  const guardar = async ({ data }: { data: Record<string, unknown> }) => ({ id: 'pedido-1', ...data });
  const numerosUsados = (create: jest.Mock) => create.mock.calls.map(([{ data }]) => data.numero as bigint);

  it('reintenta con otro número y crea el pedido', async () => {
    const create = jest.fn().mockRejectedValueOnce(choque()).mockImplementation(guardar);
    const { pedidos, avisos } = preparar(create);

    const pedido = await pedidos.crear(cliente, 'servicio-1', ' Quiero un logo ');

    expect(create).toHaveBeenCalledTimes(2);
    const [primero, segundo] = numerosUsados(create);
    expect(segundo).not.toBe(primero);
    expect(pedido.numero).toBe(segundo);
    expect(avisos.crear).toHaveBeenCalledTimes(1);
  });

  it('tras 5 choques seguidos responde 409 y no avisa a nadie', async () => {
    const create = jest.fn().mockImplementation(async () => {
      throw choque();
    });
    const { pedidos, avisos } = preparar(create);

    const intento = pedidos.crear(cliente, 'servicio-1', 'Quiero un logo');

    await expect(intento).rejects.toBeInstanceOf(ConflictException);
    await expect(intento).rejects.toThrow('No se pudo crear el pedido, intenta de nuevo');
    expect(create).toHaveBeenCalledTimes(5);
    expect(new Set(numerosUsados(create)).size).toBe(5);
    expect(avisos.crear).not.toHaveBeenCalled();
  });

  it('otro error de la base no se reintenta', async () => {
    const create = jest.fn().mockRejectedValue(new Error('la base no responde'));
    const { pedidos } = preparar(create);

    await expect(pedidos.crear(cliente, 'servicio-1', 'Quiero un logo')).rejects.toThrow('la base no responde');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
