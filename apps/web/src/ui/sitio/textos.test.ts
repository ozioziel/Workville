import { describe, expect, it } from 'vitest';
import { TEXTOS, traducir, type ClaveTexto } from './textos';

const CLAVES = Object.keys(TEXTOS.es) as ClaveTexto[];
const huecos = (texto: string) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('textos del sitio', () => {
  it('los tres idiomas tienen los mismos valores por reemplazar en cada texto', () => {
    for (const clave of CLAVES) {
      expect(huecos(TEXTOS.en[clave]), `en: ${clave}`).toEqual(huecos(TEXTOS.es[clave]));
      expect(huecos(TEXTOS.pt[clave]), `pt: ${clave}`).toEqual(huecos(TEXTOS.es[clave]));
    }
  });

  it('cada villa tiene cinco categorías en todos los idiomas', () => {
    for (const idioma of ['es', 'en', 'pt'] as const) {
      for (const villa of ['creativo', 'tech', 'audiovisual', 'academy'] as const) {
        expect(TEXTOS[idioma][`villa.${villa}.cats`].split('|')).toHaveLength(5);
      }
    }
  });

  it('reemplaza los valores y deja a la vista los que faltan', () => {
    expect(traducir('en', 'com.ejemplo.titulo', { monto: 100 })).toBe('On a 100 USDC job:');
    expect(traducir('es', 'com.ejemplo.titulo')).toBe('En un trabajo de {monto} USDC:');
  });
});
