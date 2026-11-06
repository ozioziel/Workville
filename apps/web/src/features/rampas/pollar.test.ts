// Rampa con Pollar con un cliente falso: rutas, cotización, datos del proveedor, orden, pantalla de pago,
// firmas de tramos, co-firma y fallas. No habla con Pollar ni con la red.
import { USDC_CIRCLE } from '@cryptoville/shared';
import type { RampOrder, RampQuote, RampQuoteRejection, RampRoute, RampSignatureAction } from '@pollar/core';
import { Account, Asset, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { describe, expect, it, vi } from 'vitest';
import { aprobarCofirma, cotizarRecarga, crearOrden, prepararFirmas, rutasDeRecarga, vistaOrden, type ClienteRampa } from './pollar';

const EMISOR = USDC_CIRCLE.testnet.emisor;
const YO = Keypair.random();

const usdc = (identifier: string | null = EMISOR, code = 'USDC') => ({ kind: 'asset' as const, code, identifier, chain: 'STELLAR' as const });
const fiat = (country: string, currency: string, rail: RampRoute['fiat']['rail']) => ({ kind: 'fiat' as const, country, currency, rail });
const ruta = (country: string, currency: string, rail: RampRoute['fiat']['rail'], asset = usdc()): RampRoute => ({
  fiat: fiat(country, currency, rail),
  asset,
  legs: ['PROVIDER_ONRAMP'],
});

function cotizacion(cambios: Partial<RampQuote> = {}, wallet = YO.publicKey(), campos: RampQuote['legs'][number]['requiredFields'] = []): RampQuote {
  return {
    quoteId: 'q_1',
    expiresAt: '2026-11-06T20:00:00Z',
    amountIn: '70.35',
    amountOut: '10',
    etaSeconds: 300,
    legs: [
      {
        index: 0,
        kind: 'PROVIDER_ONRAMP',
        from: fiat('BO', 'BOB', 'QR'),
        to: usdc(),
        amountIn: '70.35',
        amountOut: '10',
        providerFees: [
          { beneficiary: 'PROVIDER', payer: 'END_USER', settlement: 'INLINE', basis: 'FIAT_AMOUNT', basisAmount: '70', basisCurrency: 'BOB', amount: '0.50', currency: 'BOB', usdValue: null },
          { beneficiary: 'POLLAR', payer: 'END_USER', settlement: 'INLINE', basis: 'FIAT_AMOUNT', basisAmount: '70', basisCurrency: 'BOB', amount: '0.20', currency: 'BOB', usdValue: null },
          { beneficiary: 'APPLICATION', payer: 'APPLICATION', settlement: 'CREDITS', basis: 'FIAT_AMOUNT', basisAmount: '70', basisCurrency: 'BOB', amount: '9', currency: 'BOB', usdValue: null },
        ],
        fees: [],
        etaSeconds: 300,
        expiresAt: null,
        wallet: { chain: 'STELLAR', address: wallet, mode: 'COSIGNED', signs: true },
        requiredFields: campos,
      },
    ],
    ...cambios,
  };
}

type Tramo = RampOrder['legs'][number];
const tramo = (cambios: Partial<Tramo> = {}): Tramo => ({
  index: 0,
  kind: 'PROVIDER_ONRAMP',
  status: 'RUNNING',
  from: fiat('BO', 'BOB', 'QR'),
  to: usdc(),
  amountInPlanned: '70.35',
  amountOutPlanned: '10',
  amountInActual: null,
  amountOutActual: null,
  onchainTxHash: null,
  signingMode: null,
  fundsLocation: null,
  failure: null,
  steps: [],
  etaSeconds: 300,
  startedAt: null,
  ...cambios,
});

function orden(cambios: Partial<RampOrder> = {}): RampOrder {
  return { id: 'ord_1', direction: 'ONRAMP', state: 'awaiting_payment', createdAt: '', updatedAt: '', legs: [tramo()], pendingAction: null, failure: null, nextPollAfter: '2026-11-06T20:00:00Z', ...cambios } as RampOrder;
}

describe('rutas de recarga', () => {
  it('solo los países encendidos, en su moneda, con el USDC de Circle en Stellar, y primero el método del país', async () => {
    const c = {
      getRampRoutes: vi.fn().mockResolvedValue({
        routes: [
          ruta('BO', 'BOB', 'BANK_TRANSFER'),
          ruta('AR', 'ARS', 'BANK_TRANSFER'),
          ruta('BO', 'BOB', 'QR'),
          ruta('BO', 'USD', 'QR'),
          ruta('BO', 'BOB', 'QR', usdc(Keypair.random().publicKey())),
          ruta('BO', 'BOB', 'QR', usdc(EMISOR, 'USDT')),
          ruta('BR', 'BRL', 'PIX'),
        ],
      }),
    };
    const rutas = await rutasDeRecarga(c, ['BO', 'AR'], EMISOR);
    expect(c.getRampRoutes).toHaveBeenCalledWith('ONRAMP');
    expect(rutas.map((r) => `${r.pais.pais}:${r.ruta.fiat.rail}`)).toEqual(['BO:QR', 'BO:BANK_TRANSFER', 'AR:BANK_TRANSFER']);
  });
});

describe('cotizar', () => {
  const bolivia = { pais: { pais: 'BO', nombre: 'Bolivia', moneda: 'BOB', metodo: 'QR' as const, etiquetaMetodo: 'QR de tu banco', activo: true }, ruta: ruta('BO', 'BOB', 'QR') };

  it('pide el monto que tiene que llegar en USDC y resume la comisión que paga la persona', async () => {
    const c = { quoteRamp: vi.fn().mockResolvedValue({ quotes: [cotizacion()], rejected: [] }) };
    const r = await cotizarRecarga(c, bolivia, '10');
    expect(c.quoteRamp.mock.calls[0][0]).toMatchObject({ direction: 'ONRAMP', amount: { value: '10', denomination: 'out' }, fiat: { country: 'BO', rail: 'QR' } });
    expect(r.tipo === 'lista' && r.resumen).toMatchObject({ pagas: '70.35', recibes: '10', comision: '0.70', moneda: 'BOB', destino: YO.publicKey() });
  });

  it('sin ruta: explica en español y ofrece el paso de wallet en otra red (como Stereum)', async () => {
    const rechazada = (resolutionAction: string, detail?: string): RampQuoteRejection => ({
      legs: [{ index: 0, kind: 'PROVIDER_ONRAMP', from: fiat('BO', 'BOB', 'QR'), to: usdc() }],
      failure: { code: 'X', legIndex: 0, retryable: false, resolutionOwner: 'USER', resolutionAction, detail },
    });
    const c = { quoteRamp: vi.fn().mockResolvedValue({ quotes: [], rejected: [rechazada('set_up_wallet', 'POLYGON')] }) };
    const r = await cotizarRecarga(c, bolivia, '10');
    expect(r).toMatchObject({ tipo: 'sin_ruta', mensaje: expect.stringContaining('Prepara tu wallet'), pasoWallet: { action: 'set_up_wallet', chain: 'POLYGON', boton: 'Preparar mi wallet en Polygon' } });

    c.quoteRamp.mockResolvedValue({ quotes: [], rejected: [rechazada('add_trustline')] });
    expect(await cotizarRecarga(c, bolivia, '10')).toMatchObject({ faltaTrustline: true, mensaje: expect.stringContaining('Activa USDC') });
  });
});

describe('orden', () => {
  const campo = { key: 'document', label: 'Carnet de identidad', type: 'text' as const, pattern: '^[0-9]{5,10}$' };

  it('no sigue si el USDC llegaría a otra wallet ni si falta un dato que pide el proveedor', async () => {
    const c = { createRampOrder: vi.fn().mockResolvedValue(orden()) };
    await expect(crearOrden(c, cotizacion({}, Keypair.random().publicKey()), {}, YO.publicKey())).rejects.toThrow('otra wallet');
    await expect(crearOrden(c, cotizacion({}, YO.publicKey(), [campo]), {}, YO.publicKey())).rejects.toThrow('Completa «Carnet de identidad»');
    await expect(crearOrden(c, cotizacion({}, YO.publicKey(), [campo]), { document: 'abc' }, YO.publicKey())).rejects.toThrow('Revisa «Carnet de identidad»');
    expect(c.createRampOrder).not.toHaveBeenCalled();

    await crearOrden(c, cotizacion({}, YO.publicKey(), [campo]), { document: ' 1234567 ' }, YO.publicKey());
    expect(c.createRampOrder).toHaveBeenCalledWith({ quoteId: 'q_1', payee: { document: '1234567' } });
  });

  it('pantalla de pago: el QR del proveedor, el monto y el texto para pagar sin escanear', () => {
    const v = vistaOrden(
      orden({
        pendingAction: {
          kind: 'FIAT_PAYMENT',
          actionId: 'a1',
          legIndex: 0,
          instructions: {
            kind: 'qr',
            payload: '000201…',
            amount: '70.35',
            currency: 'BOB',
            scannable: { kind: 'opaque', payload: '000201…', payloadLabel: 'Código QR', image: { mediaType: 'image/svg+xml', encoding: 'utf8', data: '<svg/>', inlineSafe: true } },
          },
          expiresAt: '2099-01-01T00:00:00Z',
        },
      }),
    );
    expect(v).toMatchObject({ estado: 'esperando_pago', titulo: 'Paga 70.35 BOB', tipoAccion: 'FIAT_PAYMENT', qr: { svg: '<svg/>' }, textoQr: { etiqueta: 'Código QR' }, pagoCerrado: false });
  });

  it('una transferencia muestra sus datos y la referencia en español', () => {
    const v = vistaOrden(
      orden({
        pendingAction: {
          kind: 'FIAT_PAYMENT',
          actionId: 'a1',
          legIndex: 0,
          instructions: { kind: 'bank_transfer', amount: '1000', currency: 'ARS', details: [{ label: 'CVU', value: '0000003100' }], reference: 'REF-9' },
          expiresAt: null,
        },
      }),
    );
    expect(v.datos).toEqual([
      { etiqueta: 'CVU', valor: '0000003100' },
      { etiqueta: 'Referencia', valor: 'REF-9' },
    ]);
  });

  it('firma, co-firma y KYC del proveedor', () => {
    const firma = vistaOrden(
      orden({ pendingAction: { kind: 'SIGNATURE', actionId: 'a2', legIndex: 1, chain: 'STELLAR', payload: { encoding: 'xdr', value: 'AAAA' }, summary: 'withdrawal_payment', expiresAt: '2099-01-01T00:00:00Z' } }),
    );
    expect(firma).toMatchObject({ titulo: 'Autoriza el envío', puedeFirmar: true, actionId: 'a2' });
    const cofirma = vistaOrden(orden({ pendingAction: { kind: 'COSIGN_APPROVAL', actionId: 'a3', legIndex: 1, cosignRequestId: 'cs_1', summary: '' } }));
    expect(cofirma).toMatchObject({ puedeAprobar: true, cosignId: 'cs_1' });
    const kyc = vistaOrden(orden({ pendingAction: { kind: 'KYC', actionId: 'a4', legIndex: 0, steps: [], url: 'https://proveedor.example/kyc' } }));
    expect(kyc).toMatchObject({ titulo: 'Verifica tu identidad con el proveedor', enlace: { url: 'https://proveedor.example/kyc', texto: 'Verificar mi identidad' } });
  });

  it('completada: la transacción del último tramo es la que la API lee en la red', () => {
    const hash = 'cd'.repeat(32);
    const v = vistaOrden(
      orden({
        state: 'completed',
        legs: [tramo({ status: 'DONE' }), tramo({ index: 1, kind: 'SWAP', from: usdc(EMISOR, 'USDT'), status: 'DONE', amountOutActual: '9.98', onchainTxHash: hash })],
        nextPollAfter: null,
      }),
    );
    expect(v).toMatchObject({ estado: 'completada', hashUsdc: hash, detenida: true, recibes: { monto: '9.98', estimado: false } });
    expect(v.tramos.map((t) => t.titulo)).toEqual(['Comprar USDC en Stellar', 'Convertir USDT a USDC']);
  });

  it('una falla se explica en español y dice si se puede reintentar', () => {
    const v = vistaOrden(
      orden({ state: 'processing', nextPollAfter: null, failure: { legIndex: 0, code: 'X', retryable: true, resolutionOwner: 'USER', resolutionAction: 'sign_again', detail: null } }),
    );
    expect(v).toMatchObject({ falla: 'La firma venció. Vuelve a firmar el paso.', reintentable: true, detenida: true });
  });
});

describe('firmas de los tramos', () => {
  const accion = (fuente: string): RampSignatureAction => {
    const tx = new TransactionBuilder(new Account(fuente, '1'), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({ destination: Keypair.random().publicKey(), asset: new Asset('USDC', EMISOR), amount: '10' }))
      .setTimeout(60)
      .build();
    return { kind: 'SIGNATURE', actionId: 'a', legIndex: 1, chain: 'STELLAR', payload: { encoding: 'xdr', value: tx.toXDR() }, summary: 'withdrawal_payment', expiresAt: '2099-01-01T00:00:00Z' };
  };

  it('solo firma lo que gasta de la wallet de la persona', async () => {
    let manejador: ((a: RampSignatureAction) => Promise<string>) | null = null;
    const c = { registerRampSigningHandler: vi.fn((_cadena, _codificacion, h) => ((manejador = h), () => undefined)) } as unknown as Pick<ClienteRampa, 'registerRampSigningHandler'>;
    const firmar = vi.fn().mockResolvedValue('firmada');
    prepararFirmas(c, YO.publicKey(), firmar);
    expect(c.registerRampSigningHandler).toHaveBeenCalledWith('STELLAR', 'xdr', expect.any(Function));

    await expect(manejador!(accion(YO.publicKey()))).resolves.toBe('firmada');
    await expect(manejador!(accion(Keypair.random().publicKey()))).rejects.toThrow();
    expect(firmar).toHaveBeenCalledTimes(1);
  });

  it('la co-firma se aprueba desde el dispositivo y la orden sigue desde donde quedó', async () => {
    const c = { cosign: { approve: vi.fn().mockResolvedValue({}) }, retryRampOrder: vi.fn().mockResolvedValue(orden()) };
    const v = vistaOrden(orden({ pendingAction: { kind: 'COSIGN_APPROVAL', actionId: 'a3', legIndex: 1, cosignRequestId: 'cs_1', summary: '' } }));
    await aprobarCofirma(c as unknown as Pick<ClienteRampa, 'cosign' | 'retryRampOrder'>, v);
    expect(c.cosign.approve).toHaveBeenCalledWith('cs_1');
    expect(c.retryRampOrder).toHaveBeenCalledWith('ord_1');
  });
});
