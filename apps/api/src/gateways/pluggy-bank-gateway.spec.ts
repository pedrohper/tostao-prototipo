import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluggyBankGateway } from './pluggy-bank-gateway.js';

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
});
