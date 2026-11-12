import { describe, expect, it } from 'vitest';
import type { Transaction } from '../domain/entities.js';
import { detectSubscriptions, subscriptionKey } from './subscriptions.js';

const NOW = new Date('2026-11-12T12:00:00Z');
let n = 0;
const tx = (description: string, amountInCents: number, date: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, userId: 'u1', accountId: 'a1', externalId: null, description, amountInCents,
  occurredAt: new Date(`${date}T12:00:00Z`), categoryId: null, isInternalTransfer: false, createdAt: NOW, ...extra,
});

describe('detectSubscriptions', () => {
  it('agrupa ignorando códigos e números', () => {
    expect(subscriptionKey('Amazon Prime*2K8XX')).toBe('AMAZON PRIME');
    expect(subscriptionKey('ANTHROPIC* CLAUDE SUB')).toBe('ANTHROPIC CLAUDE SUB');
  });

  it('acha cobranças mensais de valor parecido', () => {
    const subs = detectSubscriptions([
      tx('ANTHROPIC* CLAUDE SUB', -11999, '2026-08-24'),
      tx('ANTHROPIC* CLAUDE SUB', -11999, '2026-09-24'),
      tx('ANTHROPIC* CLAUDE SUB', -11999, '2026-10-24'),
      tx('Amazon Prime Canais', -2499, '2026-09-06'),
      tx('Amazon Prime Canais', -2499, '2026-10-06'),
      tx('Amazon Prime Canais', -2690, '2026-11-06'), // reajuste pequeno ainda conta
    ], NOW);
    expect(subs.map((s) => [s.name, s.amountInCents, s.active])).toEqual([
      ['ANTHROPIC* CLAUDE SUB', 11999, true],
      ['Amazon Prime Canais', 2690, true],
    ]);
    expect(subs[0]!.nextChargeAt.toISOString().slice(0, 10)).toBe('2026-11-24');
  });

  it('ignora mercado semanal, valores muito diferentes, parcelas, entradas e transferências', () => {
    const subs = detectSubscriptions([
      tx('ASSAI ATACADISTA', -7340, '2026-10-01'), tx('ASSAI ATACADISTA', -5000, '2026-10-08'), tx('ASSAI ATACADISTA', -9000, '2026-10-15'),
      tx('POSTO SHELL', -5000, '2026-09-10'), tx('POSTO SHELL', -20000, '2026-10-10'),
      tx('LOJA X PARC 02/10', -10000, '2026-09-10'), tx('LOJA X PARC 03/10', -10000, '2026-10-10'),
      tx('SALARIO ACME', 130000, '2026-09-05'), tx('SALARIO ACME', 130000, '2026-10-05'),
      tx('PIX MAE', -5000, '2026-09-05', { isInternalTransfer: true }), tx('PIX MAE', -5000, '2026-10-05', { isInternalTransfer: true }),
    ], NOW);
    expect(subs).toEqual([]);
  });

  it('marca como parada a que não cobrou no último ciclo', () => {
    const [netflix] = detectSubscriptions([tx('NETFLIX.COM', -5790, '2026-07-09'), tx('NETFLIX.COM', -5790, '2026-08-09')], NOW);
    expect(netflix!.active).toBe(false);
  });
});
