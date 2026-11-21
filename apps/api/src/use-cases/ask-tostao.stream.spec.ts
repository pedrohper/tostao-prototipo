import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import {
  AiUnavailableError,
  FakeAiGateway,
  type AiOptions,
  type AiStreamEvent,
  type ChatTurn,
} from '../gateways/ai-gateway.js';
import { MemoryKeyValueStore } from '../lib/redis.js';
import { PendingActionStore } from '../services/pending-actions.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';
import { ConnectBankUseCase } from './connect-bank.js';
import { AskTostaoUseCase, type AskStreamEvent } from './ask-tostao.js';
import { PendingActionUseCase } from './pending-actions.js';

// T4.5: o chat em streaming. Mesmas travas do `execute` (consentimento, cota, scrubbing, "só propõe"), mais o
// que é próprio do stream: ordem dos eventos, fallback sem IA, queda no meio e cancelamento.

const NOW = new Date(Date.UTC(2026, 10, 20, 18));
const DAY = 86_400_000;

async function setup({ consent = true }: { consent?: boolean } = {}) {
  const repos = makeInMemoryRepositories();
  const user = await repos.users.create({ name: 'Pedro Henrique Pereira', email: 'p@x.com', passwordHash: 'x' });
  if (consent) await repos.users.setAiConsent(user.id, NOW);
  const bank = new FakeBankGateway(() => NOW);
  const sync = new SyncBankConnectionUseCase({ ...repos, bank, now: () => NOW });
  await new ConnectBankUseCase(repos.connections, bank, sync).execute({ userId: user.id, itemId: 'item-123456' });
  const kv = new MemoryKeyValueStore();
  const pendingStore = new PendingActionStore(kv, () => NOW);
  const ask = (ai: FakeAiGateway, limit = 40) => new AskTostaoUseCase(repos, ai, limit, () => NOW, kv, pendingStore);
  const pendingActions = new PendingActionUseCase(pendingStore, repos);
  return { repos, userId: user.id, kv, ask, pendingActions, pendingStore };
}

const toolCall = (name: string, args: Record<string, unknown>, id = 'call_1') => ({
  content: null,
  toolCalls: [{ id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } }],
});
const collect = async (gen: AsyncGenerator<AskStreamEvent, void, undefined>) => {
  const events: AskStreamEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
};
const txCount = async (repos: Awaited<ReturnType<typeof setup>>['repos'], userId: string) =>
  (await repos.transactions.findManyInRange(userId, new Date(0), new Date(NOW.getTime() + DAY))).length;

/** IA de mentira que escreve do jeito que o teste mandar (e pode travar esperando o cancelamento). */
class ScriptedAi extends FakeAiGateway {
  constructor(private readonly script: (opts?: AiOptions) => AsyncGenerator<AiStreamEvent, void, undefined>) {
    super();
  }
  override chatStream(_messages: ChatTurn[], opts?: AiOptions) {
    return this.script(opts);
  }
}
const waitForAbort = (signal?: AbortSignal) =>
  new Promise<never>((_, reject) => {
    const fail = () => reject(new AiUnavailableError('cancelado'));
    if (signal?.aborted) fail();
    else signal?.addEventListener('abort', fail, { once: true });
  });

afterEach(() => vi.useRealTimers());

describe('chat em streaming', () => {
  it('manda status, depois o texto em pedaços, e fecha com done (turno gravado uma vez)', async () => {
    const { repos, userId, ask } = await setup();
    const ai = new FakeAiGateway();
    ai.next = 'Você gastou **R$ 300** em delivery. Quer um limite?';
    const events = await collect(ask(ai).stream({ userId, message: ' Quanto gastei? ' }));

    expect(events[0]).toEqual({ type: 'status', text: 'Pensando...' });
    const deltas = events.filter((e) => e.type === 'delta');
    expect(deltas.length).toBeGreaterThan(2); // chegou em pedaços, não de uma vez
    expect(deltas.map((e) => (e as { text: string }).text).join('')).toBe(ai.next);

    const done = events.at(-1)!;
    expect(done.type).toBe('done');
    if (done.type !== 'done') throw new Error('sem done');
    expect(done.question.content).toBe('Quanto gastei?');
    expect(done.reply.content).toBe(ai.next);
    expect(done.remainingToday).toBe(39);
    expect(done.pendingAction).toBeNull();
    expect(done.followUps.length).toBeGreaterThanOrEqual(2);
    expect(done.followUps.length).toBeLessThanOrEqual(3);
    expect(repos.chat.items.map((m) => m.role)).toEqual(['user', 'assistant']);
  });

  it('FakeAiGateway (sem chave): o aviso honesto também chega em pedaços e o turno fecha normal', async () => {
    const { userId, ask } = await setup();
    const events = await collect(ask(new FakeAiGateway()).stream({ userId, message: 'oi' }));
    const text = events
      .filter((e) => e.type === 'delta')
      .map((e) => (e as { text: string }).text)
      .join('');
    expect(text).toContain('sem cérebro ligado');
    expect(events.at(-1)!.type).toBe('done');
  });

  it('ferramenta: avisa "Consultando seu extrato...", monta o card da categoria e sugere perguntas do contexto', async () => {
    const { userId, ask } = await setup();
    const ai = new FakeAiGateway();
    ai.queue.push(toolCall('consultar_gastos_categoria', { categoria: 'Delivery' }), {
      content: 'Delivery pesou esse mês.',
      toolCalls: [],
    });
    const events = await collect(ask(ai).stream({ userId, message: 'quanto gastei em delivery?' }));

    const statuses = events.filter((e) => e.type === 'status').map((e) => (e as { text: string }).text);
    expect(statuses).toEqual(['Pensando...', 'Consultando seu extrato...']);
    const done = events.at(-1)!;
    if (done.type !== 'done') throw new Error('sem done');
    expect(done.cards).toHaveLength(1);
    expect(done.cards[0]).toMatchObject({
      kind: 'categoria',
      categoryName: 'Delivery',
      month: '2026-11',
      href: expect.stringContaining('/carteira?mes=2026-11&cat='),
    });
    expect(done.followUps.some((q) => q.includes('Delivery'))).toBe(true);
    expect(done.followUps).not.toContain('quanto gastei em delivery?');
  });

  describe('as travas da Fase 0 valem igual no stream', () => {
    it('LGPD: sem aceite sai exceção ANTES do 1º evento, nada vai pra IA e a cota fica intacta', async () => {
      const { repos, userId, ask, kv } = await setup({ consent: false });
      const ai = new FakeAiGateway();
      const err = await collect(ask(ai).stream({ userId, message: 'oi' })).catch((e) => e);
      expect(err).toMatchObject({ statusCode: 403, code: 'AI_CONSENT_REQUIRED' });
      expect(ai.calls).toHaveLength(0);
      expect(repos.chat.items).toHaveLength(0);
      expect(await kv.get(`ai:chat:quota:${userId}`)).toBeNull();
    });

    it('cota: estourou o limite diário = 429 antes do 1º evento', async () => {
      const { userId, ask } = await setup();
      const uc = ask(new FakeAiGateway(), 1);
      await collect(uc.stream({ userId, message: 'oi' }));
      await expect(collect(uc.stream({ userId, message: 'oi de novo' }))).rejects.toMatchObject({ statusCode: 429 });
    });

    it('PII scrubbing: o que chega no stream da IA é o mesmo contexto mascarado (CPF, e-mail, Pix com nome)', async () => {
      const { repos, userId, ask } = await setup();
      for (const description of ['PIX ENVIADO MARIA APARECIDA SOUZA 123.456.789-09', 'TRANSF joao.silva@gmail.com']) {
        await repos.transactions.create({
          userId,
          accountId: null,
          externalId: null,
          description,
          amountInCents: -1000,
          occurredAt: NOW,
          categoryId: null,
          isInternalTransfer: false,
          seriesId: null,
        });
      }
      const ai = new FakeAiGateway();
      await collect(ask(ai).stream({ userId, message: 'oi' }));
      const system = (ai.calls[0]![0] as { content: string }).content;
      expect(system).toContain('A pessoa se chama Pedro.');
      expect(system).toContain('PIX ENVIADO [PESSOA]');
      expect(system).not.toMatch(/Henrique|Pereira|MARIA|SOUZA|123\.456|joao\.silva|gmail/);
    });

    it('registrar_transacao só PROPÕE: nada é gravado no stream; confirmar (com o id do done) grava uma vez', async () => {
      const { repos, userId, ask, pendingActions } = await setup();
      const ai = new FakeAiGateway();
      ai.queue.push(
        toolCall('registrar_transacao', { descricao: 'Pizza', valor_reais: 64.5, tipo: 'saida', data: '2026-11-19' }),
        { content: 'Vou lançar a Pizza de R$ 64,50. Confirma?', toolCalls: [] },
      );
      const before = await txCount(repos, userId);
      const events = await collect(ask(ai).stream({ userId, message: 'anota 64,50 de pizza ontem' }));

      expect(events.some((e) => e.type === 'status' && e.text.includes('lançamento'))).toBe(true);
      expect(await txCount(repos, userId)).toBe(before); // NADA gravado ainda
      const done = events.at(-1)!;
      if (done.type !== 'done') throw new Error('sem done');
      expect(done.pendingAction).toMatchObject({ description: 'Pizza', amountInCents: 64_50, date: '2026-11-19' });
      expect(done.followUps).toContain('Anotar outro gasto');

      await expect(pendingActions.confirm({ userId, actionId: 'forjado-123456' })).rejects.toMatchObject({
        statusCode: 410,
      });
      await pendingActions.confirm({ userId, actionId: done.pendingAction!.id });
      expect(await txCount(repos, userId)).toBe(before + 1);
      await expect(pendingActions.confirm({ userId, actionId: done.pendingAction!.id })).rejects.toMatchObject({
        statusCode: 410,
      });
    });
  });

  describe('quedas e cancelamento: nada pela metade', () => {
    it('a IA cai antes de qualquer texto: evento de erro 503, nada gravado', async () => {
      const { repos, userId, ask } = await setup();
      // eslint-disable-next-line require-yield -- cai antes do 1º pedaço
      const ai = new ScriptedAi(async function* () {
        throw new AiUnavailableError('fora do ar');
      });
      const events = await collect(ask(ai).stream({ userId, message: 'oi' }));
      expect(events.at(-1)).toMatchObject({ type: 'error', status: 503 });
      expect(events.some((e) => e.type === 'done')).toBe(false);
      expect(repos.chat.items).toHaveLength(0);
    });

    it('a conexão com a IA cai NO MEIO da resposta: erro, e a resposta parcial não vira histórico', async () => {
      const { repos, userId, ask } = await setup();
      const ai = new ScriptedAi(async function* () {
        yield { type: 'delta', text: 'Você gastou ' };
        throw new AiUnavailableError('streaming interrompido');
      });
      const events = await collect(ask(ai).stream({ userId, message: 'oi' }));
      expect(events.filter((e) => e.type === 'delta')).toHaveLength(1);
      expect(events.at(-1)).toMatchObject({ type: 'error', status: 503 });
      expect(repos.chat.items).toHaveLength(0);
    });

    it('resposta vazia: erro, não grava', async () => {
      const { repos, userId, ask } = await setup();
      const ai = new ScriptedAi(async function* () {});
      const events = await collect(ask(ai).stream({ userId, message: 'oi' }));
      expect(events.at(-1)).toMatchObject({ type: 'error', status: 503 });
      expect(repos.chat.items).toHaveLength(0);
    });

    it('a pessoa fecha a aba no meio: para, não grava e não deixa proposta órfã valendo', async () => {
      const { repos, userId, ask, pendingStore } = await setup();
      const abort = new AbortController();
      const ai = new FakeAiGateway();
      ai.queue.push(toolCall('registrar_transacao', { descricao: 'Uber', valor_reais: 20, tipo: 'saida' }));
      const propose = vi.spyOn(pendingStore, 'propose');
      let round = 0;
      const scripted = new ScriptedAi(async function* (opts) {
        round++;
        if (round === 1) return void (yield* ai.chatStream([], opts)); // rodada 1: a IA pede a ferramenta
        yield { type: 'delta', text: 'Posso anotar ' }; // rodada 2: começa a escrever...
        abort.abort(); // ...e a pessoa sai aqui
        await waitForAbort(opts?.signal);
      });
      const events = await collect(ask(scripted).stream({ userId, message: 'anota uber 20', signal: abort.signal }));

      expect(propose).toHaveBeenCalledTimes(1); // a proposta existiu...
      expect(await pendingStore.peek(userId)).toBeNull(); // ...e foi descartada (ninguém viu o botão)
      expect(events.some((e) => e.type === 'done' || e.type === 'error')).toBe(false);
      expect(repos.chat.items).toHaveLength(0);
    });

    it('o turno tem teto de 35 s: IA travada vira erro 503 e não grava', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const { repos, userId, ask } = await setup();
      // eslint-disable-next-line require-yield -- trava esperando o cancelamento
      const hung = new ScriptedAi(async function* (opts) {
        await waitForAbort(opts?.signal);
      });
      const promise = collect(ask(hung).stream({ userId, message: 'oi' }));
      await vi.advanceTimersByTimeAsync(35_001);
      const events = await promise;
      expect(events.at(-1)).toMatchObject({ type: 'error', status: 503 });
      expect(repos.chat.items).toHaveLength(0);
    });
  });

  it('o execute() (WhatsApp e fallback do app) também devolve cards e sugestões', async () => {
    const { userId, ask } = await setup();
    const ai = new FakeAiGateway();
    ai.queue.push(toolCall('consultar_gastos_categoria', { categoria: 'Delivery' }), {
      content: 'Delivery pesou.',
      toolCalls: [],
    });
    const r = await ask(ai).execute({ userId, message: 'quanto gastei em delivery?' });
    expect(r.cards).toHaveLength(1);
    expect(r.followUps.length).toBeGreaterThanOrEqual(2);
  });
});
