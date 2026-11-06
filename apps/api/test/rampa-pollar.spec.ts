// Pruebas unitarias sin red: cuánto USDC entrega una transacción (para verificar lo que dice la rampa de Pollar).
import { PASSPHRASE, USDC_CIRCLE } from '@cryptoville/shared';
import { Account, Address, Asset, BASE_FEE, Contract, Keypair, Operation, TransactionBuilder, nativeToScVal, type xdr } from '@stellar/stellar-sdk';
import { usdcRecibido } from '../src/stellar/cadena';

const ACTIVO = { codigo: USDC_CIRCLE.testnet.codigo, emisor: USDC_CIRCLE.testnet.emisor };
const USDC = new Asset(ACTIVO.codigo, ACTIVO.emisor);
const TOKEN = USDC_CIRCLE.testnet.contrato;

function tx(...ops: xdr.Operation[]) {
  const b = new TransactionBuilder(new Account(Keypair.random().publicKey(), '1'), { fee: BASE_FEE, networkPassphrase: PASSPHRASE.testnet }).setTimeout(60);
  for (const op of ops) b.addOperation(op);
  return b.build();
}

describe('usdcRecibido', () => {
  const yo = Keypair.random().publicKey();
  const otro = Keypair.random().publicKey();

  it('suma los pagos de USDC a la wallet y no cuenta los de otra wallet ni otro activo', () => {
    const t = tx(
      Operation.payment({ destination: yo, asset: USDC, amount: '10.5' }),
      Operation.payment({ destination: otro, asset: USDC, amount: '99' }),
      Operation.payment({ destination: yo, asset: Asset.native(), amount: '5' }),
      Operation.payment({ destination: yo, asset: new Asset('USDC', Keypair.random().publicKey()), amount: '7' }),
    );
    expect(usdcRecibido(t, yo, ACTIVO, TOKEN)).toBe(105_000_000n);
  });

  it('cuenta los pagos con ruta: lo exacto en «strict receive» y el mínimo en «strict send»', () => {
    const t = tx(
      Operation.pathPaymentStrictReceive({ sendAsset: Asset.native(), sendMax: '100', destination: yo, destAsset: USDC, destAmount: '2', path: [] }),
      Operation.pathPaymentStrictSend({ sendAsset: Asset.native(), sendAmount: '50', destination: yo, destAsset: USDC, destMin: '1.25', path: [] }),
    );
    expect(usdcRecibido(t, yo, ACTIVO, TOKEN)).toBe(32_500_000n);
  });

  it('cuenta un transfer del contrato del USDC (SAC) a la wallet', () => {
    const transfer = (contrato: string, a: string) =>
      new Contract(contrato).call('transfer', new Address(otro).toScVal(), new Address(a).toScVal(), nativeToScVal(30_000_000n, { type: 'i128' }));
    expect(usdcRecibido(tx(transfer(TOKEN, yo)), yo, ACTIVO, TOKEN)).toBe(30_000_000n);
    expect(usdcRecibido(tx(transfer(TOKEN, otro)), yo, ACTIVO, TOKEN)).toBe(0n);
    // Otro contrato con una función «transfer» no es el USDC.
    expect(usdcRecibido(tx(transfer(USDC_CIRCLE.mainnet.contrato, yo)), yo, ACTIVO, TOKEN)).toBe(0n);
  });
});
