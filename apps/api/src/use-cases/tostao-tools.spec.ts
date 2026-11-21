// T1.5/T1.6 · ferramentas do chat: "hoje" e "este mês" são os da PESSOA (fuso), e dado do outro usuário não vaza.
import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { executeTostaoTool, validateRegisterArgs } from './tostao-tools.js';

const ALL = new Set([
  'consultar_gastos_categoria',
  'verificar_limite_categoria',
  'consultar_meta',
  'registrar_transacao',
]);
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

describe('consultar_meta (T4.5, só leitura)', () => {
  const now = new Date('2026-11-20T18:00:00Z');

  it('sem plano ou sem meta: diz que não tem, sem inventar número', async () => {
    const repos = makeInMemoryRepositories();
    const u = await repos.users.create({ name: 'A', email: 'a@x.com', passwordHash: 'x' });
    const out = JSON.parse(await executeTostaoTool(repos, u.id, 'consultar_meta', '{}', now, ALL));
    expect(out).toMatchObject({ tem_meta: false });
    expect(out.guardado).toBeUndefined();
  });

  it('com meta: devolve guardado, falta e quanto guardar por mês (texto e centavos)', async () => {
    const repos = makeInMemoryRepositories();
    const u = await repos.users.create({ name: 'A', email: 'a@x.com', passwordHash: 'x' });
    await repos.plans.save(u.id, {
      salary: null,
      otherIncomes: [],
      benefits: [],
      fixedExpenses: [],
      goal: { kind: 'viagem', label: 'Praia', amountInCents: 300_000, deadline: '2027-07', savedInCents: 60_000 },
    });
    const out = JSON.parse(await executeTostaoTool(repos, u.id, 'consultar_meta', '{}', now, ALL));
    expect(out).toMatchObject({
      tem_meta: true,
      meta: 'Praia',
      valor_meta_centavos: 300_000,
      guardado_centavos: 60_000,
      prazo: '2027-07',
      atingida: false,
    });
    expect(out.precisa_guardar_por_mes_centavos).toBeGreaterThan(0);
  });

  it('é de quem pergunta: a meta de outra pessoa não aparece', async () => {
    const repos = makeInMemoryRepositories();
    const a = await repos.users.create({ name: 'A', email: 'a@x.com', passwordHash: 'x' });
    const b = await repos.users.create({ name: 'B', email: 'b@x.com', passwordHash: 'x' });
    await repos.plans.save(a.id, {
      salary: null,
      otherIncomes: [],
      benefits: [],
      fixedExpenses: [],
      goal: { kind: 'viagem', label: 'Segredo da A', amountInCents: 100_000, deadline: null, savedInCents: 0 },
    });
    const out = await executeTostaoTool(repos, b.id, 'consultar_meta', '{}', now, ALL);
    expect(out).not.toContain('Segredo da A');
  });
});
