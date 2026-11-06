// Textos en español de la rampa con Pollar: que cada caso de Pollar diga lo que la persona tiene que hacer.
import { describe, expect, it } from 'vitest';
import { notaTramo, textoFallaOrden, textoPasoWallet, textoRequisito, textoSinRuta, textoSolucion, tituloAccion, tituloTramo } from './pollar-textos';

const usdcStellar = { kind: 'asset' as const, code: 'USDC', identifier: null, chain: 'STELLAR' as const };
const usdtPolygon = { kind: 'asset' as const, code: 'USDT', identifier: null, chain: 'POLYGON' as const };
const bob = { kind: 'fiat' as const, currency: 'BOB' };

describe('textos de la rampa con Pollar', () => {
  it('una acción desconocida de Pollar manda a soporte en vez de quedar sin texto', () => {
    expect(textoSolucion('add_trustline')).toMatch(/Activa USDC/);
    expect(textoSolucion('algo_nuevo')).toBe(textoSolucion('contact_pollar'));
  });

  it('una orden retenida que venció dice que el dinero está a salvo', () => {
    expect(textoFallaOrden({ failure: null, legs: [] })).toBeNull();
    const retenida = textoFallaOrden({ failure: { resolutionAction: 'start_again' }, legs: [{ status: 'HELD' }] as never });
    expect(retenida).toMatch(/a salvo en tu wallet/);
    expect(textoFallaOrden({ failure: { resolutionAction: 'start_again' }, legs: [{ status: 'FAILED' }] as never })).toBe(textoSolucion('start_again'));
  });

  it('nombra cada tramo: comprar, convertir y mandar a otra red', () => {
    expect(tituloTramo({ kind: 'PROVIDER_ONRAMP', from: bob, to: usdtPolygon } as never)).toBe('Comprar USDT en Polygon');
    expect(tituloTramo({ kind: 'SWAP', from: usdtPolygon, to: { ...usdtPolygon, code: 'USDC' } } as never)).toBe('Convertir USDT a USDC');
    expect(tituloTramo({ kind: 'BRIDGE', from: usdtPolygon, to: usdcStellar } as never)).toBe('Mandar a Stellar');
  });

  it('si el proveedor entregó otro activo, aclara que no se pierde nada', () => {
    const tramo = (asset: string) => ({ kind: 'PROVIDER_ONRAMP', to: { ...usdtPolygon, code: 'USDC' }, fundsLocation: { asset } }) as never;
    expect(notaTramo(tramo('USDT'))).toMatch(/no se pierde nada/);
    expect(notaTramo(tramo('usdc'))).toBeNull();
  });

  it('cada verificación pendiente tiene su texto y su botón, salvo las que la persona no puede resolver', () => {
    expect(textoRequisito({ type: 'KYC', status: 'none' } as never)).toEqual({ mensaje: expect.stringMatching(/Verifica tu identidad/), accion: 'Verificar' });
    expect(textoRequisito({ type: 'KYC', status: 'expired' } as never).accion).toBe('Verificar otra vez');
    expect(textoRequisito({ type: 'KYC', status: 'rejected' } as never).accion).toBeNull();
    expect(textoRequisito({ type: 'KYC', status: 'pending', reviewReason: 'DUPLICATE_DOCUMENT' } as never).mensaje).toMatch(/otra cuenta/);
    expect(textoRequisito({ type: 'REGISTRY_CHECK', status: 'pending' } as never).accion).toBeNull();
    expect(textoRequisito({ type: 'FORM', status: 'none' } as never).accion).toBe('Seguir');
  });

  it('sin forma de pago explica por qué: verificación rechazada, en revisión o una sola causa', () => {
    const rechazo = (requirement?: object, accion = 'change_amount') => ({ failure: { resolutionAction: accion }, requirement }) as never;
    expect(textoSinRuta([rechazo({ type: 'KYC', status: 'rejected' })])).toMatch(/no fue aprobada/);
    expect(textoSinRuta([rechazo({ type: 'REGISTRY_CHECK', status: 'pending' })])).toMatch(/en revisión/);
    expect(textoSinRuta([rechazo(), rechazo()])).toBe(textoSolucion('change_amount'));
    expect(textoSinRuta([rechazo(undefined, 'change_amount'), rechazo(undefined, 'add_funds')])).toMatch(/Prueba con otro monto/);
  });

  it('el botón del paso de wallet nombra la red', () => {
    expect(textoPasoWallet({ action: 'set_up_wallet', chain: 'POLYGON' } as never).boton).toBe('Preparar mi wallet en Polygon');
    expect(textoPasoWallet({ action: 'create_wallet' } as never).boton).toBe('Crear mi wallet');
  });

  it('el título de lo que espera la orden incluye el monto a pagar', () => {
    expect(tituloAccion('FIAT_PAYMENT', { amount: '70.35', currency: 'BOB' })).toBe('Paga 70.35 BOB');
    expect(tituloAccion('KYC')).toMatch(/Verifica/);
    expect(tituloAccion(null)).toBe('Procesando');
  });
});
