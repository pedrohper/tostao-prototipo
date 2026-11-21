import { describe, expect, it } from 'vitest';
import { safeAuthFields } from './safe-auth-fields';

describe('safeAuthFields', () => {
  it('devolve só name, email e inviteCode: senha nunca volta pro cliente', () => {
    const out = safeAuthFields({
      name: 'Pedro',
      email: 'p@x.com',
      inviteCode: 'ABC123',
      password: 'segredo-12345',
      confirm: 'segredo-12345',
      confirmPassword: 'segredo-12345',
      acceptedTerms: 'on',
      $ACTION_ID_abc: 'x',
    });
    expect(out).toEqual({ name: 'Pedro', email: 'p@x.com', inviteCode: 'ABC123' });
    expect(JSON.stringify(out)).not.toContain('segredo');
    expect(Object.keys(out)).not.toContain('password');
  });

  it('ignora valores que não são texto (ex.: arquivo no FormData) e campos ausentes', () => {
    expect(safeAuthFields({ email: new File([], 'x'), name: 'A' })).toEqual({ name: 'A' });
    expect(safeAuthFields({})).toEqual({});
  });

  it('o "form de login" com só e-mail e senha devolve só o e-mail', () => {
    expect(safeAuthFields({ email: 'a@b.com', password: 'x' })).toEqual({ email: 'a@b.com' });
  });
});
