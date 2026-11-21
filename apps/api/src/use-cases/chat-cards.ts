// Cartões e sugestões que acompanham uma resposta do Tostão. Tudo sai do RESULTADO das ferramentas (números que o
// app calculou), nunca do texto que a IA escreveu: o modelo não consegue inventar um cartão nem um link.
import type { ChatCardDTO } from '@tostao/contracts';

export type ToolOutput = { name: string; result: string };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_CARDS = 3;
const MAX_FOLLOW_UPS = 3;

function parse(raw: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

export function buildChatCards(outputs: readonly ToolOutput[]): ChatCardDTO[] {
  const cards = new Map<string, ChatCardDTO>(); // a última consulta da mesma coisa vence (ex.: mesma categoria 2x)
  for (const { name, result } of outputs) {
    const r = parse(result);
    if (!r || r.erro !== undefined) continue;

    if (name === 'consultar_gastos_categoria') {
      const categoryId = str(r.categoria_id);
      const categoryName = str(r.categoria);
      const month = str(r.mes);
      const total = num(r.total_centavos);
      const count = num(r.quantidade_lancamentos);
      if (!categoryId || !categoryName || !month || !MONTH.test(month) || total === null || count === null) continue;
      cards.set(`categoria:${categoryId}:${month}`, {
        kind: 'categoria',
        categoryId,
        categoryName,
        month,
        totalInCents: total,
        count,
        href: `/carteira?mes=${month}&cat=${encodeURIComponent(categoryId)}#lista`,
      });
    } else if (name === 'verificar_limite_categoria' && r.tem_limite === true) {
      const categoryId = str(r.categoria_id);
      const categoryName = str(r.categoria);
      const month = str(r.mes);
      const limit = num(r.limite_centavos);
      const spent = num(r.gasto_centavos);
      const pct = num(r.percentual_usado);
      if (!categoryId || !categoryName || !month || !MONTH.test(month) || !limit || spent === null || pct === null)
        continue;
      cards.set(`limite:${categoryId}:${month}`, {
        kind: 'limite',
        categoryId,
        categoryName,
        month,
        limitInCents: limit,
        spentInCents: spent,
        percentUsed: pct,
        href: '/limites',
      });
    } else if (name === 'consultar_meta' && r.tem_meta === true) {
      const label = str(r.meta);
      const saved = num(r.guardado_centavos);
      if (!label || saved === null) continue;
      cards.set('meta', {
        kind: 'meta',
        label,
        amountInCents: num(r.valor_meta_centavos),
        savedInCents: saved,
        deadline: str(r.prazo),
        monthlyNeededInCents: num(r.precisa_guardar_por_mes_centavos),
        fits: typeof r.cabe_no_que_sobra === 'boolean' ? r.cabe_no_que_sobra : null,
        reached: r.atingida === true,
        href: '/meta',
      });
    }
  }
  return [...cards.values()].slice(0, MAX_CARDS);
}

const DEFAULTS = ['Onde mais estou gastando?', 'Como está minha meta?', 'Quais assinaturas posso cortar?'];

/**
 * 2 a 3 próximas perguntas que combinam com o que acabou de acontecer. Sem IA: regras sobre os cartões, então é
 * grátis, instantâneo e não manda nada novo pro provedor. Nunca repete a pergunta que a pessoa acabou de fazer.
 */
export function buildFollowUps({
  cards,
  proposed,
  asked,
}: {
  cards: readonly ChatCardDTO[];
  proposed: boolean;
  asked: string;
}): string[] {
  const out: string[] = [];
  const add = (q: string) => {
    if (!out.includes(q)) out.push(q);
  };
  if (proposed) {
    add('Quanto já gastei hoje?');
    add('Anotar outro gasto');
  }
  for (const c of cards) {
    if (c.kind === 'categoria') {
      add(`Qual o limite de ${c.categoryName}?`);
      add(`E no mês passado em ${c.categoryName}?`);
    } else if (c.kind === 'limite') {
      add(`Quanto gastei em ${c.categoryName}?`);
      add('Como está minha meta?');
    } else {
      add('Dá pra guardar mais esse mês?');
      add('Onde posso economizar?');
    }
  }
  for (const d of DEFAULTS) add(d);
  const norm = (s: string) => s.trim().toLowerCase();
  return out.filter((q) => norm(q) !== norm(asked)).slice(0, MAX_FOLLOW_UPS);
}
