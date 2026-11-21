import { describe, expect, it } from 'vitest';
import { buildChatCards, buildFollowUps } from './chat-cards.js';

const out = (name: string, result: unknown) => ({ name, result: JSON.stringify(result) });

const gastos = (over: Record<string, unknown> = {}) =>
  out('consultar_gastos_categoria', {
    categoria: 'Delivery',
    categoria_id: 'delivery',
    mes: '2026-11',
    total_centavos: 31_240,
    quantidade_lancamentos: 7,
    ...over,
  });

describe('buildChatCards: o cartão vem do resultado das ferramentas, nunca do texto da IA', () => {
  it('categoria: total, quantidade e link direto pra Carteira já filtrada', () => {
    expect(buildChatCards([gastos()])).toEqual([
      {
        kind: 'categoria',
        categoryId: 'delivery',
        categoryName: 'Delivery',
        month: '2026-11',
        totalInCents: 31_240,
        count: 7,
        href: '/carteira?mes=2026-11&cat=delivery#lista',
      },
    ]);
  });

  it('limite: só vira cartão quando existe limite (sem limite não tem o que mostrar)', () => {
    const com = out('verificar_limite_categoria', {
      categoria: 'Lazer',
      categoria_id: 'lazer',
      mes: '2026-11',
      tem_limite: true,
      limite_centavos: 20_000,
      gasto_centavos: 25_000,
      percentual_usado: 125,
    });
    const sem = out('verificar_limite_categoria', { categoria: 'Lazer', tem_limite: false });
    expect(buildChatCards([sem])).toEqual([]);
    expect(buildChatCards([com])).toEqual([
      {
        kind: 'limite',
        categoryId: 'lazer',
        categoryName: 'Lazer',
        month: '2026-11',
        limitInCents: 20_000,
        spentInCents: 25_000,
        percentUsed: 125,
        href: '/limites',
      },
    ]);
  });

  it('meta: valores do plano, com link pra /meta; sem meta não tem cartão', () => {
    const meta = out('consultar_meta', {
      tem_meta: true,
      meta: 'Praia',
      valor_meta_centavos: 300_000,
      guardado_centavos: 60_000,
      prazo: '2027-07',
      precisa_guardar_por_mes_centavos: 30_000,
      cabe_no_que_sobra: false,
      atingida: false,
    });
    expect(buildChatCards([out('consultar_meta', { tem_meta: false })])).toEqual([]);
    expect(buildChatCards([meta])).toEqual([
      {
        kind: 'meta',
        label: 'Praia',
        amountInCents: 300_000,
        savedInCents: 60_000,
        deadline: '2027-07',
        monthlyNeededInCents: 30_000,
        fits: false,
        reached: false,
        href: '/meta',
      },
    ]);
  });

  it('ferramenta com erro, JSON quebrado, campo faltando ou mês inválido: nenhum cartão (nunca um cartão torto)', () => {
    expect(
      buildChatCards([
        out('consultar_gastos_categoria', { erro: 'Categoria não encontrada.' }),
        { name: 'consultar_gastos_categoria', result: '{quebrado' },
        gastos({ total_centavos: undefined }),
        gastos({ mes: '2026-13' }),
        gastos({ categoria_id: '' }),
        out('registrar_transacao', { pendente_confirmacao: true }), // a proposta tem o card próprio, não esse
        out('ferramenta_inventada', { qualquer: 'coisa' }),
      ]),
    ).toEqual([]);
  });

  it('o id da categoria é escapado no link (nada de injetar query na URL)', () => {
    const [card] = buildChatCards([gastos({ categoria_id: 'a&b=c d' })]);
    expect(card).toMatchObject({ href: '/carteira?mes=2026-11&cat=a%26b%3Dc%20d#lista' });
  });

  it('consulta repetida da mesma coisa vira um cartão só (vale a última) e o teto é 3', () => {
    expect(buildChatCards([gastos(), gastos({ total_centavos: 99_900 })])).toMatchObject([
      { kind: 'categoria', totalInCents: 99_900 },
    ]);
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => gastos({ categoria_id: id, categoria: id.toUpperCase() }));
    expect(buildChatCards(many)).toHaveLength(3);
  });
});

describe('buildFollowUps: 2 a 3 sugestões do contexto, sem IA', () => {
  const none = { cards: [], proposed: false };

  it('sem contexto: as três perguntas padrão', () => {
    expect(buildFollowUps({ ...none, asked: 'oi' })).toEqual([
      'Onde mais estou gastando?',
      'Como está minha meta?',
      'Quais assinaturas posso cortar?',
    ]);
  });

  it('depois de consultar uma categoria: pergunta o limite e o mês passado dela', () => {
    const cards = buildChatCards([gastos()]);
    const f = buildFollowUps({ cards, proposed: false, asked: 'x' });
    expect(f).toEqual(['Qual o limite de Delivery?', 'E no mês passado em Delivery?', 'Onde mais estou gastando?']);
  });

  it('depois de uma proposta de lançamento: oferece anotar outro', () => {
    const f = buildFollowUps({ ...none, proposed: true, asked: 'x' });
    expect(f.slice(0, 2)).toEqual(['Quanto já gastei hoje?', 'Anotar outro gasto']);
  });

  it('nunca repete a pergunta que a pessoa acabou de fazer (sem ligar pra caixa/espaço) e respeita o teto de 3', () => {
    const f = buildFollowUps({ ...none, asked: '  como ESTÁ minha meta?  ' });
    expect(f).not.toContain('Como está minha meta?');
    expect(f.length).toBeGreaterThanOrEqual(2);
    expect(f.length).toBeLessThanOrEqual(3);
    const cards = buildChatCards([gastos(), gastos({ categoria_id: 'mercado', categoria: 'Mercado' })]);
    expect(buildFollowUps({ cards, proposed: true, asked: 'x' })).toHaveLength(3);
  });
});
