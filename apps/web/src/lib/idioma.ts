// Idioma del sitio informativo y de la portada. La villa y sus paneles siguen en español.
import { useSyncExternalStore } from 'react';

export type Idioma = 'es' | 'en' | 'pt';

/** Cada idioma se nombra en su propio idioma, sin banderas: un idioma no es un país. */
export const IDIOMAS: readonly { id: Idioma; codigo: string; nombre: string }[] = [
  { id: 'es', codigo: 'ES', nombre: 'Español' },
  { id: 'en', codigo: 'EN', nombre: 'English' },
  { id: 'pt', codigo: 'PT', nombre: 'Português' },
];

const CLAVE = 'workville-idioma';

const esIdioma = (valor: string | null | undefined): valor is Idioma => IDIOMAS.some((i) => i.id === valor);

/** Lo elegido antes manda; si no hay nada, el primer idioma del navegador que tengamos y, al final, español. */
export function detectarIdioma(guardado: string | null, navegador: readonly string[]): Idioma {
  if (esIdioma(guardado)) return guardado;
  for (const preferido of navegador) {
    const base = preferido.toLowerCase().split('-')[0];
    if (esIdioma(base)) return base;
  }
  return 'es';
}

function leerGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

let actual: Idioma = detectarIdioma(leerGuardado(), typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]));
const oyentes = new Set<() => void>();

const marcarDocumento = () => {
  if (typeof document !== 'undefined') document.documentElement.lang = actual;
};
marcarDocumento();

export function cambiarIdioma(idioma: Idioma): void {
  if (idioma === actual) return;
  actual = idioma;
  try {
    localStorage.setItem(CLAVE, idioma);
  } catch {
    // Sin almacenamiento local: el idioma dura hasta recargar.
  }
  marcarDocumento();
  oyentes.forEach((avisar) => avisar());
}

const suscribir = (avisar: () => void) => {
  oyentes.add(avisar);
  return () => oyentes.delete(avisar);
};

export const useIdioma = (): Idioma => useSyncExternalStore(suscribir, () => actual);
