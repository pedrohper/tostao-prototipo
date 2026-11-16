import type { ToolDefinition } from '../gateways/ai-gateway.js';
import type { Repositories } from '../repositories/types.js';
import type { Category } from '../domain/entities.js';
import { currentMonth, monthRange } from '../lib/month.js';
import { GetBudgetsUseCase } from './budgets.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Definições das ferramentas financeiras expostas pra DeepSeek no formato OpenAI function calling. */
export const TOSTAO_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'consultar_gastos_categoria',
      description:
        'Consulta quanto a pessoa gastou em uma categoria específica em um mês (padrão: mês atual) e lista os principais lançamentos.',
      parameters: {
        type: 'object',
        properties: {
          categoria: {
            type: 'string',
            description: 'Nome da categoria (ex: Delivery, Alimentação, Transporte, Lazer).',
          },
          mes: { type: 'string', description: 'Mês no formato YYYY-MM. Se omitido, usa o mês atual.' },
        },
        required: ['categoria'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'verificar_limite_categoria',
      description:
        'Verifica o limite (teto) mensal definido para uma categoria, quanto já foi gasto e quanto ainda resta disponível.',
      parameters: {
        type: 'object',
        properties: {
          categoria: { type: 'string', description: 'Nome da categoria de gasto.' },
          mes: { type: 'string', description: 'Mês no formato YYYY-MM. Se omitido, usa o mês atual.' },
        },
        required: ['categoria'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_transacao',
      description:
        'Registra um gasto (saída) ou ganho (entrada) manual no banco de dados quando a pessoa pedir para anotar ou lançar uma transação financeira.',
      parameters: {
        type: 'object',
        properties: {
          descricao: {
            type: 'string',
            description: 'Descrição curta do gasto ou entrada (ex: Pizza, Uber, Freelance).',
          },
          valor_reais: { type: 'number', description: 'Valor positivo em reais (ex: 45.90).' },
          tipo: {
            type: 'string',
            enum: ['saida', 'entrada'],
            description: 'Use "saida" para gasto ou "entrada" para dinheiro que entrou.',
          },
          categoria: {
            type: 'string',
            description: 'Nome opcional da categoria. Se omitido, tenta categorizar pelas regras.',
          },
          data: { type: 'string', description: 'Data opcional no formato YYYY-MM-DD. Padrão: hoje.' },
        },
        required: ['descricao', 'valor_reais', 'tipo'],
      },
    },
  },
];

function findCategory(categories: Category[], name: string): Category | undefined {
  const target = normalize(name);
  return (
    categories.find((c) => normalize(c.name) === target) ??
    categories.find((c) => normalize(c.name).includes(target) || target.includes(normalize(c.name)))
  );
}

function resolveMonth(raw: unknown, now: Date): string | null {
  if (raw === undefined || raw === null || raw === '') return currentMonth(now);
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}$/.test(raw)) return null;
  return raw;
}

/**
 * Executa uma chamada de ferramenta solicitada pelo modelo, sempre escopada no userId.
 * `allowedTools` é obrigatório: o modelo pode pedir uma ferramenta que não recebeu
 * (alucinação ou prompt injection), então quem chama diz o que essa pessoa pode usar.
 */
export async function executeTostaoTool(
  repos: Repositories,
  userId: string,
  name: string,
  rawArgs: string,
  now: Date,
  allowedTools: ReadonlySet<string>,
): Promise<string> {
  if (!allowedTools.has(name)) return JSON.stringify({ erro: `Ferramenta não disponível: ${name}` });
  let args: Record<string, unknown>;
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return JSON.stringify({ erro: 'Argumentos inválidos (JSON malformado).' });
  }

  if (name === 'consultar_gastos_categoria') {
    const catQuery = typeof args.categoria === 'string' ? args.categoria.trim() : '';
    if (!catQuery) return JSON.stringify({ erro: 'Informe o nome da categoria.' });
    const month = resolveMonth(args.mes, now);
    if (!month) return JSON.stringify({ erro: 'Mês inválido. Use o formato YYYY-MM.' });

    const categories = await repos.categories.list(userId);
    const cat = findCategory(categories, catQuery);
    if (!cat) {
      return JSON.stringify({
        erro: `Categoria "${catQuery}" não encontrada.`,
        categorias_disponiveis: categories.filter((c) => c.kind === 'saida').map((c) => c.name),
      });
    }

    const { from, to } = monthRange(month);
    const [txs, accounts] = await Promise.all([
      repos.transactions.findManyInRange(userId, from, to),
      repos.accounts.listByUser(userId),
    ]);
    const hidden = new Set(accounts.filter((a) => a.hidden).map((a) => a.id));
    const matching = txs
      .filter(
        (t) =>
          !t.isInternalTransfer &&
          t.amountInCents < 0 &&
          t.categoryId === cat.id &&
          !(t.accountId && hidden.has(t.accountId)),
      )
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const totalCents = matching.reduce((sum, t) => sum - t.amountInCents, 0);
    return JSON.stringify({
      categoria: cat.name,
      mes: month,
      total_gasto: brl(totalCents),
      total_centavos: totalCents,
      quantidade_lancamentos: matching.length,
      ultimos_lancamentos: matching.slice(0, 8).map((t) => ({
        data: t.occurredAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        descricao: t.description,
        valor: brl(-t.amountInCents),
      })),
    });
  }

  if (name === 'verificar_limite_categoria') {
    const catQuery = typeof args.categoria === 'string' ? args.categoria.trim() : '';
    if (!catQuery) return JSON.stringify({ erro: 'Informe o nome da categoria.' });
    const month = resolveMonth(args.mes, now);
    if (!month) return JSON.stringify({ erro: 'Mês inválido. Use o formato YYYY-MM.' });

    const [{ budgets }, categories] = await Promise.all([
      new GetBudgetsUseCase(repos).execute({ userId, month }),
      repos.categories.list(userId),
    ]);
    const cat = findCategory(categories, catQuery);
    if (!cat) {
      return JSON.stringify({
        erro: `Categoria "${catQuery}" não encontrada.`,
        categorias_disponiveis: categories.filter((c) => c.kind === 'saida').map((c) => c.name),
      });
    }

    const budget = budgets.find((b) => b.categoryId === cat.id);
    if (!budget) {
      return JSON.stringify({
        categoria: cat.name,
        mes: month,
        tem_limite: false,
        mensagem: `Não há limite mensal definido para ${cat.name}.`,
      });
    }

    const remainingCents = budget.limitInCents - budget.spentInCents;
    const pct = Math.round((budget.spentInCents / budget.limitInCents) * 100);
    return JSON.stringify({
      categoria: cat.name,
      mes: month,
      tem_limite: true,
      limite: brl(budget.limitInCents),
      gasto_atual: brl(budget.spentInCents),
      restante: brl(Math.max(0, remainingCents)),
      excedido_em: remainingCents < 0 ? brl(-remainingCents) : null,
      percentual_usado: pct,
    });
  }

  if (name === 'registrar_transacao') {
    const description = typeof args.descricao === 'string' ? args.descricao.trim() : '';
    const valorReais = typeof args.valor_reais === 'number' ? args.valor_reais : Number(args.valor_reais);
    const kind = args.tipo === 'entrada' ? 'entrada' : args.tipo === 'saida' ? 'saida' : null;
    if (!description) return JSON.stringify({ erro: 'Informe a descrição da transação.' });
    if (!Number.isFinite(valorReais) || valorReais <= 0) return JSON.stringify({ erro: 'Valor deve ser positivo.' });
    if (!kind) return JSON.stringify({ erro: 'Tipo deve ser "saida" ou "entrada".' });

    const amountInCents = Math.round(valorReais * 100);
    let occurredAt = now;
    if (typeof args.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.data)) {
      occurredAt = new Date(`${args.data}T12:00:00-03:00`);
    }

    let categoryId: string | null = null;
    let matchedCategoryName: string | null = null;
    if (typeof args.categoria === 'string' && args.categoria.trim()) {
      const categories = await repos.categories.list(userId);
      const cat = findCategory(categories, args.categoria);
      if (cat) {
        categoryId = cat.id;
        matchedCategoryName = cat.name;
      }
    }

    const { transaction } = await new CreateManualTransactionUseCase(repos).execute({
      userId,
      description,
      amountInCents,
      kind,
      occurredAt,
      categoryId,
    });

    if (!matchedCategoryName && transaction.categoryId) {
      const cat = await repos.categories.findById(transaction.categoryId);
      matchedCategoryName = cat?.name ?? null;
    }

    return JSON.stringify({
      ok: true,
      id: transaction.id,
      descricao: transaction.description,
      valor: brl(Math.abs(transaction.amountInCents)),
      tipo: kind,
      categoria: matchedCategoryName ?? 'sem categoria',
      data: transaction.occurredAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    });
  }

  return JSON.stringify({ erro: `Ferramenta desconhecida: ${name}` });
}
