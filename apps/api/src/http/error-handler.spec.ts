// Erros do Prisma e do Fastify viram 4xx com mensagem segura (nunca 500 vazando tabela/coluna), e a validação dos
// contratos (mês, valores, UUID) barra lixo na borda com 400.
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { AppError } from '../domain/errors.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';

const SECRET = 'segredo-de-teste-com-32-caracteres!!';

async function boot() {
  const app = await buildApp({
    repos: makeInMemoryRepositories(),
    bank: new FakeBankGateway(),
    jwtSecret: SECRET,
    webOrigin: '*',
  });
  // Rotas que só lançam o erro, pra exercitar o errorHandler de verdade (antes do app ficar pronto).
  const throwing = (path: string, make: () => Error) => app.get(path, async () => Promise.reject(make()));
  const prismaError = (code: string, meta?: Record<string, unknown>) =>
    Object.assign(
      new Error(`Invalid \`prisma.x.create()\` invocation: Unique constraint failed on the fields: (\`email\`)`),
      {
        code,
        clientVersion: '6.19.3',
        meta: { target: ['users_email_key'], ...meta },
      },
    );
  throwing('/__p2002', () => prismaError('P2002'));
  throwing('/__p2025', () => prismaError('P2025'));
  throwing('/__p2003', () => prismaError('P2003'));
  throwing('/__p2020', () => prismaError('P2020'));
  throwing('/__22003', () => prismaError('22003'));
  throwing('/__p2010-22003', () => prismaError('P2010', { code: '22003' }));
  throwing('/__p2010-outro', () => prismaError('P2010', { code: '99999' }));
  throwing('/__app', () => new AppError('Conflito de negócio', 409, 'JA_EXISTE'));
  throwing('/__bug', () => new Error('algo quebrou: SELECT * FROM users WHERE senha = ...'));
  app.get('/__fastify-413', async () =>
    Promise.reject(
      Object.assign(new Error('Request body is too large'), { statusCode: 413, code: 'FST_ERR_CTP_BODY_TOO_LARGE' }),
    ),
  );
  app.get('/__fastify-400', async () =>
    Promise.reject(
      Object.assign(new Error('Body is not valid JSON but content-type is set to application/json'), {
        statusCode: 400,
        code: 'FST_ERR_CTP_INVALID_JSON_BODY',
      }),
    ),
  );
  app.get('/__fastify-429', async () =>
    Promise.reject(Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 })),
  );
  return app;
}

describe('errorHandler: Prisma e Fastify', () => {
  it.each([
    ['/__p2002', 409, /já existe/i],
    ['/__p2025', 404, /não encontrei/i],
    ['/__p2003', 400, /referência/i],
    ['/__p2020', 400, /fora do limite/i],
    ['/__22003', 400, /fora do limite/i],
    ['/__p2010-22003', 400, /fora do limite/i],
  ])('%s → %i com mensagem segura', async (url, status, message) => {
    const app = await boot();
    const res = await app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(status);
    expect(res.json().message).toMatch(message);
    // nada de tabela, coluna ou trecho de consulta na resposta
    expect(res.body).not.toMatch(/prisma|users_email_key|email|invocation|constraint/i);
  });

  it('erros nativos do Fastify mantêm o status (400/413/429) com texto em português', async () => {
    const app = await boot();
    for (const [url, status] of [
      ['/__fastify-400', 400],
      ['/__fastify-413', 413],
      ['/__fastify-429', 429],
    ] as const) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(status);
      expect(res.body).not.toMatch(/FST_ERR|Rate limit exceeded|too large/);
    }
  });

  it('AppError segue com status e code; bug de verdade segue 500 genérico, sem vazar detalhe', async () => {
    const app = await boot();
    const conflict = await app.inject({ method: 'GET', url: '/__app' });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({ message: 'Conflito de negócio', code: 'JA_EXISTE' });
    const bug = await app.inject({ method: 'GET', url: '/__bug' });
    expect(bug.statusCode).toBe(500);
    expect(bug.body).not.toMatch(/SELECT|senha/);
    // P2010 com código de Postgres desconhecido também é bug nosso (500), não erro do cliente
    expect((await app.inject({ method: 'GET', url: '/__p2010-outro' })).statusCode).toBe(500);
  });
});

describe('validação dos contratos (400 em vez de 500)', () => {
  async function authed() {
    const app = await boot();
    const reg = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Pedro', email: 'p@x.com', password: '12345678', acceptedTerms: true },
    });
    const headers = { authorization: `Bearer ${reg.json().accessToken}` };
    return { app, headers };
  }

  it('mês inválido (00, 13..99, formato) → 400; mês bom → 200', async () => {
    const { app, headers } = await authed();
    for (const month of ['2026-13', '2026-00', '2026-99', '2026-1', '26-11', 'abc', '2026-11-01']) {
      const res = await app.inject({ method: 'GET', url: `/transactions?month=${month}`, headers });
      expect(res.statusCode, month).toBe(400);
    }
    expect((await app.inject({ method: 'GET', url: '/transactions?month=2026-12', headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/transactions?month=2026-01', headers })).statusCode).toBe(200);
  });

  it('valor acima de R$ 100 milhões → 400 (lançamento, edição e saldo de conta manual)', async () => {
    const { app, headers } = await authed();
    const tooBig = 999_999_999_999;
    const create = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers,
      payload: { description: 'Mansão', amountInCents: tooBig, kind: 'saida', occurredAt: '2026-11-10' },
    });
    expect(create.statusCode).toBe(400);
    const ok = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers,
      payload: { description: 'Teto', amountInCents: 10_000_000_000, kind: 'entrada', occurredAt: '2026-11-10' },
    });
    expect(ok.statusCode).toBe(201);
    const id = ok.json().id as string;
    const edit = await app.inject({
      method: 'PATCH',
      url: `/transactions/${id}`,
      headers,
      payload: { amountInCents: -tooBig },
    });
    expect(edit.statusCode).toBe(400);
    const account = await app.inject({
      method: 'POST',
      url: '/accounts',
      headers,
      payload: { name: 'Cofre', type: 'BANK', balanceInCents: tooBig },
    });
    expect(account.statusCode).toBe(400);
    const above = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers,
      payload: {
        description: 'Um centavo a mais',
        amountInCents: 10_000_000_001,
        kind: 'saida',
        occurredAt: '2026-11-10',
      },
    });
    expect(above.statusCode).toBe(400);
  });

  it('descrição acima de 140 caracteres e id que não é UUID → 400', async () => {
    const { app, headers } = await authed();
    const long = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers,
      payload: { description: 'x'.repeat(141), amountInCents: 100, kind: 'saida', occurredAt: '2026-11-10' },
    });
    expect(long.statusCode).toBe(400);
    for (const url of ['/transactions/nao-e-uuid', '/people/123', '/connections/abc/sync']) {
      const method = url.endsWith('/sync') ? 'POST' : 'GET';
      const res = await app.inject({ method, url, headers });
      expect(res.statusCode, url).toBe(400);
    }
    // UUID bem formado mas inexistente segue 404 (não 400)
    expect(
      (await app.inject({ method: 'GET', url: '/transactions/11111111-1111-4111-8111-111111111111', headers }))
        .statusCode,
    ).toBe(404);
  });

  it('meta com prazo 2026-13 → 400; adiantamento maior que o salário → 400; voto do tribunal só 0 ou 1', async () => {
    const { app, headers } = await authed();
    const goal = await app.inject({
      method: 'POST',
      url: '/goals',
      headers,
      payload: { kind: 'reserva', amountInCents: 100000, deadline: '2026-13' },
    });
    expect(goal.statusCode).toBe(400);
    const plan = await app.inject({
      method: 'PUT',
      url: '/plan',
      headers,
      payload: {
        salary: { amountInCents: 300000, payday: 5, advance: { day: 20, amountInCents: 400000 } },
        goal: null,
      },
    });
    expect(plan.statusCode).toBe(400);
    expect(plan.json().message).toMatch(/adiantamento/i);
    for (const choice of [2, 3, -1]) {
      const vote = await app.inject({
        method: 'POST',
        url: '/tribunal/votes',
        headers,
        payload: { caseId: 'c1', choice },
      });
      expect(vote.statusCode, String(choice)).toBe(400);
    }
  });
});
