// Lo que falta para pagar un pedido con la rampa: se redondea hacia arriba a centavos, sin errores de decimales.
import { describe, expect, it, vi } from 'vitest';

// datos.ts llama a la API; aquí solo se prueba la cuenta.
vi.mock('../../lib/api', () => ({ api: vi.fn() }));

import { faltaParaPagar } from './datos';

describe('faltaParaPagar', () => {
  it('no pide un centavo de más por los decimales de JS', () => {
    expect(faltaParaPagar('1.1', null)).toBe('1.10');
    expect(faltaParaPagar('100', '90.3')).toBe('9.70');
    expect(faltaParaPagar('25.5000000', '0')).toBe('25.50');
  });

  it('redondea hacia arriba lo que no llega a un centavo', () => {
    expect(faltaParaPagar('10.0000001', null)).toBe('10.01');
    expect(faltaParaPagar('20', '9.995')).toBe('10.01');
  });

  it('pide como mínimo 1 USDC', () => {
    expect(faltaParaPagar('5', '4.5')).toBe('1.00');
    expect(faltaParaPagar('5', '9')).toBe('1.00');
  });
});
