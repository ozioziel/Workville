// WorkVille v2: «pagar con el QR del banco» y «pasar a mi banco» con la rampa SIMULADA (solo testnet).
// Sin red: el pago simulado del banco deja un hash de mentira (en la app de verdad, la caja manda USDC de Circle de testnet).
import { esQrSimulado, leerQrEmv } from '@cryptoville/shared';
import { Keypair } from '@stellar/stellar-sdk';
import { clienteCon, con, usarApp } from './ayudas';

// ayudas.ts apaga los servicios externos; esta prueba enciende solo la rampa simulada.
process.env.RAMPA_PROVEEDOR = 'simulada';
afterAll(() => {
  process.env.RAMPA_PROVEEDOR = '';
});

const t = usarApp();

describe('rampa simulada', () => {
  it('la configuración pública dice que hay rampa simulada', async () => {
    const c = await t.http().get('/api/config').expect(200);
    expect(c.body.servicios.rampa).toBe('simulada');
  });

  it('recarga: cotiza en bolivianos, da un QR de mentira y al «pagar» queda completada una sola vez', async () => {
    const s = await t.entrar();
    const cot = await t.http().post('/api/rampas/cotizacion').set(con(s)).send({ sentido: 'entrada', monto_usdc: '10' }).expect(201);
    expect(cot.body).toMatchObject({ proveedor: 'simulada', moneda: 'BOB', monto_local: '70.30' });
    await t.http().post('/api/rampas/cotizacion').set(con(s)).send({ sentido: 'entrada', monto_usdc: '5000' }).expect(400);

    // Solo a una wallet de la cuenta.
    await t.http().post('/api/rampas/entradas').set(con(s)).send({ monto_usdc: '10', direccion: Keypair.random().publicKey() }).expect(403);
    const r = await t.http().post('/api/rampas/entradas').set(con(s)).send({ monto_usdc: '10', direccion: s.par.publicKey() }).expect(201);
    expect(r.body).toMatchObject({ estado: 'esperando_pago', sentido: 'entrada', proveedor: 'simulada' });
    // QR con formato de QR Simple (EMVCo), con el monto en bolivianos y la marca SIMULADO.
    expect(esQrSimulado(r.body.qr_payload)).toBe(true);
    expect(leerQrEmv(r.body.qr_payload)['54']).toBe('70.30');

    // Otra persona no puede «pagar» la recarga ajena ni verla.
    const otra = await t.entrar();
    await t.http().post(`/api/rampas/entradas/${r.body.id}/simular-pago`).set(con(otra)).expect(403);
    const ajena = await clienteCon(otra.token).from('rampas').select('id').eq('id', r.body.id);
    expect(ajena.data).toEqual([]);
    const propia = await clienteCon(s.token).from('rampas').select('id, estado').eq('id', r.body.id);
    expect(propia.data).toEqual([{ id: r.body.id, estado: 'esperando_pago' }]);

    const pagada = await t.http().post(`/api/rampas/entradas/${r.body.id}/simular-pago`).set(con(s)).expect(201);
    expect(pagada.body.estado).toBe('completada');
    expect(pagada.body.tx_hash).toMatch(/^[0-9a-f]{64}$/);
    // Dos clics no emiten dos veces: la segunda devuelve la misma.
    const otraVez = await t.http().post(`/api/rampas/entradas/${r.body.id}/simular-pago`).set(con(s)).expect(201);
    expect(otraVez.body.tx_hash).toBe(pagada.body.tx_hash);
  });

  it('una recarga que ya se está procesando no se vuelve a mandar', async () => {
    const s = await t.entrar();
    const r = await t.http().post('/api/rampas/entradas').set(con(s)).send({ monto_usdc: '2', direccion: s.par.publicKey() }).expect(201);
    for (const estado of ['procesando', 'liquidando']) {
      await t.prisma.rampa.update({ where: { id: r.body.id }, data: { estado } });
      await t.http().post(`/api/rampas/entradas/${r.body.id}/simular-pago`).set(con(s)).expect(409);
    }
    expect((await t.prisma.rampa.findUniqueOrThrow({ where: { id: r.body.id } })).tx_hash).toBeNull();
  });

  it('un QR vencido ya no se puede pagar', async () => {
    const s = await t.entrar();
    const r = await t.http().post('/api/rampas/entradas').set(con(s)).send({ monto_usdc: '3', direccion: s.par.publicKey() }).expect(201);
    await t.prisma.rampa.update({ where: { id: r.body.id }, data: { expira_en: new Date(Date.now() - 1000) } });
    await t.http().post(`/api/rampas/entradas/${r.body.id}/simular-pago`).set(con(s)).expect(400);
    expect((await t.prisma.rampa.findUniqueOrThrow({ where: { id: r.body.id } })).estado).toBe('vencida');
  });

  it('retiro: banco de la lista y solo se guardan los últimos 4 dígitos de la cuenta', async () => {
    const s = await t.entrar();
    const base = { monto_usdc: '10', direccion: s.par.publicKey(), cuenta: '1234567890' };
    await t.http().post('/api/rampas/salidas').set(con(s)).send({ ...base, banco: 'Banco Inventado' }).expect(400);
    await t.http().post('/api/rampas/salidas').set(con(s)).send({ ...base, banco: 'Banco Unión', cuenta: '12-34' }).expect(400);
    const r = await t.http().post('/api/rampas/salidas').set(con(s)).send({ ...base, banco: 'Banco Unión' }).expect(201);
    // Como una orden de Pollar: la rampa espera el USDC de la persona.
    expect(r.body).toMatchObject({ estado: 'esperando_pago', banco: 'Banco Unión', cuenta_final: '7890', monto_local: '68.9' });
    expect(JSON.stringify(r.body)).not.toContain('1234567890');
  });
});

describe('activar USDC (trustline)', () => {
  it('el saldo dice si la wallet acepta USDC (sin red: no se sabe)', async () => {
    const s = await t.entrar();
    const r = await t.http().get(`/api/rampas/saldo?direccion=${s.par.publicKey()}`).set(con(s)).expect(200);
    expect(r.body).toEqual({ direccion: s.par.publicKey(), saldo_usdc: null, trustline: null });
  });

  it('solo se arma para una wallet de la cuenta, y sin red no se arma', async () => {
    const s = await t.entrar();
    await t.http().post('/api/transacciones/trustline/preparar').set(con(s)).send({ direccion: Keypair.random().publicKey() }).expect(403);
    await t.http().post('/api/transacciones/trustline/preparar').set(con(s)).send({ direccion: 'no-es-una-wallet' }).expect(400);
    await t.http().post('/api/transacciones/trustline/preparar').set(con(s)).send({ direccion: s.par.publicKey() }).expect(503);
    await t.http().post('/api/transacciones/trustline/enviar').set(con(s)).send({ xdr_firmado: 'A'.repeat(200) }).expect(503);
    await t.http().post('/api/transacciones/trustline/preparar').send({ direccion: s.par.publicKey() }).expect(401);
  });
});
