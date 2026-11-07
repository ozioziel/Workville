import { describe, expect, it } from 'vitest';
import { debeMostrarPortada, estadoInicial, medirPortada, reducirPortada, type EstadoPortada, type EventoPortada } from './fases';

const recorrer = (inicio: EstadoPortada, eventos: EventoPortada[]) => eventos.reduce(reducirPortada, inicio);
const elegir = (reiniciaVilla = false): EventoPortada => ({ tipo: 'elegir', accion: 'contratar', reiniciaVilla });

describe('fases de la portada', () => {
  it('abre las nubes solo cuando la villa está lista y la cabina ya cruzó, en cualquier orden', () => {
    const cubierta = recorrer(estadoInicial(true), [elegir(), { tipo: 'cubierto' }]);
    expect(cubierta.fase).toBe('cubierta');
    expect(reducirPortada(cubierta, { tipo: 'villa-lista' }).fase).toBe('cubierta');
    expect(reducirPortada(cubierta, { tipo: 'espera-cumplida' }).fase).toBe('cubierta');
    expect(recorrer(cubierta, [{ tipo: 'villa-lista' }, { tipo: 'espera-cumplida' }]).fase).toBe('abriendo');
    expect(recorrer(cubierta, [{ tipo: 'espera-cumplida' }, { tipo: 'villa-lista' }]).fase).toBe('abriendo');
  });

  it('no abre antes de que las nubes terminen de cerrar, aunque la villa ya esté lista', () => {
    const e = recorrer(estadoInicial(true), [{ tipo: 'villa-lista' }, elegir(), { tipo: 'espera-cumplida' }]);
    expect(e.fase).toBe('saliendo');
    expect(reducirPortada(e, { tipo: 'cubierto' }).fase).toBe('abriendo');
  });

  it('espera una villa nueva si el botón cambió de modo', () => {
    const e = recorrer(estadoInicial(true), [{ tipo: 'villa-lista' }, elegir(true), { tipo: 'cubierto' }, { tipo: 'espera-cumplida' }]);
    expect(e.fase).toBe('cubierta');
    expect(reducirPortada(e, { tipo: 'villa-lista' }).fase).toBe('abriendo');
  });

  it('abre igual si la villa nunca avisa', () => {
    const e = recorrer(estadoInicial(true), [elegir(), { tipo: 'cubierto' }, { tipo: 'espera-cumplida' }, { tipo: 'tope' }]);
    expect(e.fase).toBe('abriendo');
  });

  it('muestra la pista una sola vez, y nunca a quien va a entrar con su cuenta', () => {
    const hastaAbrir = (accion: 'mirar' | 'entrar', conPista: boolean) =>
      recorrer(estadoInicial(true), [
        { tipo: 'elegir', accion, reiniciaVilla: false },
        { tipo: 'cubierto' },
        { tipo: 'espera-cumplida' },
        { tipo: 'villa-lista' },
        { tipo: 'abierto', conPista },
      ]).fase;
    expect(hastaAbrir('mirar', true)).toBe('pista');
    expect(hastaAbrir('mirar', false)).toBe('fin');
    expect(hastaAbrir('entrar', true)).toBe('fin');
  });

  it('al volver con «Atrás» se puede elegir de nuevo y no espera a una villa que ya está armada', () => {
    const adentro = recorrer(estadoInicial(true), [
      { tipo: 'villa-lista' },
      elegir(),
      { tipo: 'cubierto' },
      { tipo: 'espera-cumplida' },
      { tipo: 'abierto', conPista: false },
    ]);
    expect(adentro.fase).toBe('fin');
    const devuelta = reducirPortada(adentro, { tipo: 'volver' });
    expect(devuelta).toEqual({ fase: 'portada', accion: null, villaLista: true, esperaCumplida: false });
    expect(recorrer(devuelta, [elegir(), { tipo: 'cubierto' }, { tipo: 'espera-cumplida' }]).fase).toBe('abriendo');
  });

  it('«Atrás» en plena transición regresa a la portada', () => {
    const e = recorrer(estadoInicial(true), [elegir(), { tipo: 'cubierto' }, { tipo: 'volver' }]);
    expect(e.fase).toBe('portada');
    expect(e.accion).toBeNull();
  });

  it('ignora un segundo clic mientras ya está saliendo', () => {
    const e = recorrer(estadoInicial(true), [elegir(), { tipo: 'elegir', accion: 'trabajar', reiniciaVilla: true }]);
    expect(e.accion).toBe('contratar');
  });
});

describe('cuándo se muestra la portada', () => {
  it('siempre en /, también con otros parámetros', () => {
    expect(debeMostrarPortada('/', '')).toBe(true);
    expect(debeMostrarPortada('/', '?utm_source=correo')).toBe(true);
  });

  it('también en las páginas informativas, que viven dentro de la portada', () => {
    for (const ruta of ['/que-es', '/como-funciona', '/villas', '/comisiones']) expect(debeMostrarPortada(ruta, '')).toBe(true);
  });

  it('nunca en las rutas de las villas', () => {
    expect(debeMostrarPortada('/contratar', '')).toBe(false);
    expect(debeMostrarPortada('/trabajar', '')).toBe(false);
  });

  it('no estorba a los enlaces directos', () => {
    for (const q of ['?pedido=abc', '?se-busca=abc', '?correo=abc', '?kyc=volver']) expect(debeMostrarPortada('/', q)).toBe(false);
  });
});

describe('medidas de la portada', () => {
  it('a 1440 × 900 respeta el tamaño de Figma', () => {
    expect(medirPortada(1440, 900)).toEqual({ escala: 1, desplazamiento: 0, texto: 1, cortina: 1, movil: false });
  });

  it('en una pantalla ancha achica los textos para que no choquen con el pueblo', () => {
    const m = medirPortada(1920, 900);
    expect(m.texto * 505).toBeLessThanOrEqual(900 - 348 * m.escala);
  });

  it('en el celular recorta los lados sin dejar huecos y centra el pueblo', () => {
    const m = medirPortada(390, 844);
    expect(m.movil).toBe(true);
    expect(m.desplazamiento).toBeLessThanOrEqual(0);
    expect(m.desplazamiento + 1440 * m.escala).toBeGreaterThanOrEqual(390);
    expect(m.cortina * 900).toBeGreaterThanOrEqual(844);
  });
});
