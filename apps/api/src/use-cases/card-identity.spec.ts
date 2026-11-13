import { describe, expect, it } from 'vitest';
import { cardIdentity } from './card-identity.js';

describe('cardIdentity', () => {
  it('lê bandeira e final do fingerprint', () => {
    expect(cardIdentity('CREDIT:VISA:2784')).toEqual({ brand: 'VISA', last4: '2784' });
  });
  it('sem bandeira, só o final', () => {
    expect(cardIdentity('CREDIT::6018')).toEqual({ brand: null, last4: '6018' });
  });
  it('sem fingerprint, nada', () => {
    expect(cardIdentity(null)).toEqual({ brand: null, last4: null });
  });
});
