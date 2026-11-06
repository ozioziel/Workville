// WorkVille v2: la rampa con Pollar. La orden la crea la web con el SDK de Pollar; la API la registra, sigue su
// estado y al completarse lee en la red el USDC que llegó. Sin red: la verificación en la red está apagada.
import { Keypair } from '@stellar/stellar-sdk';
import { clienteCon, con, usarApp } from './ayudas';

// ayudas.ts apaga los servicios externos; esta prueba enciende Pollar y su rampa (Bolivia y el sandbox de Argentina).
process.env.POLLAR_API_KEY = 'pk_prueba';
process.env.RAMPA_PROVEEDOR = 'pollar';
process.env.RAMPA_POLLAR_PAISES = 'BO,AR';
afterAll(() => {
  process.env.POLLAR_API_KEY = '';
  process.env.RAMPA_PROVEEDOR = '';
  process.env.RAMPA_POLLAR_PAISES = '';
});

const t = usarApp();
let n = 0;
const ordenId = () => `ord_prueba_${Date.now()}_${n++}`;
const HASH = 'ab'.repeat(32);

function orden(direccion: string, cambios: Record<string, unknown> = {}) {
  return { orden_id: ordenId(), sentido: 'entrada', direccion, pais: 'BO', moneda: 'BOB', monto_usdc: '10', monto_local: '70.3456', comision_local: '0.70', estado: 'awaiting_payment', ...cambios };
}

describe('rampa con Pollar', () => {
  it('la configuración pública dice que la rampa es de Pollar y en qué países', async () => {
    const c = await t.http().get('/api/config').expect(200);
    expect(c.body.servicios).toMatchObject({ rampa: 'pollar', rampa_paises: ['BO', 'AR'] });
  });

  it('registra la orden una sola vez, solo con una wallet de la cuenta y solo en los países encendidos', async () => {
    const s = await t.entrar();
    const yo = s.par.publicKey();
    await t.http().post('/api/rampas/pollar/ordenes').set(con(s)).send(orden(Keypair.random().publicKey())).expect(403);
    await t.http().post('/api/rampas/pollar/ordenes').set(con(s)).send(orden(yo, { pais: 'BR', moneda: 'BRL' })).expect(400);
    await t.http().post('/api/rampas/pollar/ordenes').set(con(s)).send(orden(yo, { moneda: 'ARS' })).expect(400);
    // El retiro con Pollar todavía no existe.
    await t.http().post('/api/rampas/pollar/ordenes').set(con(s)).send(orden(yo, { sentido: 'salida' })).expect(400);

    const datos = orden(yo);
    const r = await t.http().post('/api/rampas/pollar/ordenes').set(con(s)).send(datos).expect(201);
    expect(r.body).toMatchObject({ proveedor: 'pollar', estado: 'esperando_pago', referencia: datos.orden_id, moneda: 'BOB', monto_local: '70.35' });
    expect(Number(r.body.tipo_cambio)).toBeCloseTo(7.03456, 5);
    // La misma orden da la misma fila; otra persona no puede registrarla como suya.
    const otraVez = await t.http().post('/api/rampas/pollar/ordenes').set(con(s)).send(datos).expect(201);
    expect(otraVez.body.id).toBe(r.body.id);
    const otra = await t.entrar();
    await t.http().post('/api/rampas/pollar/ordenes').set(con(otra)).send({ ...datos, direccion: otra.par.publicKey() }).expect(403);
    // Por RLS solo la ve su dueño.
    expect((await clienteCon(otra.token).from('rampas').select('id').eq('id', r.body.id)).data).toEqual([]);
  });

  it('sigue los estados de la orden; completada necesita la transacción y después no cambia más', async () => {
    const s = await t.entrar();
    const r = await t.http().post('/api/rampas/pollar/ordenes').set(con(s)).send(orden(s.par.publicKey(), { pais: 'AR', moneda: 'ARS' })).expect(201);
    const estado = (cuerpo: object, quien = s) => t.http().post(`/api/rampas/pollar/ordenes/${r.body.id}/estado`).set(con(quien)).send(cuerpo);

    expect((await estado({ estado: 'processing' }).expect(200)).body.estado).toBe('procesando');
    expect((await estado({ estado: 'settling_onchain' }).expect(200)).body.estado).toBe('liquidando');
    const otra = await t.entrar();
    await estado({ estado: 'failed' }, otra).expect(403);
    await estado({ estado: 'completed' }).expect(400);

    const lista = await estado({ estado: 'completed', tx_hash: HASH }).expect(200);
    expect(lista.body).toMatchObject({ estado: 'completada', tx_hash: HASH });
    expect((await estado({ estado: 'failed' }).expect(200)).body.estado).toBe('completada');

    // La misma transacción no sirve para otra recarga.
    const r2 = await t.http().post('/api/rampas/pollar/ordenes').set(con(s)).send(orden(s.par.publicKey())).expect(201);
    await t.http().post(`/api/rampas/pollar/ordenes/${r2.body.id}/estado`).set(con(s)).send({ estado: 'completed', tx_hash: HASH }).expect(409);
  });

  it('un estado desconocido de Pollar cuenta como procesando y una orden nueva nunca nace completada', async () => {
    const s = await t.entrar();
    const r = await t.http().post('/api/rampas/pollar/ordenes').set(con(s)).send(orden(s.par.publicKey(), { estado: 'completed' })).expect(201);
    expect(r.body.estado).toBe('liquidando');
    const e = await t.http().post(`/api/rampas/pollar/ordenes/${r.body.id}/estado`).set(con(s)).send({ estado: 'otro_estado_nuevo' }).expect(200);
    expect(e.body.estado).toBe('procesando');
  });

  it('la rampa simulada queda apagada: no hay QR de mentira', async () => {
    const s = await t.entrar();
    await t.http().post('/api/rampas/entradas').set(con(s)).send({ monto_usdc: '10', direccion: s.par.publicKey() }).expect(503);
  });
});
