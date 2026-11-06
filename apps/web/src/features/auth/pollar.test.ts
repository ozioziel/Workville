// Entrar con correo (Pollar): qué campo se muestra en cada paso del SDK y cómo se traducen sus errores.
import type { AuthState } from '@pollar/core';
import { describe, expect, it } from 'vitest';
import { pasoDe } from './pollar';

const error = (message: string) => ({ step: 'error', previousStep: 'verifying_email_code', message, errorCode: 'X' }) as unknown as AuthState;

describe('entrar con correo (Pollar)', () => {
  it('cada paso del SDK muestra el campo que corresponde', () => {
    expect(pasoDe({ step: 'idle' }).paso).toBe('correo');
    expect(pasoDe({ step: 'sending_email', email: 'a@b.co' }).paso).toBe('enviando');
    expect(pasoDe({ step: 'entering_code', clientSessionId: 'x', email: 'a@b.co' }).paso).toBe('codigo');
    expect(pasoDe({ step: 'verifying_email_code', clientSessionId: 'x', email: 'a@b.co' }).paso).toBe('verificando');
    expect(pasoDe({ step: 'authenticated' } as AuthState).paso).toBe('listo');
  });

  it('traduce los errores comunes al español y deja ver el original en los demás', () => {
    expect(pasoDe(error('Invalid OTP code'))).toEqual({ paso: 'error', mensaje: 'El código no es correcto o ya venció. Pide otro.' });
    expect(pasoDe(error('Invalid email')).mensaje).toBe('Ese correo no parece válido.');
    expect(pasoDe(error('Network timeout')).mensaje).toMatch(/No pudimos conectarnos/);
    expect(pasoDe(error('Something else')).mensaje).toBe('El servicio de cuentas respondió: Something else');
  });
});
