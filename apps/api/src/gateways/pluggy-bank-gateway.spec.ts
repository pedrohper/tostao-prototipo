import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardFingerprint, PluggyBankGateway } from './pluggy-bank-gateway.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('PluggyBankGateway', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('busca transações no /v2 seguindo o cursor até o next vir null', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      if (url.endsWith('/auth')) return json({ apiKey: 'chave' });
      if (!url.includes('after=')) {
        return json({ results: [{ id: 't1', description: 'IFOOD', amount: -42.9, date: '2026-11-10T12:00:00.000Z', type: 'DEBIT' }], next: '?accountId=acc&after=abc%3D' });
      }
      return json({ results: [{ id: 't2', description: 'SALARIO', amount: 1307.9, date: '2026-11-05T12:00:00.000Z', type: 'CREDIT' }], next: null });
    }));

    const txs = await new PluggyBankGateway('id', 'secret').fetchTransactions('acc', new Date('2026-11-01'), new Date('2026-11-30'));

    expect(txs.map((t) => [t.externalId, t.amountInCents])).toEqual([['t1', -4290], ['t2', 130790]]);
    expect(calls[1]).toBe('https://api.pluggy.ai/v2/transactions?accountId=acc&dateFrom=2026-11-01&dateTo=2026-11-30');
    expect(calls[2]).toBe('https://api.pluggy.ai/v2/transactions?accountId=acc&after=abc%3D');
    expect(calls.some((c) => /[?&](page|pageSize|from|to)=/.test(c))).toBe(false);
  });

  it('marca cartão por bandeira + final, e conta corrente fica sem marca', () => {
    expect(cardFingerprint({ type: 'CREDIT', number: '**** 8335', creditData: { brand: 'elo' } })).toBe('CREDIT:ELO:8335');
    expect(cardFingerprint({ type: 'BANK', number: '41930-3', creditData: null })).toBeNull();
    expect(cardFingerprint({ type: 'CREDIT', number: null, creditData: null })).toBeNull();
  });

  it('cartão usa o name (o marketingName às vezes vem "OUTROS")', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/auth')
      ? json({ apiKey: 'chave' })
      : json({ total: 1, totalPages: 1, page: 1, results: [{ id: 'a1', name: 'AMAZON MASTERCARD PLATINUM', marketingName: 'OUTROS', type: 'CREDIT', balance: 10, number: '6018', creditData: { brand: 'MASTERCARD' } }] })));
    const [card] = await new PluggyBankGateway('id', 'secret').fetchAccounts('item');
    expect(card).toMatchObject({ name: 'Amazon Mastercard Platinum', fingerprint: 'CREDIT:MASTERCARD:6018', balanceInCents: -1000 });
  });
});

import { pluggyDate } from './pluggy-bank-gateway.js';
describe('data da Pluggy', () => {
  it('dia sem hora (meia-noite UTC) fica no mesmo dia em Brasília', () => {
    expect(pluggyDate('2026-11-12T00:00:00.000Z').toISOString()).toBe('2026-11-12T15:00:00.000Z');
  });
  it('com hora de verdade, mantém', () => {
    expect(pluggyDate('2026-11-12T23:40:00.000Z').toISOString()).toBe('2026-11-12T23:40:00.000Z');
  });
});
