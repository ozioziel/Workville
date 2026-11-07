// Lógica de la portada, sin React ni navegador: cuándo se muestra, en qué fase va y cómo se mide.
import { modoDeRuta } from '../../lib/rutas';

/** Qué botón de la portada se usó. */
export type AccionPortada = 'contratar' | 'trabajar' | 'mirar' | 'entrar';

/**
 * portada → saliendo (la cámara se acerca y entran las nubes) → cubierta (la cabina espera a la villa)
 * → abriendo (se abren las nubes) → pista (la ayuda de controles) → fin.
 */
export type FasePortada = 'portada' | 'saliendo' | 'cubierta' | 'abriendo' | 'pista' | 'fin';

export interface EstadoPortada {
  fase: FasePortada;
  accion: AccionPortada | null;
  villaLista: boolean;
  /** La cabina ya cruzó: pasó el tiempo mínimo con las nubes cerradas. */
  esperaCumplida: boolean;
}

export type EventoPortada =
  | { tipo: 'elegir'; accion: AccionPortada; reiniciaVilla: boolean }
  | { tipo: 'cubierto' }
  | { tipo: 'espera-cumplida' }
  | { tipo: 'villa-lista' }
  /** La villa tardó demasiado: se abre igual, para no dejar a nadie mirando las nubes. */
  | { tipo: 'tope' }
  | { tipo: 'abierto'; conPista: boolean }
  | { tipo: 'terminar' }
  /** Se volvió a `/` con el botón «Atrás» del navegador. */
  | { tipo: 'volver' };

/** Milisegundos desde el clic. Coinciden con el marco «1b / Transición a la villa» de Figma. */
export const TIEMPOS = {
  cubrir: 1300,
  esperaMinima: 2300,
  tope: 9000,
  aterrizar: 650,
  abrir: 1100,
  pista: 2900,
} as const;

export const TIEMPOS_SIN_MOVIMIENTO = { ...TIEMPOS, cubrir: 0, esperaMinima: 300, aterrizar: 0, abrir: 0 } as const;

export const estadoInicial = (activa: boolean): EstadoPortada => ({
  fase: activa ? 'portada' : 'fin',
  accion: null,
  villaLista: false,
  esperaCumplida: false,
});

const siPuedeAbrir = (e: EstadoPortada): EstadoPortada => (e.fase === 'cubierta' && e.villaLista && e.esperaCumplida ? { ...e, fase: 'abriendo' } : e);

export function reducirPortada(e: EstadoPortada, ev: EventoPortada): EstadoPortada {
  switch (ev.tipo) {
    case 'elegir':
      if (e.fase !== 'portada') return e;
      return { ...e, fase: 'saliendo', accion: ev.accion, villaLista: e.villaLista && !ev.reiniciaVilla, esperaCumplida: false };
    case 'cubierto':
      return siPuedeAbrir(e.fase === 'saliendo' ? { ...e, fase: 'cubierta' } : e);
    case 'espera-cumplida':
      return siPuedeAbrir({ ...e, esperaCumplida: true });
    case 'villa-lista':
    case 'tope':
      return siPuedeAbrir({ ...e, villaLista: true });
    case 'abierto':
      if (e.fase !== 'abriendo') return e;
      // Quien pidió «Entrar» sigue a la bienvenida: ahí no hace falta la pista.
      return { ...e, fase: ev.conPista && e.accion !== 'entrar' ? 'pista' : 'fin' };
    case 'terminar':
      return { ...e, fase: 'fin' };
    case 'volver':
      return { ...e, fase: 'portada', accion: null, esperaCumplida: false };
  }
}

const ENLACES_DIRECTOS = ['pedido', 'se-busca', 'correo', 'kyc'];

/** El enlace lleva a algo concreto (un pedido, un correo…), no a la portada. */
export function esEnlaceDirecto(busqueda: string): boolean {
  const p = new URLSearchParams(busqueda);
  return ENLACES_DIRECTOS.some((clave) => p.has(clave));
}

/** `/` siempre es la portada, también con sesión. Las rutas de las villas y los enlaces directos van sin ella. */
export function debeMostrarPortada(ruta: string, busqueda: string): boolean {
  return !modoDeRuta(ruta) && !esEnlaceDirecto(busqueda);
}

export interface MedidasPortada {
  /** Escala del paisaje (1440 × 900 en Figma), anclado abajo. */
  escala: number;
  /** Desplazamiento horizontal del paisaje cuando no entra entero. */
  desplazamiento: number;
  /** Escala de los textos en pantallas anchas; en el celular van con tamaños propios. */
  texto: number;
  /** Escala de la cortina de nubes, que siempre cubre toda la pantalla. */
  cortina: number;
  movil: boolean;
}

/** Centro del pueblo en el paisaje: es lo que se mantiene a la vista cuando hay que recortar. */
const CENTRO_PUEBLO = 800;
/** Distancia desde abajo hasta los banderines, lo primero que podría chocar con los botones. */
const ALTO_PUEBLO = 348;
/** Hasta dónde llegan los botones en el diseño. */
const ALTO_TEXTOS = 505;

export function medirPortada(ancho: number, alto: number): MedidasPortada {
  const movil = ancho < 760;
  const escala = Math.max(ancho / 1440, Math.min(alto / 900, 0.62));
  const anchoEscena = 1440 * escala;
  const desplazamiento = anchoEscena > ancho ? Math.min(0, Math.max(ancho - anchoEscena, ancho / 2 - CENTRO_PUEBLO * escala)) : 0;
  const disponible = alto - ALTO_PUEBLO * escala;
  const texto = movil ? 1 : Math.min(1.25, Math.max(0.6, Math.min(ancho / 1440, disponible / ALTO_TEXTOS)));
  return { escala, desplazamiento, texto, cortina: Math.max(ancho / 1440, alto / 900), movil };
}
