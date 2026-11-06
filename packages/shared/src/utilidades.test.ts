// Utilidades de shared que usan la API y la web: validar lo que pega la persona, enlaces al explorador y textos.
import { describe, expect, it } from 'vitest';
import {
  aSegundosUnix,
  enlaceExplorador,
  esContratoValido,
  esHashValido,
  formatoUsdc,
  pareceDireccionStellar,
  puedeVerificar,
  redDePassphrase,
  textoCalificacion,
} from './index.js';

const G = 'GD74KD7J7MZIB6R4O4NZC3BEMAEGAB2UOMZKYSCVHOPFBXPFKFINNNTU';
const C = 'CB42MFK5XZJBXWAHYXI6VCP3N75GQBNPAX77JK6W3ARIRK7N6YKHHUVO';

describe('validar lo que pega la persona', () => {
  it('un hash son 64 caracteres hexadecimales, con espacios alrededor tolerados', () => {
    expect(esHashValido('ab'.repeat(32))).toBe(true);
    expect(esHashValido(`  ${'AB'.repeat(32)}\n`)).toBe(true);
    expect(esHashValido('ab'.repeat(31))).toBe(false);
    expect(esHashValido('zz'.repeat(32))).toBe(false);
  });

  it('distingue una dirección de cuenta (G…) de un contrato (C…)', () => {
    expect(pareceDireccionStellar(G)).toBe(true);
    expect(pareceDireccionStellar(C)).toBe(false);
    expect(esContratoValido(C)).toBe(true);
    expect(esContratoValido(G)).toBe(false);
    expect(pareceDireccionStellar(G.toLowerCase())).toBe(false);
  });
});

describe('red y explorador', () => {
  it('reconoce la passphrase de cada red y ninguna otra', () => {
    expect(redDePassphrase('Test SDF Network ; September 2015')).toBe('testnet');
    expect(redDePassphrase('Public Global Stellar Network ; September 2015')).toBe('mainnet');
    expect(redDePassphrase('Standalone Network ; February 2017')).toBeNull();
  });

  it('el enlace a stellar.expert usa «public» para mainnet', () => {
    expect(enlaceExplorador('contract', C)).toBe(`https://stellar.expert/explorer/testnet/contract/${C}`);
    expect(enlaceExplorador('account', G, 'mainnet')).toBe(`https://stellar.expert/explorer/public/account/${G}`);
  });
});

describe('montos, fechas y textos', () => {
  it('quita los ceros que sobran del USDC sin tocar los enteros', () => {
    expect(formatoUsdc('10.5000000')).toBe('10.5');
    expect(formatoUsdc('100.0000000')).toBe('100');
    expect(formatoUsdc('100')).toBe('100');
    expect(formatoUsdc(2.25)).toBe('2.25');
  });

  it('pasa una fecha a segundos Unix y rechaza una fecha inválida', () => {
    expect(aSegundosUnix('2026-11-06T00:00:00Z')).toBe('1793923200');
    expect(aSegundosUnix(new Date(1_500))).toBe('1');
    expect(() => aSegundosUnix('no es fecha')).toThrow('Fecha inválida');
  });

  it('la calificación dice «reseña» o «reseñas» según cuántas haya', () => {
    expect(textoCalificacion(null, 0)).toBe('Sin reseñas');
    expect(textoCalificacion(4.25, 1)).toBe('4.3 ★ (1 reseña)');
    expect(textoCalificacion(5, 3)).toBe('5.0 ★ (3 reseñas)');
  });

  it('una entrega la verifica otra persona del pedido, no quien la declaró', () => {
    expect(puedeVerificar('yo', 'otra', 'cliente')).toBe(true);
    expect(puedeVerificar('yo', 'yo', 'proveedor')).toBe(false);
    expect(puedeVerificar('yo', 'otra', null)).toBe(false);
  });
});
