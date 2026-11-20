import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardFingerprint, PluggyBankGateway } from './pluggy-bank-gateway.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('PluggyBankGateway', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('busca transações no /v2 seguindo o cursor até o next vir null', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.endsWith('/auth')) return json({ apiKey: 'chave' });
        if (!url.includes('after=')) {
          return json({
            results: [
              { id: 't1', description: 'IFOOD', amount: -42.9, date: '2026-11-10T12:00:00.000Z', type: 'DEBIT' },
            ],
            next: '?accountId=acc&after=abc%3D',
          });
        }
        return json({
          results: [
            { id: 't2', description: 'SALARIO', amount: 1307.9, date: '2026-11-05T12:00:00.000Z', type: 'CREDIT' },
          ],
          next: null,
        });
      }),
    );

    const txs = await new PluggyBankGateway('id', 'secret').fetchTransactions(
      'acc',
      new Date('2026-11-01'),
      new Date('2026-11-30'),
    );

    expect(txs.map((t) => [t.externalId, t.amountInCents])).toEqual([
      ['t1', -4290],
      ['t2', 130790],
    ]);
    expect(calls[1]).toBe('https://api.pluggy.ai/v2/transactions?accountId=acc&dateFrom=2026-11-01&dateTo=2026-11-30');
    expect(calls[2]).toBe('https://api.pluggy.ai/v2/transactions?accountId=acc&after=abc%3D');
    expect(calls.some((c) => /[?&](page|pageSize|from|to)=/.test(c))).toBe(false);
  });

  it('marca cartão por bandeira + final, e conta corrente fica sem marca', () => {
    expect(cardFingerprint({ type: 'CREDIT', number: '**** 8335', creditData: { brand: 'elo' } })).toBe(
      'CREDIT:ELO:8335',
    );
    expect(cardFingerprint({ type: 'BANK', number: '41930-3', creditData: null })).toBeNull();
    expect(cardFingerprint({ type: 'CREDIT', number: null, creditData: null })).toBeNull();
  });

  it('cartão usa o name (o marketingName às vezes vem "OUTROS")', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth')
          ? json({ apiKey: 'chave' })
          : json({
              total: 1,
              totalPages: 1,
              page: 1,
              results: [
                {
                  id: 'a1',
                  name: 'AMAZON MASTERCARD PLATINUM',
                  marketingName: 'OUTROS',
                  type: 'CREDIT',
                  balance: 10,
                  number: '6018',
                  creditData: { brand: 'MASTERCARD' },
                },
              ],
            }),
      ),
    );
    const [card] = await new PluggyBankGateway('id', 'secret').fetchAccounts('item');
    expect(card).toMatchObject({
      name: 'Amazon Mastercard Platinum',
      fingerprint: 'CREDIT:MASTERCARD:6018',
      balanceInCents: -1000,
    });
  });

  it('busca logos individuais dos bancos quando /connectors?countries=BR devolve só MeuPluggy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/auth')) return json({ apiKey: 'chave' });
        if (url.endsWith('/connectors?countries=BR')) {
          return json({
            results: [{ id: 200, name: 'MeuPluggy', imageUrl: 'https://cdn.pluggy.ai/200.svg', isSandbox: false }],
          });
        }
        if (url.endsWith('/connectors/612')) {
          return json({
            id: 612,
            name: 'Nubank',
            imageUrl: 'https://cdn.pluggy.ai/assets/connector-icons/212.svg',
            primaryColor: '8a0fbe',
            isSandbox: false,
          });
        }
        if (url.endsWith('/connectors/606')) {
          return json({
            id: 606,
            name: 'Mercado Pago',
            imageUrl: 'https://cdn.pluggy.ai/assets/connector-icons/206.svg',
            primaryColor: '009ee3',
            isSandbox: false,
          });
        }
        return json({ message: 'not found' }, 404);
      }),
    );

    const logos = await new PluggyBankGateway('id', 'secret').listInstitutionLogos();
    expect(logos).toEqual([
      { name: 'Mercado Pago', imageUrl: 'https://cdn.pluggy.ai/assets/connector-icons/206.svg', color: '#009ee3' },
      { name: 'Nubank', imageUrl: 'https://cdn.pluggy.ai/assets/connector-icons/212.svg', color: '#8a0fbe' },
    ]);
  });
});

describe('PluggyBankGateway: Item e connect token (segurança)', () => {
  const ITEM = '3f1c2a9e-1b2c-4d5e-8f90-123456789abc';
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('fetchItem usa encodeURIComponent e devolve clientUserId e isSandbox', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.endsWith('/auth')) return json({ apiKey: 'chave' });
        return json({ id: ITEM, clientUserId: 'user-42', connector: { name: 'Nubank', isSandbox: true } });
      }),
    );
    const item = await new PluggyBankGateway('id', 'secret').fetchItem(ITEM);
    expect(item).toEqual({ institution: 'Nubank', clientUserId: 'user-42', isSandbox: true });
    expect(calls[1]).toBe(`https://api.pluggy.ai/items/${encodeURIComponent(ITEM)}`);
  });

  it('fetchItem sem clientUserId no Item devolve null (e sandbox falso por padrão)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth') ? json({ apiKey: 'chave' }) : json({ id: ITEM, connector: { name: 'Nubank' } }),
      ),
    );
    expect(await new PluggyBankGateway('id', 'secret').fetchItem(ITEM)).toEqual({
      institution: 'Nubank',
      clientUserId: null,
      isSandbox: false,
    });
  });

  it('path injection: itemId fora de UUID v4 nem chega no Pluggy (a X-API-KEY não sai)', async () => {
    const fetchMock = vi.fn(async () => json({}));
    vi.stubGlobal('fetch', fetchMock);
    const gw = new PluggyBankGateway('id', 'secret');
    for (const bad of ['../me', `${ITEM}/../x`, `${ITEM}?x=1`, 'abc12345', 'item-de-exemplo', '..%2fconnectors']) {
      await expect(gw.fetchItem(bad), bad).rejects.toThrow('Item ID inválido');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  const connectBody = async (gw: PluggyBankGateway) => {
    let sent: { options: Record<string, unknown> } | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { body?: string }) => {
        if (url.endsWith('/auth')) return json({ apiKey: 'chave' });
        sent = JSON.parse(init!.body!);
        return json({ accessToken: 'tok' });
      }),
    );
    await gw.createConnectToken('user-42');
    return sent!.options;
  };

  it('em produção o connect token vai com includeSandbox: false', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const options = await connectBody(new PluggyBankGateway('id', 'secret'));
    expect(options).toMatchObject({ clientUserId: 'user-42', includeSandbox: false });
  });

  it('fora de produção libera sandbox; a opção explícita vence o NODE_ENV', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect((await connectBody(new PluggyBankGateway('id', 'secret'))).includeSandbox).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    const forced = new PluggyBankGateway('id', 'secret', { includeSandbox: true });
    expect((await connectBody(forced)).includeSandbox).toBe(true);
    expect(forced.allowsSandbox).toBe(true);
    expect(new PluggyBankGateway('id', 'secret').allowsSandbox).toBe(false);
  });

  it('falha do widget não menciona o trial do dashboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url.endsWith('/auth') ? json({ apiKey: 'chave' }) : json({}, 403))),
    );
    const err = await new PluggyBankGateway('id', 'secret').createConnectToken('u').catch((e) => e);
    expect(err.message).not.toMatch(/trial|dashboard/i);
  });
});

import { cleanPluggyDescription, pluggyDate } from './pluggy-bank-gateway.js';
describe('data e descrição da Pluggy', () => {
  it('dia sem hora (meia-noite UTC) fica no mesmo dia em Brasília', () => {
    expect(pluggyDate('2026-11-12T00:00:00.000Z').toISOString()).toBe('2026-11-12T15:00:00.000Z');
  });
  it('com hora de verdade, mantém', () => {
    expect(pluggyDate('2026-11-12T23:40:00.000Z').toISOString()).toBe('2026-11-12T23:40:00.000Z');
  });
  it('limpa ruído repetido do merchant sem apagar nome de loja nem transferência', () => {
    expect(cleanPluggyDescription('UBER *UBER *TRIP HELP.UB', 'Uber', 'Taxi and ride-hailing')).toBe('Uber');
    expect(cleanPluggyDescription('NETFLIX.COM *12345', 'Netflix', 'Video streaming')).toBe('Netflix');
    expect(cleanPluggyDescription('UBER *EATS PEDIDO', 'Uber', 'Food delivery')).toBe('UBER *EATS PEDIDO');
    expect(cleanPluggyDescription('IFD*RESTAURANTE SABOR', 'iFood', 'Food delivery')).toBe('IFD*RESTAURANTE SABOR');
    expect(cleanPluggyDescription('MP *PADARIA CENTRAL', 'Mercado Pago', 'Eating out')).toBe('MP *PADARIA CENTRAL');
    expect(cleanPluggyDescription('PIX ENVIADO FULANO', 'Fulano', 'Transfer - PIX')).toBe('PIX ENVIADO FULANO');
  });
});
