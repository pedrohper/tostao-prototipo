// Entende "gastei 25 no ifood", "paguei R$ 32,50 de uber ontem", "recebi 100 do pai".
// Regra simples e previsível (sem IA): se não bater, a mensagem vai pro chat normal.

export type ParsedExpense = {
  kind: 'saida' | 'entrada';
  amountInCents: number;
  description: string;
  daysAgo: 0 | 1;
};

const OUT = ['gastei', 'paguei', 'comprei', 'torrei', 'gasto', 'gastou'];
const IN = ['recebi', 'ganhei', 'entrou', 'caiu'];
const VERB = [...OUT, ...IN].join('|');
const AMOUNT = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
const UNIT = String.raw`(?:reais|real|conto|contos|pila|pilas|r\$)?`;
const RE = new RegExp(String.raw`^(?:eu\s+|hoje\s+|ontem\s+)?(${VERB})\s+(?:r\$\s*)?${AMOUNT}\s*${UNIT}\s*(.*)$`, 'i');
const LEAD = /^(?:(?:no|na|nos|nas|num|numa|em|de|do|da|dos|das|com|pro|pra|pelo|pela|um|uma|uns|umas|o|a|os|as)\s+)+/i;

/** "25" -> 2500, "32,50" -> 3250, "1.234,56" -> 123456, "25.5" -> 2550. */
export function parseAmountToCents(raw: string): number {
  let s = raw;
  if (/\.\d{3}(?:,|$)/.test(s)) s = s.replace(/\./g, '');
  s = s.replace(',', '.');
  return Math.round(Number(s) * 100);
}

export function parseExpense(message: string): ParsedExpense | null {
  const text = message.trim().replace(/\s+/g, ' ');
  const m = RE.exec(text);
  if (!m) return null;
  const verb = m[1]!.toLowerCase();
  const amountInCents = parseAmountToCents(m[2]!);
  if (!amountInCents || amountInCents <= 0 || amountInCents > 100_000_000) return null;

  let rest = (m[3] ?? '').replace(/[.!?]+$/, '').trim();
  const daysAgo = /\bontem\b/i.test(text) ? 1 : 0;
  rest = rest.replace(/\b(?:ontem|hoje)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  rest = rest.replace(LEAD, '').trim();
  if (rest.length > 80) rest = rest.slice(0, 80).trim();
  const description = rest ? rest[0]!.toUpperCase() + rest.slice(1) : 'Anotado pelo WhatsApp';
  return { kind: IN.includes(verb) ? 'entrada' : 'saida', amountInCents, description, daysAgo };
}
