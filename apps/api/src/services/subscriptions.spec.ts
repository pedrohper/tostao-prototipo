import { describe, expect, it } from 'vitest';
import type { Transaction } from '../domain/entities.js';
import { detectSubscriptions, installmentOf, subscriptionBaseKey, subscriptionKey } from './subscriptions.js';

const NOW = new Date('2026-11-12T12:00:00Z');
let n = 0;
const tx = (
  description: string,
  amountInCents: number,
  date: string,
  extra: Partial<Transaction> = {},
): Transaction => ({
  id: `t${n++}`,
  userId: 'u1',
  accountId: 'a1',
  externalId: null,
  description,
  amountInCents,
  occurredAt: new Date(`${date}T12:00:00Z`),
  categoryId: null,
  isInternalTransfer: false,
  createdAt: NOW,
  ...extra,
});
const names = (txs: Transaction[]) =>
  detectSubscriptions(txs, NOW).map((s) => [s.name, s.amountInCents, s.active, s.installmentsLeft]);

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
    expect(
      names([
        tx('Dm*Spotify', -4090, '2026-09-06'),
        tx('Dl*Spotify P47b1', -4090, '2026-10-06'),
        tx('Dl*Spotify P48e2', -4090, '2026-11-06'),
      ]),
    ).toEqual([['Dl*Spotify P48e2', 4090, true, null]]);
  });

  it('plano anual parcelado entra com as parcelas que faltam', () => {
    expect(
      names([
        tx('GLOBO*Globoplay 5/12', -2190, '2026-08-26'),
        tx('GLOBO*Globoplay 6/12', -2190, '2026-09-25'),
        tx('GLOBO*Globoplay 7/12', -2190, '2026-10-26'),
      ]),
    ).toEqual([['GLOBO*Globoplay', 2190, true, 5]]);
  });

  it('duas séries do mesmo plano anual não se misturam', () => {
    expect(
      names([
        tx('Amazon Prime 1/12', -1390, '2026-08-03'),
        tx('Amazon Prime 2/12', -1390, '2026-08-14'),
        tx('AMAZON PRIME BR 5/12', -1390, '2026-09-05'),
        tx('AMAZON PRIME BR 6/12', -1390, '2026-10-05'),
        tx('AMAZON PRIME BR 7/12', -1390, '2026-11-05'),
      ]),
    ).toEqual([['AMAZON PRIME BR', 1390, true, 5]]);
  });

  it('compra parcelada que não é anual fica de fora', () => {
    expect(
      names([tx('LOJA X PARC 02/10', -10000, '2026-09-10'), tx('LOJA X PARC 03/10', -10000, '2026-10-10')]),
    ).toEqual([]);
  });

  it('ignora Pix pra pessoa e pagamento de fatura, mesmo todo mês', () => {
    expect(
      names([
        tx('Pix enviado Amanda Costa', -660, '2026-08-28'),
        tx('Pix enviado Amanda Costa', -660, '2026-09-30'),
        tx('Pagamento com Pix NU PAGAMENTOS SA', -22894, '2026-09-30'),
        tx('Pagamento com Pix NU PAGAMENTOS SA', -24240, '2026-10-30'),
      ]),
    ).toEqual([]);
  });

  it('ignora mercado semanal, valores muito diferentes, entradas e transferências', () => {
    expect(
      names([
        tx('ASSAI ATACADISTA', -7340, '2026-10-01'),
        tx('ASSAI ATACADISTA', -5000, '2026-10-08'),
        tx('ASSAI ATACADISTA', -9000, '2026-10-15'),
        tx('POSTO SHELL', -5000, '2026-09-10'),
        tx('POSTO SHELL', -20000, '2026-10-10'),
        tx('SALARIO ACME', 130000, '2026-09-05'),
        tx('SALARIO ACME', 130000, '2026-10-05'),
        tx('MESADA', -5000, '2026-09-05', { isInternalTransfer: true }),
        tx('MESADA', -5000, '2026-10-05', { isInternalTransfer: true }),
      ]),
    ).toEqual([]);
  });

  it('próxima cobrança que já passou faz a assinatura contar como parada', () => {
    const [netflix] = detectSubscriptions(
      [tx('NETFLIX.COM', -5790, '2026-09-02'), tx('NETFLIX.COM', -5790, '2026-10-02')],
      NOW,
    );
    expect(netflix!.active).toBe(false); // próxima seria 01/11
  });

  it('reajuste pequeno ainda é a mesma assinatura', () => {
    expect(
      names([
        tx('Amazon Prime Canais', -2499, '2026-09-06'),
        tx('Amazon Prime Canais', -2499, '2026-10-06'),
        tx('Amazon Prime Canais', -2690, '2026-11-06'),
      ]),
    ).toEqual([['Amazon Prime Canais', 2690, true, null]]);
  });
});

describe('assinatura em dobro', () => {
  it('dois Prime ativos ficam os dois, marcados como cobrança em dobro', () => {
    const now = new Date('2026-11-13T12:00:00Z');
    const mk = (d: string, desc: string, v: number) =>
      ({
        id: d + desc,
        userId: 'u',
        accountId: 'c',
        amountInCents: -v,
        description: desc,
        occurredAt: new Date(d),
        categoryId: null,
        isInternalTransfer: false,
        externalId: null,
      }) as never;
    const subs = detectSubscriptions(
      [
        mk('2026-08-05T12:00:00Z', 'AMAZON PRIME BR 5/12', 1390),
        mk('2026-09-05T12:00:00Z', 'AMAZON PRIME BR 6/12', 1390),
        mk('2026-10-05T12:00:00Z', 'AMAZON PRIME BR 7/12', 1390),
        mk('2026-11-05T12:00:00Z', 'AMAZON PRIME BR 8/12', 1390),
        mk('2026-08-15T12:00:00Z', 'Amazon Prime 2/12', 1390),
        mk('2026-09-15T12:00:00Z', 'Amazon Prime 3/12', 1390),
        mk('2026-10-15T12:00:00Z', 'Amazon Prime 4/12', 1390),
      ],
      now,
    );
    const prime = subs.filter((s) => s.key.startsWith('AMAZON PRIME'));
    expect(prime).toHaveLength(2);
    expect(prime.every((s) => s.duplicateOf)).toBe(true);
  });
});

describe('T1.5 · assinaturas: parcela x data, faixa de valor, duplicata e fuso', () => {
  it('"15/12" é uma DATA (dia 15), não a parcela 15 de 12: continua no texto e não vira parcelado', () => {
    expect(installmentOf('LOJA 15/12')).toBeNull();
    expect(installmentOf('LOJA 5/12')).toEqual({ n: 5, total: 12 });
    expect(installmentOf('PARCELA 2 DE 6')).toEqual({ n: 2, total: 6 });
    expect(installmentOf('parc 03/10')).toEqual({ n: 3, total: 10 }); // minúscula (flag /i)
    expect(installmentOf('SAQUE 13/12')).toBeNull();
    // uma cobrança mensal com data no texto não é tratada como "parcelado": sem installmentsLeft
    const subs = detectSubscriptions(
      [
        tx('STREAMX 15/09', -3000, '2026-09-15'),
        tx('STREAMX 15/10', -3000, '2026-10-15'),
        tx('STREAMX 15/11', -3000, '2026-11-12'),
      ],
      NOW,
    );
    expect(subs.map((x) => x.installmentsLeft)).toEqual([null]);
  });

  it('subscriptionKey só tira parcela VÁLIDA do texto', () => {
    expect(subscriptionKey('AMAZON PRIME 5/12')).toBe('AMAZON PRIME');
    expect(subscriptionKey('Amazon Prime parc 5/12')).toBe('AMAZON PRIME');
  });

  it('dois planos da MESMA loja (valores diferentes) ganham chaves diferentes e NÃO são duplicata um do outro', () => {
    const subs = detectSubscriptions(
      [
        tx('NETFLIX', -2990, '2026-09-10'),
        tx('NETFLIX', -2990, '2026-10-10'),
        tx('NETFLIX', -2990, '2026-11-10'),
        tx('NETFLIX', -5590, '2026-09-11'),
        tx('NETFLIX', -5590, '2026-10-11'),
        tx('NETFLIX', -5590, '2026-11-11'),
      ],
      NOW,
    );
    expect(subs).toHaveLength(2);
    expect(new Set(subs.map((x) => x.key)).size).toBe(2); // chaves distintas (ignorar um não esconde o outro)
    expect(subs.map((x) => subscriptionBaseKey(x.key))).toEqual(['NETFLIX', 'NETFLIX']);
    expect(subs.every((x) => x.duplicateOf === null)).toBe(true);
  });

  it('um plano só mantém a chave simples (nada de sufixo à toa)', () => {
    const subs = detectSubscriptions([tx('SPOTIFY', -2190, '2026-10-03'), tx('SPOTIFY', -2190, '2026-11-03')], NOW);
    expect(subs.map((x) => x.key)).toEqual(['SPOTIFY']);
  });

  it('duas cobranças ativas do mesmo serviço com valor PARECIDO continuam marcadas como duplicata', () => {
    const subs = detectSubscriptions(
      [
        tx('AMAZON PRIME 3/12', -1990, '2026-09-05'),
        tx('AMAZON PRIME 4/12', -1990, '2026-10-05'),
        tx('AMAZON PRIME 5/12', -1990, '2026-11-05'),
        tx('AMAZON PRIME 1/12', -1990, '2026-09-20'),
        tx('AMAZON PRIME 2/12', -1990, '2026-10-20'),
        tx('AMAZON PRIME 3/12', -1990, '2026-11-19'),
      ],
      NOW,
    );
    expect(subs.filter((x) => x.duplicateOf !== null).length).toBeGreaterThanOrEqual(2);
  });

  it('o mês da série parcelada vem do FUSO: cobrança às 22h de Brasília é do mesmo mês, não do UTC seguinte', () => {
    // 30/09 22h BRT = 01/10 01h UTC. A parcela 1/12 de uma série que começa em setembro precisa cair na MESMA série
    // da 2/12 de 30/10 (22h BRT) e da 3/12 de 30/11 — sem isso, a virada de mês UTC quebraria a série.
    const at = (iso: string) => new Date(`${iso}-03:00`);
    const t = (d: string, desc: string) => tx(desc, -1990, '2026-01-01', { occurredAt: at(d) });
    const brt = detectSubscriptions(
      [
        t('2026-09-30T22:00:00', 'PRIME 1/12'),
        t('2026-10-30T22:00:00', 'PRIME 2/12'),
        t('2026-11-29T22:00:00', 'PRIME 3/12'),
      ],
      new Date('2026-12-05T12:00:00Z'),
      'America/Sao_Paulo',
    );
    expect(brt).toHaveLength(1);
    expect(brt[0]!.chargeCount).toBe(3);
  });
});
