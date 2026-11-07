import { describe, expect, it } from 'vitest';
import { modoDeRuta, rutaDeModo, rutaNormalizada } from './rutas';

describe('rutas de la web', () => {
  it('cada modo tiene su ruta y se puede volver de la ruta al modo', () => {
    expect(rutaDeModo('contratar')).toBe('/contratar');
    expect(rutaDeModo('trabajar')).toBe('/trabajar');
    expect(modoDeRuta(rutaDeModo('contratar'))).toBe('contratar');
    expect(modoDeRuta(rutaDeModo('trabajar'))).toBe('trabajar');
  });

  it('acepta la barra final', () => {
    expect(modoDeRuta('/trabajar/')).toBe('trabajar');
  });

  it('la portada y las rutas desconocidas no son de ningún modo', () => {
    for (const ruta of ['/', '/hola', '/contratar/algo', '/CONTRATAR']) expect(modoDeRuta(ruta)).toBeNull();
  });

  it('corrige las rutas: la barra final se quita y lo desconocido va a la portada', () => {
    expect(rutaNormalizada('/trabajar/')).toBe('/trabajar');
    expect(rutaNormalizada('/contratar')).toBe('/contratar');
    expect(rutaNormalizada('/hola')).toBe('/');
    expect(rutaNormalizada('/')).toBe('/');
  });
});
