// Rutas de la web: `/` es la portada y cada modo de la villa tiene la suya.
import type { ModoVilla } from '../game/EventBus';

const RUTA_DE_MODO: Record<ModoVilla, string> = {
  contratar: '/contratar',
  trabajar: '/trabajar',
};

export const rutaDeModo = (modo: ModoVilla): string => RUTA_DE_MODO[modo];

/** Las páginas informativas del sitio. */
export type PaginaSitio = 'quees' | 'como' | 'villas' | 'comisiones';

const RUTA_DE_PAGINA: Record<PaginaSitio, string> = {
  quees: '/que-es',
  como: '/como-funciona',
  villas: '/villas',
  comisiones: '/comisiones',
};

export const rutaDePagina = (pagina: PaginaSitio): string => RUTA_DE_PAGINA[pagina];

const sinBarraFinal = (ruta: string): string => ruta.replace(/\/+$/, '') || '/';

/** El modo que indica la ruta, o `null` si la ruta no es de ninguna villa. */
export function modoDeRuta(ruta: string): ModoVilla | null {
  const limpia = sinBarraFinal(ruta);
  if (limpia === RUTA_DE_MODO.contratar) return 'contratar';
  if (limpia === RUTA_DE_MODO.trabajar) return 'trabajar';
  return null;
}

/** La página informativa que indica la ruta, o `null` si la ruta no es de ninguna. */
export function paginaDeRuta(ruta: string): PaginaSitio | null {
  const limpia = sinBarraFinal(ruta);
  const pagina = (Object.keys(RUTA_DE_PAGINA) as PaginaSitio[]).find((p) => RUTA_DE_PAGINA[p] === limpia);
  return pagina ?? null;
}

/** La forma correcta de una ruta: `/trabajar/` pasa a `/trabajar` y lo desconocido, a la portada. */
export function rutaNormalizada(ruta: string): string {
  const modo = modoDeRuta(ruta);
  if (modo) return RUTA_DE_MODO[modo];
  const pagina = paginaDeRuta(ruta);
  return pagina ? RUTA_DE_PAGINA[pagina] : '/';
}

/** Corrige la dirección al arrancar, sin dejar una entrada de más en el historial. */
export function normalizarRutaActual(): void {
  const correcta = rutaNormalizada(location.pathname);
  if (correcta !== location.pathname) history.replaceState(null, '', correcta + location.search + location.hash);
}
