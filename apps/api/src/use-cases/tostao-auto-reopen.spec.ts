// T1.6 · Tostão Auto: reabertura de achados mensais, lote de pendentes e todas as metas.
import { describe, expect, it } from 'vitest';
import type { UpsertTostaoInsight } from '../repositories/types.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { shouldReopenInsight } from '../services/insight-reopen.js';
import { RunTostaoChecksUseCase } from './tostao-auto.js';

const base = (o: Partial<UpsertTostaoInsight>): UpsertTostaoInsight => ({
  userId: 'u1',
  routine: 'guardiao_limites',
  kind: 'budget_alert',
  severity: 'warning',
  title: 't',
  body: 'b',
  payload: {},
  dedupeKey: 'k1',
  ...o,
});

describe('quando um achado resolvido reabre (shouldReopenInsight)', () => {
  it('achados MENSAIS reabrem quando a condição volta; "dispensado" pela pessoa nunca reabre', () => {
    for (const kind of ['month_shortfall', 'next_month_tight', 'budget_alert', 'goal_off_track']) {
      expect(shouldReopenInsight({ status: 'APPLIED', payload: {} }, { kind, payload: {} }), kind).toBe(true);
      expect(shouldReopenInsight({ status: 'DISMISSED', payload: {} }, { kind, payload: {} }), kind).toBe(false);
      expect(shouldReopenInsight({ status: 'PENDING', payload: {} }, { kind, payload: {} }), kind).toBe(false);
    }
  });

  it('lote de pendentes: categorizar só a mais recente NÃO reabre; chegar pendência NOVA reabre', () => {
    const prev = { status: 'APPLIED', payload: { latestTxId: 'novo', latestCreatedAt: '2026-11-10T12:00:00.000Z' } };
    // a pessoa categorizou a mais nova; a "mais nova pendente" agora é uma ANTIGA (criada antes): não é pendência nova
    expect(
      shouldReopenInsight(prev, {
        kind: 'uncategorized_batch',
        payload: { latestTxId: 'antiga', latestCreatedAt: '2026-11-05T12:00:00.000Z' },
      }),
    ).toBe(false);
    // chegou transação nova sem categoria
    expect(
      shouldReopenInsight(prev, {
        kind: 'uncategorized_batch',
        payload: { latestTxId: 'chegou', latestCreatedAt: '2026-11-12T09:00:00.000Z' },
      }),
    ).toBe(true);
    // mesma de antes: nada novo
    expect(
      shouldReopenInsight(prev, {
        kind: 'uncategorized_batch',
        payload: { latestTxId: 'novo', latestCreatedAt: '2026-11-10T12:00:00.000Z' },
      }),
    ).toBe(false);
  });

  it('achado antigo sem a data cai na comparação por id (compatibilidade)', () => {
    expect(
      shouldReopenInsight(
        { status: 'APPLIED', payload: { latestTxId: 'a' } },
        { kind: 'uncategorized_batch', payload: { latestTxId: 'b' } },
      ),
    ).toBe(true);
    expect(
      shouldReopenInsight(
        { status: 'APPLIED', payload: { latestTxId: 'a' } },
        { kind: 'uncategorized_batch', payload: { latestTxId: 'a' } },
      ),
    ).toBe(false);
  });

  it('outros tipos resolvidos continuam resolvidos', () => {
    expect(shouldReopenInsight({ status: 'APPLIED', payload: {} }, { kind: 'possible_split', payload: {} })).toBe(
      false,
    );
  });
});

describe('upsertPending no repositório', () => {
  it('estourou, resolveu (APPLIED) e estourou de novo: o aviso VOLTA como pendente e conta como criado', async () => {
    const repos = makeInMemoryRepositories();
    const first = await repos.tostaoAuto.upsertPending(base({}));
    expect(first.created).toBe(true);
    await repos.tostaoAuto.setStatus(first.insight.id, 'APPLIED', new Date());
    const again = await repos.tostaoAuto.upsertPending(base({ title: 'de novo' }));
    expect(again).toMatchObject({ created: true, insight: { status: 'PENDING', title: 'de novo' } });
  });

  it('dispensado pela pessoa continua dispensado', async () => {
    const repos = makeInMemoryRepositories();
    const first = await repos.tostaoAuto.upsertPending(base({}));
    await repos.tostaoAuto.setStatus(first.insight.id, 'DISMISSED', new Date());
    const again = await repos.tostaoAuto.upsertPending(base({}));
    expect(again).toMatchObject({ created: false, insight: { status: 'DISMISSED' } });
  });
});

describe('metas fora do prazo: TODAS viram aviso', () => {
  it('uma meta que não cabe na sobra gera aviso próprio por meta (a principal mantém a chave antiga)', async () => {
    const repos = makeInMemoryRepositories();
    const user = await repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: null });
    await repos.plans.save(user.id, {
      salary: { amountInCents: 1000_00, payday: 5, varies: false, bank: null, advance: null, pattern: null },
      otherIncomes: [],
      fixedExpenses: [{ name: 'Aluguel', amountInCents: 990_00, day: 10 }],
      benefits: [],
      goal: null,
      goals: [
        { id: 'g1', kind: 'reserva', label: 'Reserva', amountInCents: 50_000_00, deadline: '2027-03', savedInCents: 0 },
        { id: 'g2', kind: 'viagem', label: 'Viagem', amountInCents: 30_000_00, deadline: '2027-02', savedInCents: 0 },
      ],
    });
    const run = await new RunTostaoChecksUseCase(repos, () => new Date('2026-11-16T15:00:00Z')).execute({
      userId: user.id,
    });
    const goalInsights = run.insights.filter((i) => i.kind === 'goal_off_track');
    expect(goalInsights.map((i) => i.title).sort()).toEqual([
      'Sua meta "Reserva" pede ajuste',
      'Sua meta "Viagem" pede ajuste',
    ]);
  });
});
