// Teste de ponta a ponta da API inteira, com repositórios em memória (sem Postgres).
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { makeInMemoryRepositories } from './repositories/in-memory/index.js';
import { FakeBankGateway } from './gateways/fake-bank-gateway.js';
import { FakeAiGateway } from './gateways/ai-gateway.js';
import { currentMonth } from './lib/month.js';
import { connectBankBody } from '@tostao/contracts';

describe('API', () => {
  it('cadastro → conectar → resumo → categorizar', async () => {
    const app = await buildApp({
      repos: makeInMemoryRepositories(),
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-123',
      webOrigin: '*',
    });

    const reg = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Pedro', email: 'P@X.com', password: '12345678', acceptedTerms: true },
    });
    expect(reg.statusCode).toBe(201);
    const auth = { authorization: `Bearer ${reg.json().accessToken}` };

    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);

    // Cadastro aberto: entra sem convite; com convite, fica marcado quem chamou
    const semConvite = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Ana', email: 'a@x.com', password: '12345678', acceptedTerms: true },
    });
    expect(semConvite.statusCode).toBe(201);
    const { code } = (await app.inject({ method: 'POST', url: '/invites', headers: auth })).json();
    const comConvite = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Bia', email: 'b@x.com', password: '12345678', inviteCode: code, acceptedTerms: true },
    });
    expect(comConvite.statusCode).toBe(201);

    // Sessão renova com o refresh token (sem precisar do access token) e o token antigo deixa de valer
    const refreshed = await app.inject({
      method: 'POST',
      url: '/sessions/refresh',
      payload: { refreshToken: reg.json().refreshToken },
    });
    expect(refreshed.json().accessToken).toEqual(expect.any(String));
    expect(refreshed.json().refreshToken).not.toBe(reg.json().refreshToken);

    // 10 tentativas por IP + e-mail em 15 min: depois disso, até a senha certa recebe 429
    for (let i = 0; i < 10; i++)
      await app.inject({ method: 'POST', url: '/sessions', payload: { email: 'p@x.com', password: 'errada' } });
    expect(
      (await app.inject({ method: 'POST', url: '/sessions', payload: { email: 'p@x.com', password: '12345678' } }))
        .statusCode,
    ).toBe(429);
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth })).json().email).toBe('p@x.com');

    // Com o banco de exemplo não tem widget: o token vem null e a tela mostra só o campo manual
    const token = await app.inject({ method: 'POST', url: '/connections/connect-token', headers: auth });
    expect(token.json()).toEqual({ connectToken: null });

    const conn = await app.inject({
      method: 'POST',
      url: '/connections',
      headers: auth,
      payload: { itemId: 'item-de-exemplo' },
    });
    expect(conn.json().importedCount).toBe(12);

    const month = currentMonth();
    const list = (await app.inject({ method: 'GET', url: `/transactions?month=${month}`, headers: auth })).json();
    const pending = list.transactions.find(
      (t: { categoryId: string | null; isInternalTransfer: boolean }) => !t.categoryId && !t.isInternalTransfer,
    );
    const cat = await app.inject({
      method: 'PATCH',
      url: `/transactions/${pending.id}/category`,
      headers: auth,
      payload: { categoryId: 'delivery', remember: true },
    });
    expect(cat.statusCode).toBe(200);

    const summary = (await app.inject({ method: 'GET', url: `/summary?month=${month}`, headers: auth })).json();
    expect(summary.uncategorizedCount).toBe(0);

    const bad = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: auth,
      payload: { description: '', amountInCents: -5, kind: 'saida', occurredAt: 'ontem' },
    });
    expect(bad.statusCode).toBe(400);

    const me = (await app.inject({ method: 'GET', url: '/me', headers: auth })).json();
    // O ID bruto do provedor não sai da API: só flags derivadas.
    expect(me.connections[0]).not.toHaveProperty('itemId');
    expect(JSON.stringify(me)).not.toContain('item-de-exemplo');
    expect(me.connections[0]).toMatchObject({ isImport: false, isManual: false });
    const del = await app.inject({ method: 'DELETE', url: `/connections/${me.connections[0].id}`, headers: auth });
    expect(del.json()).toEqual({ providerDeleted: true });
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth })).json().connections).toHaveLength(0);
  });

  it('pesca o Item ID de dentro de um link colado', () => {
    const id = '3f1c2a9e-1b2c-4d5e-8f90-123456789abc';
    expect(connectBankBody.parse({ itemId: `https://meu.pluggy.ai/algo?itemId=${id.toUpperCase()}` }).itemId).toBe(id);
    expect(connectBankBody.parse({ itemId: `  ${id} ` }).itemId).toBe(id);
    expect(connectBankBody.safeParse({ itemId: 'curto' }).success).toBe(false);
  });

  it('rejeita Item ID com path injection ou prefixo de conexão interna', () => {
    for (const bad of [
      '../me/delete-account',
      '..%2f..%2fadmin',
      'abc12345/../x',
      'abc12345?x=1',
      'abc12345#frag',
      'abc\\12345',
      'import:nubank',
      'IMPORT:nubank',
      'manual:contas',
    ]) {
      expect(connectBankBody.safeParse({ itemId: bad }).success, bad).toBe(false);
    }
    expect(connectBankBody.safeParse({ itemId: 'item-de-exemplo' }).success).toBe(true);
  });

  it('limites por categoria e progresso das lições', async () => {
    const app = await buildApp({
      repos: makeInMemoryRepositories(),
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-123',
      webOrigin: '*',
    });
    const reg = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Pedro', email: 'lim@x.com', password: '12345678', acceptedTerms: true },
    });
    const auth = { authorization: `Bearer ${reg.json().accessToken}` };
    await app.inject({ method: 'POST', url: '/connections', headers: auth, payload: { itemId: 'item-de-exemplo' } });
    const month = currentMonth();

    expect(
      (await app.inject({ method: 'PUT', url: '/budgets/delivery', headers: auth, payload: { limitInCents: 30000 } }))
        .statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'PUT', url: '/budgets/salario', headers: auth, payload: { limitInCents: 100 } }))
        .statusCode,
    ).toBe(400);
    const { budgets } = (await app.inject({ method: 'GET', url: `/budgets?month=${month}`, headers: auth })).json();
    expect(budgets).toHaveLength(1);
    expect(budgets[0]).toMatchObject({ categoryId: 'delivery', limitInCents: 30000 });
    expect(budgets[0].spentInCents).toBeGreaterThan(0);
    await app.inject({ method: 'PUT', url: '/budgets/delivery', headers: auth, payload: { limitInCents: null } });
    expect(
      (await app.inject({ method: 'GET', url: `/budgets?month=${month}`, headers: auth })).json().budgets,
    ).toHaveLength(0);

    expect((await app.inject({ method: 'POST', url: '/progress/m1-l2', headers: auth })).statusCode).toBe(204);
    await app.inject({ method: 'POST', url: '/progress/m1-l2', headers: auth });
    expect((await app.inject({ method: 'POST', url: '/progress/qualquer', headers: auth })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/progress', headers: auth })).json()).toEqual({
      done: ['m1-l2'],
      streakDays: 1,
      doneToday: 1,
      bonusXp: 5,
    }); // +5 da missão de conferir limites;
  });
});

describe('Fase 0 · T0.5/T0.7: termos, consentimento de IA e confirmação (HTTP)', () => {
  async function boot() {
    const repos = makeInMemoryRepositories();
    const ai = new FakeAiGateway();
    ai.next = 'Oi! Tô aqui.';
    const app = await buildApp({
      repos,
      bank: new FakeBankGateway(),
      ai,
      jwtSecret: 'segredo-de-teste-123',
      webOrigin: '*',
    });
    const reg = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Pedro', email: 'p@x.com', password: '12345678', acceptedTerms: true },
    });
    const auth = { authorization: `Bearer ${reg.json().accessToken}` };
    return { app, repos, ai, auth };
  }

  it('cadastro sem acceptedTerms: true é recusado com 400 (o checkbox da web não basta)', async () => {
    const { app, repos } = await boot();
    for (const [i, acceptedTerms] of [undefined, false, 'true', 'on', 1, null].entries()) {
      const res = await app.inject({
        method: 'POST',
        url: '/users',
        headers: { 'x-forwarded-for': `10.1.0.${i + 1}` }, // IPs diferentes: o limite de cadastro é por IP
        payload: {
          name: 'Ana',
          email: 'ana@x.com',
          password: '12345678',
          ...(acceptedTerms === undefined ? {} : { acceptedTerms }),
        },
      });
      expect(res.statusCode).toBe(400);
    }
    expect(await repos.users.findByEmail('ana@x.com')).toBeNull();
  });

  it('cadastro com aceite grava quando e qual versão dos termos', async () => {
    const { repos } = await boot();
    const user = (await repos.users.findByEmail('p@x.com'))!;
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
    expect(user.termsVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(user.aiConsentAt).toBeNull(); // aceitar os termos NÃO é consentir com IA
  });

  it('IA bloqueada até aceitar: /chat e /transactions/auto-categorize respondem 403 AI_CONSENT_REQUIRED', async () => {
    const { app, ai, auth } = await boot();
    const chat = await app.inject({ method: 'POST', url: '/chat', headers: auth, payload: { message: 'oi' } });
    expect(chat.statusCode).toBe(403);
    expect(chat.json().code).toBe('AI_CONSENT_REQUIRED');
    const auto = await app.inject({ method: 'POST', url: '/transactions/auto-categorize', headers: auth });
    expect(auto.statusCode).toBe(403);
    expect(auto.json().code).toBe('AI_CONSENT_REQUIRED');
    expect(ai.calls).toHaveLength(0);
  });

  it('PATCH /me/consents aceita e revoga; /me mostra o estado; exige login e corpo válido', async () => {
    const { app, auth } = await boot();
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth })).json().aiConsentAt).toBeNull();

    const on = await app.inject({ method: 'PATCH', url: '/me/consents', headers: auth, payload: { aiConsent: true } });
    expect(on.statusCode).toBe(200);
    expect(typeof on.json().aiConsentAt).toBe('string');
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth })).json().aiConsentAt).toBe(
      on.json().aiConsentAt,
    );

    const chat = await app.inject({ method: 'POST', url: '/chat', headers: auth, payload: { message: 'oi' } });
    expect(chat.statusCode).toBe(200);
    expect(chat.json().pendingAction).toBeNull();

    const off = await app.inject({
      method: 'PATCH',
      url: '/me/consents',
      headers: auth,
      payload: { aiConsent: false },
    });
    expect(off.json().aiConsentAt).toBeNull();
    expect(
      (await app.inject({ method: 'POST', url: '/chat', headers: auth, payload: { message: 'oi' } })).statusCode,
    ).toBe(403);

    expect((await app.inject({ method: 'PATCH', url: '/me/consents', payload: { aiConsent: true } })).statusCode).toBe(
      401,
    );
    expect(
      (await app.inject({ method: 'PATCH', url: '/me/consents', headers: auth, payload: { aiConsent: 'sim' } }))
        .statusCode,
    ).toBe(400);
  });

  it('IA propõe → POST /chat devolve pendingAction → POST /chat/confirm grava (uma vez só)', async () => {
    const { app, repos, ai, auth } = await boot();
    await app.inject({ method: 'PATCH', url: '/me/consents', headers: auth, payload: { aiConsent: true } });
    ai.queue.push(
      {
        content: null,
        toolCalls: [
          {
            id: 'k',
            type: 'function',
            function: {
              name: 'registrar_transacao',
              arguments: '{"descricao":"Pizza","valor_reais":64.5,"tipo":"saida"}',
            },
          },
        ],
      },
      { content: 'Lanço a Pizza de R$ 64,50?', toolCalls: [] },
    );
    const chat = await app.inject({
      method: 'POST',
      url: '/chat',
      headers: auth,
      payload: { message: 'anota pizza 64,50' },
    });
    const pending = chat.json().pendingAction;
    expect(pending).toMatchObject({
      description: 'Pizza',
      amountInCents: 6450,
      type: 'saida',
      kind: 'registrar_transacao',
    });
    expect(pending.summary).toContain('Pizza');
    const userId = (await repos.users.findByEmail('p@x.com'))!.id;
    const count = async () =>
      (await repos.transactions.findManyInRange(userId, new Date(0), new Date(Date.now() + 86_400_000))).filter(
        (t) => t.description === 'Pizza',
      ).length;
    expect(await count()).toBe(0);

    const wrong = await app.inject({
      method: 'POST',
      url: '/chat/confirm',
      headers: auth,
      payload: { actionId: 'id-que-nao-existe' },
    });
    expect(wrong.statusCode).toBe(410);
    expect(await count()).toBe(0);

    const ok = await app.inject({
      method: 'POST',
      url: '/chat/confirm',
      headers: auth,
      payload: { actionId: pending.id },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ ok: true });
    expect(await count()).toBe(1);

    const again = await app.inject({
      method: 'POST',
      url: '/chat/confirm',
      headers: auth,
      payload: { actionId: pending.id },
    });
    expect(again.statusCode).toBe(410);
    expect(await count()).toBe(1);
    expect(
      (await app.inject({ method: 'POST', url: '/chat/confirm', payload: { actionId: pending.id } })).statusCode,
    ).toBe(401);
  });

  it('outra pessoa não confirma nem cancela a proposta alheia', async () => {
    const { app, repos, ai, auth } = await boot();
    await app.inject({ method: 'PATCH', url: '/me/consents', headers: auth, payload: { aiConsent: true } });
    ai.queue.push(
      {
        content: null,
        toolCalls: [
          {
            id: 'k',
            type: 'function',
            function: {
              name: 'registrar_transacao',
              arguments: '{"descricao":"Pizza","valor_reais":50,"tipo":"saida"}',
            },
          },
        ],
      },
      { content: 'ok?', toolCalls: [] },
    );
    const pending = (
      await app.inject({ method: 'POST', url: '/chat', headers: auth, payload: { message: 'anota pizza' } })
    ).json().pendingAction;
    const reg = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Bia', email: 'bia@x.com', password: '12345678', acceptedTerms: true },
    });
    const bia = { authorization: `Bearer ${reg.json().accessToken}` };
    expect(
      (await app.inject({ method: 'POST', url: '/chat/confirm', headers: bia, payload: { actionId: pending.id } }))
        .statusCode,
    ).toBe(410);
    expect(
      (await app.inject({ method: 'POST', url: '/chat/cancel', headers: bia, payload: { actionId: pending.id } }))
        .statusCode,
    ).toBe(410);
    // a proposta do Pedro continua de pé
    expect(
      (await app.inject({ method: 'POST', url: '/chat/confirm', headers: auth, payload: { actionId: pending.id } }))
        .statusCode,
    ).toBe(200);
    const biaId = (await repos.users.findByEmail('bia@x.com'))!.id;
    expect(
      await repos.transactions.findManyInRange(biaId, new Date(0), new Date(Date.now() + 86_400_000)),
    ).toHaveLength(0);
  });
});
