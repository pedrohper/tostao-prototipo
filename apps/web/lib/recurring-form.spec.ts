import { describe, expect, it } from 'vitest';
import { installmentCents, recurringBodyFrom, type RecurringFormInput } from './recurring-form';

const base: RecurringFormInput = {
  cents: 120_00,
  kind: 'saida',
  repeat: 'mensal',
  times: 2,
  date: '2026-12-05',
  description: 'Internet',
  accountId: null,
  categoryId: null,
  automatic: true,
};
const ok = (i: RecurringFormInput) => {
  const r = recurringBodyFrom(i);
  if (!r?.success) throw new Error('esperava corpo válido');
  return r.data;
};

describe('recurringBodyFrom', () => {
  it('"todo mês" automático: regra mensal sem fim, valor cheio', () => {
    expect(ok(base)).toMatchObject({
      amountInCents: 120_00,
      frequency: 'MONTHLY',
      totalInstallments: null,
      autoPost: true,
      startDate: '2026-12-05',
    });
  });
  it('parcelado automático: o campo é o TOTAL; a regra guarda o valor de CADA parcela', () => {
    expect(ok({ ...base, repeat: 'parcelado', cents: 1200_00, times: 12 })).toMatchObject({
      amountInCents: 100_00,
      totalInstallments: 12,
    });
    expect(ok({ ...base, repeat: 'parcelado', cents: 100_00, times: 3 }).amountInCents).toBe(33_33);
  });
  it('sem "automático" ou "só esse": devolve null (segue o caminho antigo, que pré-lança as parcelas)', () => {
    expect(recurringBodyFrom({ ...base, automatic: false })).toBeNull();
    expect(recurringBodyFrom({ ...base, repeat: 'nao' })).toBeNull();
  });
  it('entrada, conta e categoria seguem pra regra', () => {
    expect(ok({ ...base, kind: 'entrada', accountId: 'a1', categoryId: 'salario' })).toMatchObject({
      kind: 'entrada',
      accountId: 'a1',
      categoryId: 'salario',
    });
  });
  it('dados ruins viram erro de validação (não chegam na API)', () => {
    expect(recurringBodyFrom({ ...base, description: '' })?.success).toBe(false);
    expect(recurringBodyFrom({ ...base, cents: 0 })?.success).toBe(false);
    expect(recurringBodyFrom({ ...base, date: '05/12/2026' })?.success).toBe(false);
  });
  it('installmentCents mostra a parcela', () => {
    expect(installmentCents(1000_00, 4)).toBe(250_00);
    expect(installmentCents(10_00, 1)).toBe(5_00); // mínimo de 2 parcelas
  });
});
