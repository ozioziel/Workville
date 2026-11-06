// Pruebas unitarias sin red: el USDC de Circle (SAC), su trustline y la activación desde la app.
import { PASSPHRASE, USDC_CIRCLE, activoDeNombreSac } from '@cryptoville/shared';
import { Account, Asset, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder, scValToNative, type xdr } from '@stellar/stellar-sdk';
import { leerConfiguracion } from '../src/config/configuracion';
import { cuentaSinTrustline } from '../src/stellar/cadena';
import { StellarService } from '../src/stellar/stellar.service';

const ACTIVO = { codigo: USDC_CIRCLE.testnet.codigo, emisor: USDC_CIRCLE.testnet.emisor };
const USDC = new Asset(ACTIVO.codigo, ACTIVO.emisor);

const ENV = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'servicio',
  DATABASE_URL: 'postgresql://localhost/db',
  AUTH_PASSWORD_SECRET: 'x'.repeat(40),
  STELLAR_NETWORK: 'testnet',
  PAYMENT_TOKEN_ID: USDC_CIRCLE.testnet.contrato,
} as NodeJS.ProcessEnv;

/** El servicio de Stellar con el USDC de Circle, sin leer la red (el activo del token ya «leído»). */
function servicio() {
  const s = new StellarService(leerConfiguracion(ENV));
  jest.spyOn(s, 'activoDelToken').mockResolvedValue(ACTIVO);
  return s;
}

/** Una transacción firmada por `quien` con estas operaciones. */
function firmada(quien: Keypair, ...ops: xdr.Operation[]) {
  const b = new TransactionBuilder(new Account(quien.publicKey(), '7'), { fee: BASE_FEE, networkPassphrase: PASSPHRASE.testnet }).setTimeout(300);
  for (const op of ops) b.addOperation(op);
  const tx = b.build();
  tx.sign(quien);
  return tx.toXDR();
}

describe('datos del USDC de Circle', () => {
  it('el contrato de cada red es el SAC de su activo', () => {
    expect(new Asset(USDC_CIRCLE.testnet.codigo, USDC_CIRCLE.testnet.emisor).contractId(Networks.TESTNET)).toBe(USDC_CIRCLE.testnet.contrato);
    expect(new Asset(USDC_CIRCLE.mainnet.codigo, USDC_CIRCLE.mainnet.emisor).contractId(Networks.PUBLIC)).toBe(USDC_CIRCLE.mainnet.contrato);
  });

  it('lee el activo del name() de un SAC y no confunde un token propio', () => {
    expect(activoDeNombreSac(`USDC:${ACTIVO.emisor}`)).toEqual(ACTIVO);
    expect(activoDeNombreSac('USDC de prueba')).toBeNull();
    expect(activoDeNombreSac(42)).toBeNull();
  });
});

describe('error de trustline del SAC', () => {
  const cuenta = Keypair.random().publicKey();
  const mensaje =
    'HostError: Error(Contract, #13)\n\nEvent log (newest first):\n' +
    `   0: [Diagnostic Event] contract:${USDC_CIRCLE.testnet.contrato}, topics:[error, Error(Contract, #13)], ` +
    `data:["trustline entry is missing for account", ${cuenta}]`;

  it('saca la cuenta que no tiene la trustline', () => {
    expect(cuentaSinTrustline(mensaje)).toBe(cuenta);
    expect(cuentaSinTrustline('trustline entry is missing for account')).toBe('');
    expect(cuentaSinTrustline('HostError: Error(Contract, #10)')).toBeNull();
  });

  it('el #13 del token no se traduce como el #13 del escrow (plan inválido)', () => {
    const s = servicio() as unknown as { errorDeSimulacion(e: unknown): Error };
    const texto = s.errorDeSimulacion(new Error(mensaje)).message;
    expect(texto).toContain('todavía no acepta USDC');
    expect(texto).toContain(cuenta.slice(-5));
    expect(texto).not.toMatch(/plan/i);
  });
});

describe('activar USDC desde la app', () => {
  it('acepta solo la trustline del USDC de Circle y devuelve quién firma', async () => {
    const yo = Keypair.random();
    await expect(servicio().revisarTrustlineFirmada(firmada(yo, Operation.changeTrust({ asset: USDC })))).resolves.toBe(yo.publicKey());
  });

  it.each([
    ['otro activo', () => [Operation.changeTrust({ asset: new Asset('USDC', Keypair.random().publicKey()) })]],
    ['cerrar la trustline (límite 0)', () => [Operation.changeTrust({ asset: USDC, limit: '0' })]],
    ['con un límite', () => [Operation.changeTrust({ asset: USDC, limit: '100' })]],
    ['un pago', () => [Operation.payment({ destination: Keypair.random().publicKey(), asset: USDC, amount: '1' })]],
    ['una operación de más', () => [Operation.changeTrust({ asset: USDC }), Operation.payment({ destination: Keypair.random().publicKey(), asset: USDC, amount: '1' })]],
    ['la operación a nombre de otra cuenta', () => [Operation.changeTrust({ asset: USDC, source: Keypair.random().publicKey() })]],
  ])('rechaza %s', async (_, ops) => {
    await expect(servicio().revisarTrustlineFirmada(firmada(Keypair.random(), ...ops()))).rejects.toThrow('no es la activación de USDC');
  });

  it('con un token propio (sin SAC) no hay nada que activar', async () => {
    const s = new StellarService(leerConfiguracion(ENV));
    jest.spyOn(s, 'activoDelToken').mockResolvedValue(null);
    await expect(s.tieneTrustline(Keypair.random().publicKey())).resolves.toBe(true);
    await expect(s.exigirTrustlines([{ direccion: Keypair.random().publicKey(), quien: 'Tu wallet', solucion: '' }])).resolves.toBeUndefined();
  });

  it('dice quién no acepta USDC antes de armar el pago', async () => {
    const s = servicio();
    const proveedor = Keypair.random().publicKey();
    jest.spyOn(s, 'tieneTrustline').mockImplementation(async (d) => d !== proveedor);
    await expect(
      s.exigirTrustlines([
        { direccion: Keypair.random().publicKey(), quien: 'Tu wallet', solucion: 'actívala.' },
        { direccion: proveedor, quien: 'La wallet de cobro del proveedor', solucion: 'avísale.' },
      ]),
    ).rejects.toThrow('La wallet de cobro del proveedor todavía no acepta USDC (le falta la trustline): avísale.');
  });
});

describe('rampa simulada: la caja manda el USDC', () => {
  const caja = Keypair.random();
  const persona = Keypair.random().publicKey();

  /** El servicio con la rampa simulada encendida, sin red: `preparar` y `enviar` de mentira. */
  function conCaja(env: NodeJS.ProcessEnv = { ...ENV, RAMPA_PROVEEDOR: 'simulada' }) {
    const s = new StellarService(leerConfiguracion(env));
    const xdrDeMentira = firmada(caja, Operation.changeTrust({ asset: USDC }));
    const preparar = jest.spyOn(s, 'preparar').mockResolvedValue({ xdr: xdrDeMentira, hash: 'h' } as never);
    jest.spyOn(s, 'enviar').mockResolvedValue({} as never);
    return { s, preparar };
  }

  it('solo llama a transfer del token de pago, desde la caja', async () => {
    const { s, preparar } = conCaja();
    await s.pagarDesdeCaja(caja.secret(), persona, '100000000');
    expect(preparar).toHaveBeenCalledTimes(1);
    const [fuente, contrato, funcion, args] = preparar.mock.calls[0];
    expect([fuente, contrato, funcion]).toEqual([caja.publicKey(), USDC_CIRCLE.testnet.contrato, 'transfer']);
    expect((args as xdr.ScVal[]).map((a) => scValToNative(a))).toEqual([caja.publicKey(), persona, 100000000n]);
  });

  it('no manda sin la rampa simulada, a la misma caja ni un monto de 0', async () => {
    await expect(conCaja(ENV).s.pagarDesdeCaja(caja.secret(), persona, '1')).rejects.toThrow('solo existe en testnet');
    await expect(conCaja().s.pagarDesdeCaja(caja.secret(), caja.publicKey(), '1')).rejects.toThrow('a sí misma');
    await expect(conCaja().s.pagarDesdeCaja(caja.secret(), persona, '0')).rejects.toThrow('mayor que 0');
  });
});
