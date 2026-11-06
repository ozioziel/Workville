// Evento ConfigActualizada del contrato v2: lo publica cada función del admin (set_comision, set_arbitro,
// set_tesoreria, set_plazo_*, set_tope, pausar…). Como el admin es una multifirma que se usa desde Stellar Lab,
// la API se entera por el evento y avisa al equipo, sobre todo si el contrato ya no coincide con el .env.
import type { Configuracion } from '../config/configuracion';

/** Datos del evento `config_actualizada` (ya convertidos con scValToNative). */
export interface ConfigActualizada {
  arbitro: string;
  tesoreria: string;
  comision_bps: number;
  comision_directo_bps: number;
  plazo_revision_seg: bigint | number;
  plazo_disputa_seg: bigint | number;
  tope_pedido: bigint | number;
  pausado: boolean;
}

export const EVENTO_CONFIG = 'config_actualizada';

/** Lo que dejó de coincidir con el .env (mismo criterio que la revisión de arranque en mainnet). */
export function diferenciasConEnv(c: ConfigActualizada, s: Configuracion['stellar']): string[] {
  const diferencias: string[] = [];
  if (s.arbitro && c.arbitro !== s.arbitro) diferencias.push('el árbitro ya no es ARBITRO_DIRECCION');
  if (s.tesoreria && c.tesoreria !== s.tesoreria) diferencias.push('la tesorería ya no es TESORERIA_DIRECCION');
  if (Number(c.comision_bps) !== s.comisionBps) diferencias.push('la comisión ya no es COMISION_BPS');
  if (Number(c.plazo_revision_seg) !== s.plazoRevisionSeg) diferencias.push('el plazo de revisión ya no es PLAZO_REVISION_SEG');
  return diferencias;
}

/** Texto del aviso para el equipo. */
export function textoCambioDeConfig(c: ConfigActualizada, diferencias: string[]): string {
  const partes = ['El admin cambió la configuración del contrato v2.'];
  if (c.pausado) partes.push('El contrato está en pausa: no se pueden crear pedidos.');
  partes.push(diferencias.length ? `Hay que actualizar el .env del servidor: ${diferencias.join(', ')}.` : 'Sigue coincidiendo con el .env del servidor.');
  return partes.join(' ');
}
