import { describe, expect, it } from 'vitest';
import { detectarIdioma } from './idioma';

describe('idioma del sitio', () => {
  it('lo elegido antes manda sobre el navegador', () => {
    expect(detectarIdioma('pt', ['en-US'])).toBe('pt');
  });

  it('sin elección, usa el primer idioma del navegador que tengamos', () => {
    expect(detectarIdioma(null, ['fr-FR', 'pt-BR', 'en'])).toBe('pt');
    expect(detectarIdioma(null, ['EN-gb'])).toBe('en');
  });

  it('un valor guardado desconocido no cuenta y el último recurso es español', () => {
    expect(detectarIdioma('de', ['en'])).toBe('en');
    expect(detectarIdioma(null, ['fr', 'de'])).toBe('es');
    expect(detectarIdioma(null, [])).toBe('es');
  });
});
