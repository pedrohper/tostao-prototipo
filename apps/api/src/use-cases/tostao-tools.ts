import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ToolDefinition } from '../gateways/ai-gateway.js';
import type { Repositories } from '../repositories/types.js';
import type { Category } from '../domain/entities.js';
import { currentMonth, monthRange } from '../lib/month.js';
import { GetBudgetsUseCase } from './budgets.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const VAULT_ROOT = process.env.OBSIDIAN_VAULT_PATH || '/home/optiplex/obsidian_vault';
const HUB_URL = process.env.HOMELAB_HUB_URL || 'http://127.0.0.1:8088';

/** Definições das ferramentas financeiras expostas pra DeepSeek no formato OpenAI function calling. */
export const TOSTAO_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'consultar_gastos_categoria',
      description: 'Consulta quanto a pessoa gastou em uma categoria específica em um mês (padrão: mês atual) e lista os principais lançamentos.',
      parameters: {
        type: 'object',
        properties: {
          categoria: { type: 'string', description: 'Nome da categoria (ex: Delivery, Alimentação, Transporte, Lazer).' },
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
      description: 'Verifica o limite (teto) mensal definido para uma categoria, quanto já foi gasto e quanto ainda resta disponível.',
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
      description: 'Registra um gasto (saída) ou ganho (entrada) manual no banco de dados quando a pessoa pedir para anotar ou lançar uma transação financeira.',
      parameters: {
        type: 'object',
        properties: {
          descricao: { type: 'string', description: 'Descrição curta do gasto ou entrada (ex: Pizza, Uber, Freelance).' },
          valor_reais: { type: 'number', description: 'Valor positivo em reais (ex: 45.90).' },
          tipo: { type: 'string', enum: ['saida', 'entrada'], description: 'Use "saida" para gasto ou "entrada" para dinheiro que entrou.' },
          categoria: { type: 'string', description: 'Nome opcional da categoria. Se omitido, tenta categorizar pelas regras.' },
          data: { type: 'string', description: 'Data opcional no formato YYYY-MM-DD. Padrão: hoje.' },
        },
        required: ['descricao', 'valor_reais', 'tipo'],
      },
    },
  },
];

/** Ferramentas Jarvis exclusivas da conta do Pedro (Segundo Cérebro Obsidian + Anki Studio). */
export const JARVIS_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'salvar_nota_obsidian',
      description: 'Salva uma nota, lembrete, tarefa, backlog de desenvolvimento, ideia de startup ou resumo de estudo diretamente no cofre Obsidian do Pedro. Use sempre que ele pedir para anotar, lembrar ou guardar qualquer informação que não seja um lançamento financeiro.',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título claro e curto da nota ou tarefa.' },
          conteudo: { type: 'string', description: 'Conteúdo completo em Markdown (pode conter listas com -, checkboxes - [ ], tópicos, etc.). Se ele pedir para complementar algo dito antes na conversa, inclua todos os itens acumulados.' },
          categoria: {
            type: 'string',
            enum: ['tarefa', 'projeto_tostao', 'ideia_startup', 'estudo_esamc', 'geral'],
            description: 'Destino no Obsidian: "tarefa" (Rotina), "projeto_tostao" (Projetos/Tostao), "ideia_startup" (Ideias), "estudo_esamc" (Estudos-ESAMC) ou "geral" (Inbox).',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Lista de tags curtas sem # (ex: ["tostao", "backlog", "meta"]).',
          },
        },
        required: ['titulo', 'conteudo', 'categoria'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_notas_obsidian',
      description: 'Pesquisa nas notas, projetos, estudos e tarefas pendentes do cofre Obsidian (Segundo Cérebro) do Pedro.',
      parameters: {
        type: 'object',
        properties: {
          termo_busca: { type: 'string', description: 'Palavras-chave para buscar no cofre Obsidian (ex: "cargill", "backlog tostao", "rotina", "esamc").' },
        },
        required: ['termo_busca'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'criar_flashcards_anki',
      description: 'Gera e salva flashcards de estudo no Anki Studio do Pedro e cria uma nota correspondente na pasta Estudos-ESAMC do Obsidian.',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Assunto ou matéria dos flashcards.' },
          resumo: { type: 'string', description: 'Resumo curto do conteúdo estudado.' },
          cards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                front: { type: 'string', description: 'Frente do card (pergunta).' },
                back: { type: 'string', description: 'Verso do card (resposta).' },
              },
              required: ['front', 'back'],
            },
            description: 'Lista de flashcards (frente e verso).',
          },
        },
        required: ['titulo', 'cards'],
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

/** Executa uma chamada de ferramenta solicitada pelo modelo, sempre escopada no userId. */
export async function executeTostaoTool(
  repos: Repositories,
  userId: string,
  name: string,
  rawArgs: string,
  now: Date,
): Promise<string> {
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

  if (name === 'salvar_nota_obsidian') {
    const titulo = typeof args.titulo === 'string' ? args.titulo.trim() : 'Nota rápida';
    const conteudo = typeof args.conteudo === 'string' ? args.conteudo.trim() : '';
    const cat = typeof args.categoria === 'string' ? args.categoria : 'geral';
    const rawTags = Array.isArray(args.tags) ? args.tags.map(String) : [];
    if (!conteudo) return JSON.stringify({ erro: 'Informe o conteúdo da nota.' });

    const spNow = new Date(now.getTime() - 3 * 3600 * 1000);
    const isoDate = spNow.toISOString().slice(0, 10);
    const timeStr = spNow.toISOString().slice(11, 16).replace(':', '-');
    const slug =
      normalize(titulo)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 45) || 'nota';

    const cleanTag = (t: string) => normalize(t).replace(/[^a-z0-9_-]/g, '');
    let relDir = 'Inbox';
    let baseTags = ['inbox'];

    if (cat === 'tarefa') {
      relDir = 'Pessoal-Notion/Rotina';
      baseTags = ['tarefa'];
    } else if (cat === 'projeto_tostao') {
      relDir = 'Projetos/Tostao';
      baseTags = ['tostao', 'backlog'];
    } else if (cat === 'ideia_startup') {
      relDir = 'Pessoal-Notion/Ideias';
      baseTags = ['ideia', 'startup'];
    } else if (cat === 'estudo_esamc') {
      relDir = 'Pessoal-Notion/Estudos-ESAMC';
      baseTags = ['esamc', 'estudo'];
    }

    const allTags = [...new Set([...baseTags, ...rawTags.map(cleanTag).filter(Boolean)])];
    const yamlTags = allTags.map((t) => `  - ${t}`).join('\n');
    const fileName = cat === 'tarefa' ? `Tarefa_${isoDate}_${timeStr}_${slug}.md` : `${isoDate}_${timeStr}_${slug}.md`;
    const relPath = path.join(relDir, fileName);
    const fullPath = path.join(VAULT_ROOT, relPath);

    let md = '';
    if (cat === 'tarefa') {
      const tagLine = allTags.map((t) => `#${t}`).join(' ');
      md = `---\ntitle: "${titulo.replace(/"/g, "'")}"\ndate: ${isoDate}\ncategoria: tarefa\ntags:\n${yamlTags}\n---\n\n- [ ] **${titulo}** — ${conteudo} (${isoDate}) ${tagLine}\n`;
    } else {
      md = `---\ntitle: "${titulo.replace(/"/g, "'")}"\ndate: ${isoDate}\ncategoria: ${cat}\ntags:\n${yamlTags}\n---\n\n# ${titulo}\n\n${conteudo}\n`;
    }

    try {
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, md, 'utf8');
      return JSON.stringify({
        ok: true,
        arquivo: relPath,
        titulo,
        categoria: cat,
        tags: allTags,
      });
    } catch (e) {
      return JSON.stringify({ erro: `Falha ao gravar no Obsidian: ${(e as Error).message}` });
    }
  }

  if (name === 'buscar_notas_obsidian') {
    const query = typeof args.termo_busca === 'string' ? args.termo_busca.trim() : '';
    try {
      const res = await fetch(`${HUB_URL}/api/obsidian/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 6 }),
      });
      if (!res.ok) return JSON.stringify({ erro: 'Serviço de busca do Obsidian indisponível no momento.' });
      const data = await res.json();
      return JSON.stringify(data);
    } catch (e) {
      return JSON.stringify({ erro: `Erro ao consultar Obsidian: ${(e as Error).message}` });
    }
  }

  if (name === 'criar_flashcards_anki') {
    const titulo = typeof args.titulo === 'string' ? args.titulo.trim() : 'Estudo';
    const resumo = typeof args.resumo === 'string' ? args.resumo.trim() : titulo;
    const rawCards = Array.isArray(args.cards) ? args.cards : [];
    const cards = rawCards
      .map((c) => {
        const rec = (c ?? {}) as Record<string, unknown>;
        return {
          front: String(rec.front ?? rec.frente ?? '').trim(),
          back: String(rec.back ?? rec.verso ?? '').trim(),
        };
      })
      .filter((c) => c.front && c.back);

    if (cards.length === 0) return JSON.stringify({ erro: 'Forneça ao menos 1 flashcard com front e back.' });

    try {
      await fetch(`${HUB_URL}/api/anki/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titulo, content: resumo, cards }),
      });
    } catch {}

    const spNow = new Date(now.getTime() - 3 * 3600 * 1000);
    const isoDate = spNow.toISOString().slice(0, 10);
    const timeStr = spNow.toISOString().slice(11, 16).replace(':', '-');
    const slug =
      normalize(titulo)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'anki';
    const relPath = `Pessoal-Notion/Estudos-ESAMC/Anki_${isoDate}_${timeStr}_${slug}.md`;
    const fullPath = path.join(VAULT_ROOT, relPath);
    const cardsMd = cards.map((c, i) => `### Card ${i + 1}\n- **Frente:** ${c.front}\n- **Verso:** ${c.back}`).join('\n\n');
    const md = `---\ntitle: "${titulo.replace(/"/g, "'")}"\ndate: ${isoDate}\ncategoria: anki\ntags:\n  - anki\n  - flashcards\n  - estudo\n---\n\n# 🃏 ${titulo}\n\n${resumo}\n\n## Flashcards (${cards.length})\n\n${cardsMd}\n`;

    try {
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, md, 'utf8');
    } catch {}

    return JSON.stringify({
      ok: true,
      quantidade_cards: cards.length,
      salvo_no_anki_studio: true,
      nota_obsidian: relPath,
    });
  }

  return JSON.stringify({ erro: `Ferramenta desconhecida: ${name}` });
}
