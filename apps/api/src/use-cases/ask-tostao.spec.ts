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
});
