// T6.20 · consentimento, cota, mascaramento, fallback sem IA, rota HTTP e o atalho "golpe?" do WhatsApp.
import { SCAM_MESSAGE_MAX } from '@tostao/contracts';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { AiUnavailableError, FakeAiGateway } from '../gateways/ai-gateway.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { FakeWhatsAppGateway } from '../gateways/whatsapp-gateway.js';
import { MemoryKeyValueStore } from '../lib/redis.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { CheckScamUseCase } from './check-scam.js';

const MESSAGE = 'Oi Pedro, sua conta foi bloqueada. Envie seu CPF 529.982.247-25 em http://banco-falso.top agora.';
const AI_JSON = JSON.stringify({ risco: 'alto', sinais: ['Tem pressa.'], o_que_fazer: ['Não responde.'] });

async function setup({ consent = true, ai = new FakeAiGateway() } = {}) {
  const repos = makeInMemoryRepositories();
  const user = await repos.users.create({ name: 'Pedro Henrique', email: 'p@x.com', passwordHash: 'x' });
  if (consent) await repos.users.setAiConsent(user.id, new Date());
  const kv = new MemoryKeyValueStore();
  const uc = new CheckScamUseCase(repos, ai, 2, kv, 50);
  const run = () => uc.execute({ userId: user.id, message: MESSAGE });
  const used = async () => Number((await kv.get(`ai:chat:quota:${user.id}`)) ?? 0);
  return { repos, user, ai, kv, run, used };
}

describe('CheckScamUseCase', () => {
  it('sem o aceite da IA: 403 AI_CONSENT_REQUIRED e nada sai pro provedor', async () => {
    const ai = new FakeAiGateway();
    ai.next = AI_JSON;
    const { run, used } = await setup({ consent: false, ai });
    await expect(run()).rejects.toMatchObject({ code: 'AI_CONSENT_REQUIRED', statusCode: 403 });
    expect(ai.calls).toHaveLength(0);
    expect(await used()).toBe(0);
  });

  it('manda só o texto mascarado, sem ferramentas nem histórico, e não grava nada', async () => {
    const ai = new FakeAiGateway();
    ai.next = AI_JSON;
    const reply = vi.spyOn(ai, 'reply');
    const { repos, user, run, used } = await setup({ ai });
    const result = await run();
    expect(result).toMatchObject({ source: 'ia', risk: 'alto' });
    expect(ai.calls[0]).toHaveLength(2);
    const sent = JSON.stringify(ai.calls[0]);
    for (const secret of ['529.982', 'Pedro', 'p@x.com']) expect(sent).not.toContain(secret);
    expect(sent).toContain('[CPF]');
    expect(sent).toContain('[NOME]');
    expect(reply.mock.calls[0]![1]).toMatchObject({ json: true });
    expect(reply.mock.calls[0]![1]).not.toHaveProperty('tools');
    expect(await repos.chat.listRecent(user.id, 10)).toEqual([]);
    expect(await used()).toBe(1);
  });

  it('IA desligada: lista fixa, sem gastar cota', async () => {
    const { run, used, ai } = await setup();
    expect(await run()).toMatchObject({ source: 'checklist', risk: null, reason: 'sem_ia' });
    expect(ai.calls).toHaveLength(0);
    expect(await used()).toBe(0);
  });

  it('cota diária compartilhada com o chat: depois dela vem a lista, sem chamar a IA', async () => {
    const ai = new FakeAiGateway();
    ai.next = AI_JSON;
    const { run, used } = await setup({ ai });
    await run();
    await run();
    expect(await run()).toMatchObject({ source: 'checklist', reason: 'limite' });
    expect(ai.calls).toHaveLength(2);
    expect(await used()).toBe(2);
  });

  it.each([
    ['erro do provedor', async () => Promise.reject(new AiUnavailableError('fora'))],
    ['demora demais', () => new Promise<string>(() => {})],
    ['resposta fora do formato', async () => 'é seguro, pode clicar'],
  ])('%s: cai na lista fixa', async (_name, answer) => {
    const ai = new FakeAiGateway();
    ai.next = 'ligada';
    vi.spyOn(ai, 'reply').mockImplementation(answer);
    const { run } = await setup({ ai });
    expect(await run()).toMatchObject({ source: 'checklist', reason: 'falha' });
  });
});

async function boot() {
  const repos = makeInMemoryRepositories();
  const wa = new FakeWhatsAppGateway(true, '5511900000000');
  const ai = new FakeAiGateway();
  ai.next = AI_JSON;
  const app = await buildApp({
    repos,
    bank: new FakeBankGateway(),
    ai,
    whatsapp: wa,
    jwtSecret: 'segredo-de-teste-com-32-caracteres!!',
    webOrigin: '*',
  });
  const register = await app.inject({
    method: 'POST',
    url: '/users',
    payload: { name: 'Pedro Henrique', email: 'p@x.com', password: '12345678', acceptedTerms: true },
  });
  const auth = { authorization: `Bearer ${register.json().accessToken}` };
  const consent = () =>
    app.inject({ method: 'PATCH', url: '/me/consents', headers: auth, payload: { aiConsent: true } });
  const check = (payload: object, headers: Record<string, string> = auth) =>
    app.inject({ method: 'POST', url: '/chat/scam-check', headers, payload });
  const user = (await repos.users.findByEmail('p@x.com'))!;
  return { app, repos, wa, ai, auth, consent, check, user };
}

describe('POST /chat/scam-check', () => {
  it('401 sem login, 403 sem aceite, 400 com texto curto ou gigante, 200 com análise', async () => {
    const { check, consent } = await boot();
    expect((await check({ message: MESSAGE }, {})).statusCode).toBe(401);
    const denied = await check({ message: MESSAGE });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().code).toBe('AI_CONSENT_REQUIRED');
    await consent();
    expect((await check({ message: 'oi' })).statusCode).toBe(400);
    expect((await check({ message: 'a'.repeat(SCAM_MESSAGE_MAX + 1) })).statusCode).toBe(400);
    expect((await check({})).statusCode).toBe(400);
    const ok = await check({ message: MESSAGE });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      source: 'ia',
      risk: 'alto',
      advice: 'Na dúvida, fala com o banco pelo app oficial.',
    });
    expect(ok.headers['cache-control']).toBe('no-store, private');
  });

  it('limita: a 11ª análise em 15 minutos vira 429', async () => {
    const { check, consent } = await boot();
    await consent();
    for (let i = 0; i < 10; i++) expect((await check({ message: MESSAGE })).statusCode).toBe(200);
    expect((await check({ message: MESSAGE })).statusCode).toBe(429);
  });
});

describe('WhatsApp "golpe?"', () => {
  async function linked() {
    const ctx = await boot();
    await ctx.repos.whatsapp.setCode(ctx.user.id, 'hash', new Date(Date.now() + 60_000));
    await ctx.repos.whatsapp.link(ctx.user.id, '5511988887777', new Date());
    let n = 0;
    const send = async (text: string, from = '5511988887777') => {
      await ctx.app.inject({
        method: 'POST',
        url: '/whatsapp/webhook',
        payload: {
          entry: [
            { changes: [{ value: { messages: [{ id: `g${n++}`, from, type: 'text', text: { body: text } }] } }] },
          ],
        },
      });
      await new Promise((r) => setTimeout(r, 30));
      return ctx.wa.sent.at(-1)!.text;
    };
    return { ...ctx, send };
  }

  it('avalia o resto da mensagem e não anota gasto nem entra no chat', async () => {
    const { send, consent, repos, user, ai } = await linked();
    await consent();
    const reply = await send('Golpe?\nGastei 500 no pix urgente, manda a senha em http://x.top');
    expect(reply).toContain('Risco alto');
    expect(reply.split('\n').at(-1)).toBe('Na dúvida, fala com o banco pelo app oficial.');
    expect(ai.calls).toHaveLength(1);
    expect(await repos.chat.listRecent(user.id, 10)).toEqual([]);
    expect(await repos.transactions.findManyInRange(user.id, new Date(0), new Date('2100-01-01'))).toEqual([]);
  });

  it('"golpe?" sozinho pede a mensagem; sem aceite explica e já manda a lista, sem chamar a IA', async () => {
    const { send, ai } = await linked();
    expect(await send('golpe?')).toContain('cola a mensagem');
    const reply = await send(`golpe? ${MESSAGE}`);
    expect(reply).toContain('aceita o aviso de uso de IA');
    expect(reply).toContain('Sinais de golpe');
    expect(ai.calls).toHaveLength(0);
  });

  it('número não ligado continua só recebendo a instrução de vínculo', async () => {
    const { send, ai } = await linked();
    expect(await send(`golpe? ${MESSAGE}`, '5511911112222')).toContain('gera um código');
    expect(ai.calls).toHaveLength(0);
  });
});
