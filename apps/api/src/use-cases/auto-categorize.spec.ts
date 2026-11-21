import { describe, expect, it, vi } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeAiGateway } from '../gateways/ai-gateway.js';
import { MemoryKeyValueStore } from '../lib/redis.js';
import { AutoCategorizeUseCase } from './auto-categorize.js';

async function setup({ consent = true }: { consent?: boolean } = {}) {
  const repos = makeInMemoryRepositories();
  const user = await repos.users.create({ name: 'Pedro', email: 'p@x.com', passwordHash: 'x' });
  if (consent) await repos.users.setAiConsent(user.id, new Date());
  const uid = user.id;
  const ai = new FakeAiGateway();
  const kv = new MemoryKeyValueStore();
  const log = vi.fn();
  const add = (
    description: string,
    amountInCents: number,
    extra: { categoryId?: string; isInternalTransfer?: boolean } = {},
  ) =>
    repos.transactions.create({
      userId: uid,
      accountId: 'a1',
      externalId: null,
      description,
      amountInCents,
      occurredAt: new Date('2026-11-10T12:00:00Z'),
      categoryId: extra.categoryId ?? null,
      isInternalTransfer: extra.isInternalTransfer ?? false,
    });
  return { repos, ai, add, uid, kv, log, uc: new AutoCategorizeUseCase(repos, ai, kv, log) };
}

describe('Categoria automática com IA', () => {
  it('categoriza o que a IA sabe e nem manda Pix/TED puro pra pessoa (não dá pra categorizar mesmo)', async () => {
    const { repos, ai, add, uid, uc } = await setup();
    const ifood = await add('IFOOD *RESTAURANTE', -4590);
    const pix = await add('PIX ENVIADO JOAO DA SILVA', -2000);
    const uber = await add('UBER *TRIP', -1890);
    const order = (await repos.transactions.findUncategorized(uid))
      .filter((t) => t.id !== pix.id)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .map((t) => t.id);
    const map: Record<string, string | null> = {};
    map[String(order.indexOf(ifood.id))] = 'delivery';
    map[String(order.indexOf(uber.id))] = 'transporte';
    ai.next = JSON.stringify({ t: map });

    const r = await uc.execute({ userId: uid });
    expect(r).toEqual({ categorized: 2, asked: 2 });
    expect((await repos.transactions.findById(ifood.id))!.categoryId).toBe('delivery');
    expect((await repos.transactions.findById(uber.id))!.categoryId).toBe('transporte');
    expect((await repos.transactions.findById(pix.id))!.categoryId).toBeNull();
    const prompt = ai.calls[0]![1]!.content as string;
    expect(prompt).not.toContain('JOAO');
    expect(prompt).not.toContain('SILVA');
  });

  it('LGPD: as descrições vão mascaradas pra IA (CPF, CNPJ, e-mail, telefone, cartão, Pix com nome)', async () => {
    const { ai, add, uid, uc } = await setup();
    await add('PAGTO 123.456.789-09 ACADEMIA', -9000);
    await add('FORNECEDOR 12.345.678/0001-90', -9100);
    await add('TRANSF joao@gmail.com loja', -9200);
    await add('RECARGA (11) 98888-7777', -9300);
    await add('COMPRA CARTAO 4111 1111 1111 1111', -9400);
    await add('PIX ENVIADO MARIA SOUZA 123.456.789-09 AULA', -9500);
    ai.next = JSON.stringify({ t: {} });
    await uc.execute({ userId: uid });
    const prompt = ai.calls[0]![1]!.content as string;
    expect(prompt).not.toMatch(/123\.456|12\.345|joao@|gmail|98888|4111|MARIA|SOUZA/);
    expect(prompt).toMatch(/\[CPF\]/);
    expect(prompt).toMatch(/\[CNPJ\]/);
    expect(prompt).toMatch(/\[EMAIL\]/);
    expect(prompt).toMatch(/\[TEL\]/);
    expect(prompt).toMatch(/\[ID\]/);
  });

  it('Pix pra empresa (com contexto) ainda é enviado, com o nome da empresa', async () => {
    const { ai, add, uid, uc } = await setup();
    await add('PIX ENVIADO PADARIA PAO QUENTE LTDA', -1500);
    ai.next = JSON.stringify({ t: { '0': 'mercado' } });
    const r = await uc.execute({ userId: uid });
    expect(r.asked).toBe(1);
    expect(ai.calls[0]![1]!.content).toContain('PADARIA PAO QUENTE LTDA');
  });

  it('ignora categoria inventada, "Não conta" e sinal trocado', async () => {
    const { repos, ai, add, uid, uc } = await setup();
    const a = await add('LOJA X', -1000);
    ai.next = JSON.stringify({ t: { '0': 'salario' } }); // saída em categoria de entrada
    expect((await uc.execute({ userId: uid })).categorized).toBe(0);
    ai.next = JSON.stringify({ t: { '0': 'nao-conta' } });
    expect((await uc.execute({ userId: uid })).categorized).toBe(0);
    ai.next = JSON.stringify({ t: { '0': 'categoria-que-nao-existe' } });
    expect((await uc.execute({ userId: uid })).categorized).toBe(0);
    ai.next = 'isso não é json';
    expect((await uc.execute({ userId: uid })).categorized).toBe(0);
    expect((await repos.transactions.findById(a.id))!.categoryId).toBeNull();
  });

  it('mesma descrição recebe a mesma categoria, numa pergunta só', async () => {
    const { repos, ai, add, uid, uc } = await setup();
    const a = await add('MP*MELIMAIS 10/11', -1990);
    const b = await add('MP*MELIMAIS 10/10', -1990);
    ai.next = JSON.stringify({ t: { '0': 'assinaturas' } });
    expect(await uc.execute({ userId: uid })).toEqual({ categorized: 2, asked: 2 });
    expect(ai.calls[0]![1]!.content?.match(/MELIMAIS/g)).toHaveLength(1);
    expect((await repos.transactions.findById(a.id))!.categoryId).toBe('assinaturas');
    expect((await repos.transactions.findById(b.id))!.categoryId).toBe('assinaturas');
  });

  it('não mexe em transferência interna e não roda sem IA', async () => {
    const { ai, add, uid, uc } = await setup();
    await add('TRANSF ENTRE CONTAS', -5000, { isInternalTransfer: true });
    expect(await uc.execute({ userId: uid })).toEqual({ categorized: 0, asked: 0 });
    ai.next = JSON.stringify({ t: {} });
    expect(await uc.execute({ userId: uid })).toEqual({ categorized: 0, asked: 0 });
  });

  describe('consentimento LGPD', () => {
    it('sem aceite: nada sai pra IA. Botão (requireConsent) = 403; rotina de fundo = pula em silêncio', async () => {
      const { ai, add, uid, uc } = await setup({ consent: false });
      await add('IFOOD *RESTAURANTE', -4590);
      ai.next = JSON.stringify({ t: { '0': 'delivery' } });

      await expect(uc.execute({ userId: uid, source: 'user', requireConsent: true })).rejects.toMatchObject({
        statusCode: 403,
        code: 'AI_CONSENT_REQUIRED',
      });
      expect(await uc.execute({ userId: uid })).toEqual({ categorized: 0, asked: 0, skipped: 'consent' });
      expect(await uc.execute({ userId: uid, source: 'user' })).toMatchObject({ skipped: 'consent' });
      expect(ai.calls).toHaveLength(0);
    });
  });

  describe('cota diária (controle de custo da API de IA)', () => {
    it('botão: 3 execuções por dia; a 4ª responde 429 e não chama a IA', async () => {
      const { ai, add, uid, uc } = await setup();
      await add('IFOOD *RESTAURANTE', -4590);
      ai.next = JSON.stringify({ t: { '0': null } }); // a IA não sabe: continua pendente e dá pra rodar de novo
      for (let i = 0; i < 3; i++) await uc.execute({ userId: uid, source: 'user', requireConsent: true });
      expect(ai.calls).toHaveLength(3);
      await expect(uc.execute({ userId: uid, source: 'user', requireConsent: true })).rejects.toMatchObject({
        statusCode: 429,
      });
      expect(ai.calls).toHaveLength(3);
    });

    it('rotina de fundo tem cota própria e estoura em silêncio, sem tirar a do botão', async () => {
      const { ai, add, uid, uc } = await setup();
      await add('IFOOD *RESTAURANTE', -4590);
      ai.next = JSON.stringify({ t: { '0': null } });
      for (let i = 0; i < 6; i++) await uc.execute({ userId: uid });
      expect(await uc.execute({ userId: uid })).toEqual({ categorized: 0, asked: 0, skipped: 'quota' });
      expect(ai.calls).toHaveLength(6);
      await expect(uc.execute({ userId: uid, source: 'user', requireConsent: true })).resolves.toMatchObject({
        asked: 1,
      });
    });

    it('sem nada pra categorizar não gasta cota', async () => {
      const { kv, uid, uc, ai } = await setup();
      ai.next = JSON.stringify({ t: {} });
      for (let i = 0; i < 5; i++) await uc.execute({ userId: uid, source: 'user' });
      expect(await kv.get(`ai:autocat:user:${uid}`)).toBeNull();
    });

    it('a cota é por pessoa', async () => {
      const { repos, ai, add, uid, uc } = await setup();
      const other = await repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: 'x' });
      await repos.users.setAiConsent(other.id, new Date());
      await add('IFOOD *RESTAURANTE', -4590);
      await repos.transactions.create({
        userId: other.id,
        accountId: 'a2',
        externalId: null,
        description: 'UBER *TRIP',
        amountInCents: -2000,
        occurredAt: new Date('2026-11-10T12:00:00Z'),
        categoryId: null,
        isInternalTransfer: false,
      });
      ai.next = JSON.stringify({ t: { '0': null } });
      for (let i = 0; i < 3; i++) await uc.execute({ userId: uid, source: 'user' });
      await expect(uc.execute({ userId: uid, source: 'user' })).rejects.toMatchObject({ statusCode: 429 });
      await expect(uc.execute({ userId: other.id, source: 'user' })).resolves.toMatchObject({ asked: 1 });
    });
  });

  describe('erros da IA são logados (nada de catch silencioso)', () => {
    it('falha da API vira log estruturado sem vazar descrição, e a transação continua pendente', async () => {
      const { repos, ai, add, uid, log, uc } = await setup();
      const tx = await add('LOJA MISTERIOSA 123.456.789-09', -1000);
      ai.reply = async () => {
        throw Object.assign(new Error('DeepSeek respondeu 500'), { name: 'AiUnavailableError' });
      };
      ai.next = 'x'; // liga a IA
      const r = await uc.execute({ userId: uid });
      expect(r.categorized).toBe(0);
      expect(log).toHaveBeenCalledTimes(1);
      const [message, meta] = log.mock.calls[0]!;
      expect(message).toContain('falhou');
      expect(meta).toMatchObject({ userId: uid, error: 'AiUnavailableError' });
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/MISTERIOSA|123\.456/);
      expect((await repos.transactions.findById(tx.id))!.categoryId).toBeNull();
    });

    it('resposta que não é JSON também é logada', async () => {
      const { ai, add, uid, log, uc } = await setup();
      await add('LOJA X', -1000);
      ai.next = 'isso não é json';
      await uc.execute({ userId: uid });
      expect(log).toHaveBeenCalledTimes(1);
      expect(log.mock.calls[0]![1]).toMatchObject({ error: 'SyntaxError' });
    });
  });
});
