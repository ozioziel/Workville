// Pruebas unitarias sin red: el aviso cuando el admin (multifirma) cambia la configuración del contrato v2.
import { leerConfiguracion } from '../src/config/configuracion';
import { diferenciasConEnv, textoCambioDeConfig, type ConfigActualizada } from '../src/sincronizacion/config-contrato';

const ARBITRO = 'GBGNHOJB22DVGVJBG47D7NDQVQPSHARIDWYL53R3XTA3GB3TOSBEZDBB';
const TESORERIA = 'GDOHGHXACDYJOLMITRYYN5CNBFEB2XPLA6UCTFBSD4YXV4ZLR7YRILOX';

const stellar = leerConfiguracion({
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'servicio',
  DATABASE_URL: 'postgresql://localhost/db',
  AUTH_PASSWORD_SECRET: 'x'.repeat(40),
  STELLAR_NETWORK: 'testnet',
  ARBITRO_DIRECCION: ARBITRO,
  TESORERIA_DIRECCION: TESORERIA,
  COMISION_BPS: '300',
  PLAZO_REVISION_SEG: '259200',
} as NodeJS.ProcessEnv).stellar;

/** El evento tal como llega del contrato (scValToNative), igual al .env. */
const evento = (cambios: Partial<ConfigActualizada> = {}): ConfigActualizada => ({
  arbitro: ARBITRO,
  tesoreria: TESORERIA,
  comision_bps: 300,
  comision_directo_bps: 100,
  plazo_revision_seg: 259200n,
  plazo_disputa_seg: 1209600n,
  tope_pedido: 0n,
  pausado: false,
  ...cambios,
});

describe('ConfigActualizada', () => {
  it('sin cambios respecto del .env no hay nada que actualizar', () => {
    expect(diferenciasConEnv(evento(), stellar)).toEqual([]);
    expect(textoCambioDeConfig(evento(), [])).toBe('El admin cambió la configuración del contrato v2. Sigue coincidiendo con el .env del servidor.');
  });

  it('dice qué variable del .env quedó desactualizada', () => {
    const otro = 'GDOKY3XXVVHOGLQJUJIOIOWUG2Y5G3LTKUXL7OBAARGCMO5BKBN3P7KT';
    const d = diferenciasConEnv(evento({ arbitro: otro, comision_bps: 250, plazo_revision_seg: 60n }), stellar);
    expect(d).toEqual(['el árbitro ya no es ARBITRO_DIRECCION', 'la comisión ya no es COMISION_BPS', 'el plazo de revisión ya no es PLAZO_REVISION_SEG']);
    expect(textoCambioDeConfig(evento(), d)).toContain('Hay que actualizar el .env del servidor: el árbitro ya no es ARBITRO_DIRECCION');
  });

  it('avisa si el contrato quedó en pausa', () => {
    expect(textoCambioDeConfig(evento({ pausado: true }), [])).toContain('El contrato está en pausa');
  });
});
