import { describe, expect, it } from 'vitest';
import type { Transaction } from '../domain/entities.js';
import { detectSubscriptions, subscriptionKey } from './subscriptions.js';

const NOW = new Date('2026-11-12T12:00:00Z');
let n = 0;
const tx = (description: string, amountInCents: number, date: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`, userId: 'u1', accountId: 'a1', externalId: null, description, amountInCents,
  occurredAt: new Date(`${date}T12:00:00Z`), categoryId: null, isInternalTransfer: false, createdAt: NOW, ...extra,
});
const names = (txs: Transaction[]) => detectSubscriptions(txs, NOW).map((s) => [s.name, s.amountInCents, s.active, s.installmentsLeft]);

describe('subscriptionKey', () => {
  it.each([
    ['Dl*Spotify P47b1', 'SPOTIFY'],
    ['Dm*Spotify', 'SPOTIFY'],
    ['DL     *helphbomaxcom', 'HELPHBOMAXCOM'],
    ['EBW*Canva', 'CANVA'],
    ['TIM*34988291118', 'TIM'],
    ['DL*GOOGLE YouTub', 'GOOGLE YOUTUB'],
    ['GLOBO*Globoplay 5/12', 'GLOBOPLAY'],
    ['AMAZON PRIME BR 5/12', 'AMAZON PRIME'],
    ['Amazon Prime 1/12', 'AMAZON PRIME'],
    ['Amazon Prime*2K8XX', 'AMAZON PRIME'],
    ['ANTHROPIC* CLAUDE SUB', 'ANTHROPIC CLAUDE SUB'],
    ['CENTAURO COM BR', 'CENTAURO'],
  ])('%s -> %s', (raw, key) => expect(subscriptionKey(raw)).toBe(key));
});

describe('detectSubscriptions', () => {
  it('pega o Spotify mesmo com intermediário e código mudando todo mês', () => {
    expect(names([
      tx('Dm*Spotify', -4090, '2026-09-06'),
      tx('Dl*Spotify P47b1', -4090, '2026-10-06'),
      tx('Dl*Spotify P48e2', -4090, '2026-11-06'),
    ])).toEqual([['Dl*Spotify P48e2', 4090, true, null]]);
  });

  it('plano anual parcelado entra com as parcelas que faltam', () => {
    expect(names([
      tx('GLOBO*Globoplay 5/12', -2190, '2026-08-26'),
      tx('GLOBO*Globoplay 6/12', -2190, '2026-09-25'),
      tx('GLOBO*Globoplay 7/12', -2190, '2026-10-26'),
    ])).toEqual([['GLOBO*Globoplay', 2190, true, 5]]);
  });

  it('duas séries do mesmo plano anual não se misturam', () => {
    expect(names([
      tx('Amazon Prime 1/12', -1390, '2026-08-03'), tx('Amazon Prime 2/12', -1390, '2026-08-14'),
      tx('AMAZON PRIME BR 5/12', -1390, '2026-09-05'), tx('AMAZON PRIME BR 6/12', -1390, '2026-10-05'), tx('AMAZON PRIME BR 7/12', -1390, '2026-11-05'),
    ])).toEqual([['AMAZON PRIME BR', 1390, true, 5]]);
  });

  it('compra parcelada que não é anual fica de fora', () => {
    expect(names([tx('LOJA X PARC 02/10', -10000, '2026-09-10'), tx('LOJA X PARC 03/10', -10000, '2026-10-10')])).toEqual([]);
  });

  it('ignora Pix pra pessoa e pagamento de fatura, mesmo todo mês', () => {
    expect(names([
      tx('Pix enviado Amanda Costa', -660, '2026-08-28'), tx('Pix enviado Amanda Costa', -660, '2026-09-30'),
      tx('Pagamento com Pix NU PAGAMENTOS SA', -22894, '2026-09-30'), tx('Pagamento com Pix NU PAGAMENTOS SA', -24240, '2026-10-30'),
    ])).toEqual([]);
  });

  it('ignora mercado semanal, valores muito diferentes, entradas e transferências', () => {
    expect(names([
      tx('ASSAI ATACADISTA', -7340, '2026-10-01'), tx('ASSAI ATACADISTA', -5000, '2026-10-08'), tx('ASSAI ATACADISTA', -9000, '2026-10-15'),
      tx('POSTO SHELL', -5000, '2026-09-10'), tx('POSTO SHELL', -20000, '2026-10-10'),
      tx('SALARIO ACME', 130000, '2026-09-05'), tx('SALARIO ACME', 130000, '2026-10-05'),
      tx('MESADA', -5000, '2026-09-05', { isInternalTransfer: true }), tx('MESADA', -5000, '2026-10-05', { isInternalTransfer: true }),
    ])).toEqual([]);
  });

  it('próxima cobrança que já passou faz a assinatura contar como parada', () => {
    const [netflix] = detectSubscriptions([tx('NETFLIX.COM', -5790, '2026-09-02'), tx('NETFLIX.COM', -5790, '2026-10-02')], NOW);
    expect(netflix!.active).toBe(false); // próxima seria 01/11
  });

  it('reajuste pequeno ainda é a mesma assinatura', () => {
    expect(names([tx('Amazon Prime Canais', -2499, '2026-09-06'), tx('Amazon Prime Canais', -2499, '2026-10-06'), tx('Amazon Prime Canais', -2690, '2026-11-06')]))
      .toEqual([['Amazon Prime Canais', 2690, true, null]]);
  });
});
