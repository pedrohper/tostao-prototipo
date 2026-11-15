import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { FakeAiGateway, AiUnavailableError } from '../gateways/ai-gateway.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';
import { ConnectBankUseCase } from './connect-bank.js';
import { AskTostaoUseCase } from './ask-tostao.js';

const NOW = new Date(Date.UTC(2026, 10, 20, 18));

async function setup() {
  const repos = makeInMemoryRepositories();
  const user = await repos.users.create({ name: 'Pedro', email: 'p@x.com', passwordHash: 'x' });
  const bank = new FakeBankGateway(() => NOW);
  const sync = new SyncBankConnectionUseCase({ ...repos, bank, now: () => NOW });
  await new ConnectBankUseCase(repos.connections, bank, sync).execute({ userId: user.id, itemId: 'item-123456' });
  return { repos, userId: user.id };
}

describe('chat com o Tostão', () => {
  it('manda os números do app pra IA e guarda a conversa', async () => {
    const { repos, userId } = await setup();
    const ai = new FakeAiGateway();
    const r = await new AskTostaoUseCase(repos, ai, 40, () => NOW).execute({ userId, message: ' Cadê meu dinheiro? ' });

    const system = ai.calls[0]![0]!.content;
    expect(system).toContain('Pedro');
    expect(system).toContain('saiu R$');
    expect(system).toContain('IFD*'); // últimas transações vão junto
    expect(ai.calls[0]!.at(-1)).toEqual({ role: 'user', content: 'Cadê meu dinheiro?' });
    expect(repos.chat.items.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(r.remainingToday).toBe(39);

    // a próxima pergunta leva a conversa anterior junto
    await new AskTostaoUseCase(repos, ai, 40, () => NOW).execute({ userId, message: 'E agora?' });
    expect(ai.calls[1]!.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
  });

  it('tem limite por dia e não grava nada quando a IA cai', async () => {
    const { repos, userId } = await setup();
    const ask = new AskTostaoUseCase(repos, new FakeAiGateway(), 1); // relógio real: o repositório em memória carimba a hora real
    await ask.execute({ userId, message: 'oi' });
    await expect(ask.execute({ userId, message: 'oi de novo' })).rejects.toThrow('Por hoje deu');

    const broken = Object.assign(new FakeAiGateway(), { reply: async () => { throw new AiUnavailableError('x'); } });
    const before = repos.chat.items.length;
    await expect(new AskTostaoUseCase(repos, broken, 40, () => NOW).execute({ userId, message: 'oi' })).rejects.toThrow('travou');
    expect(repos.chat.items.length).toBe(before);
  });

  it('executa loop de tool_calls para consultar gastos e limite de categoria', async () => {
    const { repos, userId } = await setup();
    await repos.budgets.upsert({ userId, categoryId: 'jogos', limitInCents: 300_00 });
    await repos.transactions.create({
      userId,
      accountId: null,
      externalId: null,
      description: 'Steam',
      amountInCents: -85_00,
      occurredAt: NOW,
      categoryId: 'jogos',
      isInternalTransfer: false,
      seriesId: null,
    });

    const ai = new FakeAiGateway();
    ai.queue.push(
      {
        content: null,
        toolCalls: [
          { id: 'call_1', type: 'function', function: { name: 'consultar_gastos_categoria', arguments: '{"categoria":"Jogos"}' } },
          { id: 'call_2', type: 'function', function: { name: 'verificar_limite_categoria', arguments: '{"categoria":"Jogos"}' } },
        ],
      },
      { content: 'Você gastou R$ 85,00 em Jogos e ainda tem R$ 215,00 de limite.', toolCalls: [] },
    );

    const r = await new AskTostaoUseCase(repos, ai, 40, () => NOW).execute({ userId, message: 'Posso comprar um jogo hoje?' });
    expect(r.reply.content).toContain('R$ 85,00');
    expect(ai.calls).toHaveLength(2);
    const secondCallRoles = ai.calls[1]!.map((m) => m.role);
    expect(secondCallRoles.slice(-3)).toEqual(['assistant', 'tool', 'tool']);
    const tool1 = JSON.parse((ai.calls[1]!.at(-2) as { content: string }).content);
    const tool2 = JSON.parse((ai.calls[1]!.at(-1) as { content: string }).content);
    expect(tool1.total_centavos).toBe(85_00);
    expect(tool2.percentual_usado).toBe(28);
  });

  it('registra transação via tool_call e força resposta se passar do limite de rodadas', async () => {
    const { repos, userId } = await setup();
    const ai = new FakeAiGateway();
    ai.queue.push(
      {
        content: null,
        toolCalls: [
          { id: 'call_reg', type: 'function', function: { name: 'registrar_transacao', arguments: '{"descricao":"Pizza","valor_reais":64.5,"tipo":"saida"}' } },
        ],
      },
      { content: 'Anotado! Pizza de R$ 64,50 lançada.', toolCalls: [] },
    );

    const beforeTxs = (await repos.transactions.findManyInRange(userId, new Date(0), new Date(NOW.getTime() + 86_400_000))).length;
    const r = await new AskTostaoUseCase(repos, ai, 40, () => NOW).execute({ userId, message: 'Anota 64,50 de pizza' });
    expect(r.reply.content).toContain('Anotado');
    const afterTxs = await repos.transactions.findManyInRange(userId, new Date(0), new Date(NOW.getTime() + 86_400_000));
    expect(afterTxs).toHaveLength(beforeTxs + 1);
    expect(afterTxs.find((t) => t.description === 'Pizza')?.amountInCents).toBe(-64_50);

    // Proteção contra loop infinito: 5 rodadas de toolCalls + 1 chamada final sem tools
    const loopy = new FakeAiGateway();
    for (let i = 0; i < 5; i++) {
      loopy.queue.push({
        content: null,
        toolCalls: [{ id: `c_${i}`, type: 'function', function: { name: 'consultar_gastos_categoria', arguments: '{"categoria":"Inexistente"}' } }],
      });
    }
    loopy.queue.push({ content: 'Não achei essa categoria, mas tô aqui.', toolCalls: [] });
    const r2 = await new AskTostaoUseCase(repos, loopy, 40, () => NOW).execute({ userId, message: 'teste loop' });
    expect(r2.reply.content).toContain('Não achei');
    expect(loopy.calls).toHaveLength(6);
  });
});
