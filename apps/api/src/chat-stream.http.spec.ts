import { describe, expect, it } from 'vitest';
import type { ChatStreamEvent } from '@tostao/contracts';
import { buildApp, CONNECTION_TIMEOUT_MS } from './app.js';
import { SSE_HEARTBEAT_MS } from './http/controllers/chat.js';
import { makeInMemoryRepositories } from './repositories/in-memory/index.js';
import { FakeBankGateway } from './gateways/fake-bank-gateway.js';
import { FakeAiGateway } from './gateways/ai-gateway.js';

// T4.5 · POST /chat/stream pela borda HTTP: SSE de verdade (inject), com as travas da Fase 0 no mesmo lugar.

async function boot({ consent = true }: { consent?: boolean } = {}) {
  const repos = makeInMemoryRepositories();
  const ai = new FakeAiGateway();
  ai.next = 'Oi! Tô aqui pra ajudar com o seu dinheiro.';
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
  if (consent) await app.inject({ method: 'PATCH', url: '/me/consents', headers: auth, payload: { aiConsent: true } });
  return { app, repos, ai, auth };
}

/** Lê o corpo SSE (`data: {json}\n\n`) como lista de eventos. */
const events = (payload: string) =>
  payload
    .split('\n\n')
    .filter((b) => b.startsWith('data: '))
    .map((b) => JSON.parse(b.slice(6)) as ChatStreamEvent);

describe('POST /chat/stream', () => {
  it('responde text/event-stream com status, deltas e done (turno gravado), sem cache', async () => {
    const { app, repos, auth } = await boot();
    const res = await app.inject({ method: 'POST', url: '/chat/stream', headers: auth, payload: { message: 'oi' } });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-cache');
    expect(res.headers['x-accel-buffering']).toBe('no');

    const evs = events(res.payload);
    expect(evs[0]).toEqual({ type: 'status', text: 'Pensando...' });
    const text = evs
      .filter((e): e is Extract<ChatStreamEvent, { type: 'delta' }> => e.type === 'delta')
      .map((e) => e.text)
      .join('');
    expect(text).toBe('Oi! Tô aqui pra ajudar com o seu dinheiro.');
    const done = evs.at(-1)!;
    expect(done).toMatchObject({
      type: 'done',
      reply: { role: 'assistant', content: text },
      question: { role: 'user', content: 'oi' },
      pendingAction: null,
    });
    expect(repos.chat.items.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('exige login (401) e corpo válido (400), antes de qualquer streaming', async () => {
    const { app, auth } = await boot();
    expect((await app.inject({ method: 'POST', url: '/chat/stream', payload: { message: 'oi' } })).statusCode).toBe(
      401,
    );
    const bad = await app.inject({ method: 'POST', url: '/chat/stream', headers: auth, payload: { message: '   ' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.headers['content-type']).not.toContain('text/event-stream');
  });

  it('LGPD: sem aceite é HTTP 403 AI_CONSENT_REQUIRED normal (não SSE) e nada é gravado', async () => {
    const { app, repos, ai, auth } = await boot({ consent: false });
    const res = await app.inject({ method: 'POST', url: '/chat/stream', headers: auth, payload: { message: 'oi' } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'AI_CONSENT_REQUIRED' });
    expect(res.headers['content-type']).not.toContain('text/event-stream');
    expect(ai.calls).toHaveLength(0);
    expect(repos.chat.items).toHaveLength(0);
  });

  it('IA propõe → done traz pendingAction → só POST /chat/confirm grava (uma vez)', async () => {
    const { app, repos, ai, auth } = await boot();
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
    const res = await app.inject({
      method: 'POST',
      url: '/chat/stream',
      headers: auth,
      payload: { message: 'anota pizza 64,50' },
    });
    const done = events(res.payload).at(-1)!;
    if (done.type !== 'done') throw new Error('sem done');
    expect(done.pendingAction).toMatchObject({
      description: 'Pizza',
      amountInCents: 6450,
      kind: 'registrar_transacao',
    });
    expect(done.followUps).toContain('Anotar outro gasto');

    const userId = (await repos.users.findByEmail('p@x.com'))!.id;
    const pizzas = async () =>
      (await repos.transactions.findManyInRange(userId, new Date(0), new Date(Date.now() + 86_400_000))).filter(
        (t) => t.description === 'Pizza',
      ).length;
    expect(await pizzas()).toBe(0); // o stream NUNCA grava

    const ok = await app.inject({
      method: 'POST',
      url: '/chat/confirm',
      headers: auth,
      payload: { actionId: done.pendingAction!.id },
    });
    expect(ok.statusCode).toBe(200);
    expect(await pizzas()).toBe(1);
    const again = await app.inject({
      method: 'POST',
      url: '/chat/confirm',
      headers: auth,
      payload: { actionId: done.pendingAction!.id },
    });
    expect(again.statusCode).toBe(410);
    expect(await pizzas()).toBe(1);
  });

  it('IA fora do ar: 200 SSE com UM evento de erro 503 (já começou o stream), nada gravado', async () => {
    const { app, repos, ai, auth } = await boot();
    ai.chatStream = async function* () {
      yield { type: 'delta', text: 'Você ' };
      throw new (await import('./gateways/ai-gateway.js')).AiUnavailableError('caiu');
    };
    const res = await app.inject({ method: 'POST', url: '/chat/stream', headers: auth, payload: { message: 'oi' } });
    const evs = events(res.payload);
    expect(evs.at(-1)).toMatchObject({ type: 'error', status: 503 });
    expect(evs.some((e) => e.type === 'done')).toBe(false);
    expect(repos.chat.items).toHaveLength(0);
  });

  it('o POST /chat (fallback do app) também devolve followUps e cards', async () => {
    const { app, auth } = await boot();
    const res = await app.inject({ method: 'POST', url: '/chat', headers: auth, payload: { message: 'oi' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().followUps.length).toBeGreaterThanOrEqual(2);
    expect(res.json().cards).toEqual([]);
  });

  it('heartbeat do SSE bem abaixo do connectionTimeout da API (senão IA lenta derruba o stream no meio: provado no teste real, 12 s sem token)', () => {
    expect(SSE_HEARTBEAT_MS).toBeLessThanOrEqual(CONNECTION_TIMEOUT_MS / 2);
  });
});
