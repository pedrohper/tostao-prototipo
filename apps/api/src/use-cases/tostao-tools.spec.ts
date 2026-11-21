// T1.5/T1.6 · ferramentas do chat: "hoje" e "este mês" são os da PESSOA (fuso), e dado do outro usuário não vaza.
import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { executeTostaoTool, validateRegisterArgs } from './tostao-tools.js';

const ALL = new Set(['consultar_gastos_categoria', 'verificar_limite_categoria', 'registrar_transacao']);
const categories = makeInMemoryRepositories().categories.items;

describe('data e mês no fuso da pessoa', () => {
  // 2026-11-30T20:00Z = 30/11 17h em Brasília e já 01/12 05h em Tóquio
  const now = new Date('2026-11-30T20:00:00Z');
  const args = {
    valor_reais: 25,
    descricao: 'Cafe',
    tipo: 'saida',
    categoria: categories.find((c) => c.kind === 'saida')!.name,
  };

  it('registrar_transacao sem data usa o "hoje" da pessoa', () => {
    const br = validateRegisterArgs(args, categories, now, 'America/Sao_Paulo');
    const jp = validateRegisterArgs(args, categories, now, 'Asia/Tokyo');
    expect(br.ok && br.proposal.date).toBe('2026-11-30');
    expect(jp.ok && jp.proposal.date).toBe('2026-12-01');
  });

  it('data real fora do intervalo ou inexistente é recusada; "hoje" também é do fuso', () => {
    expect(validateRegisterArgs({ ...args, data: '2026-02-30' }, categories, now, 'America/Sao_Paulo')).toMatchObject({
      ok: false,
    });
    expect(validateRegisterArgs({ ...args, data: '2020-01-01' }, categories, now, 'America/Sao_Paulo')).toMatchObject({
      ok: false,
    });
    expect(validateRegisterArgs({ ...args, data: '2026-12-01' }, categories, now, 'Asia/Tokyo')).toMatchObject({
      ok: true,
    });
  });

  it('a consulta de gastos sem "mes" olha o mês CIVIL da pessoa (Tóquio já está em dezembro)', async () => {
    const repos = makeInMemoryRepositories();
    const user = await repos.users.create({ name: 'Yuki', email: 'y@x.com', passwordHash: null });
    (await repos.users.findById(user.id))!.timezone = 'Asia/Tokyo';
    const cat = categories.find((c) => c.id === 'mercado')!;
    await repos.transactions.create({
      userId: user.id,
      accountId: null,
      externalId: null,
      description: 'MERCADO',
      amountInCents: -40_00,
      occurredAt: now,
      categoryId: cat.id,
      isInternalTransfer: false,
      seriesId: null,
    });
    const out = JSON.parse(
      await executeTostaoTool(
        repos,
        user.id,
        'consultar_gastos_categoria',
        JSON.stringify({ categoria: cat.name }),
        now,
        ALL,
      ),
    );
    expect(JSON.stringify(out)).toContain('2026-12');
  });

  it('mês inválido (13) continua recusado', async () => {
    const repos = makeInMemoryRepositories();
    const out = JSON.parse(
      await executeTostaoTool(
        repos,
        'u1',
        'consultar_gastos_categoria',
        JSON.stringify({ categoria: 'Mercado', mes: '2026-13' }),
        new Date(),
        ALL,
      ),
    );
    expect(out.erro).toMatch(/Mês inválido/);
  });

  it('ferramenta não liberada é recusada', async () => {
    const out = JSON.parse(
      await executeTostaoTool(makeInMemoryRepositories(), 'u1', 'registrar_transacao', '{}', new Date(), new Set()),
    );
    expect(out.erro).toMatch(/não disponível/);
  });
});
