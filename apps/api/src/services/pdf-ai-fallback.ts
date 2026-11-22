// T5.3: quando NENHUM layout conhecido serve, pede à IA (DeepSeek) pra ler as linhas do PDF.
// Regras (LGPD, Fase 0): só roda com o aceite da IA ativo (quem chama confere), o texto sai MASCARADO por
// `scrubFinancialText` e MINIMIZADO: vão só as linhas que parecem lançamento (têm valor), nunca o cabeçalho com nome,
// endereço ou número de conta da pessoa. A resposta é validada (Zod) e cada linha conferida como se fosse entrada do usuário.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { MAX_CENTS } from '@tostao/contracts';
import { daysInMonth } from '../lib/tz.js';
import { AiUnavailableError, type AiGateway } from '../gateways/ai-gateway.js';
import { scrubFinancialText } from './pii-scrubber.js';
import type { PdfRow } from './pdf-statement-parser.js';

const MAX_LINES = 400;
const MAX_CHARS = 30_000;
export const AI_TIMEOUT_MS = 25_000;

const reply = z.object({
  bank: z.string().max(40).nullable().optional(),
  kind: z.enum(['BANK', 'CREDIT']).optional(),
  rows: z
    .array(
      z.object({
        date: z.string(),
        description: z.string(),
        amountInCents: z.number().int(),
      }),
    )
    .max(MAX_LINES),
});

// Valor(es) no fim da linha: "10,00", "-R$ 45,90", "150,00 1.150,00" (lançamento + saldo), com C/D opcional.
const TRAILING_AMOUNTS = /((?:[-+]?\s?(?:R\$\s?)?\d{1,3}(?:\.\d{3})*,\d{2}(?:\s?[CD])?\s*){1,2})$/i;

/**
 * Mascara só a DESCRIÇÃO: o scrubber de Pix com nome troca "tudo depois do tipo" por [PESSOA], o que levaria o valor
 * junto. O valor do fim da linha não é dado pessoal e a IA precisa dele, então fica de fora da máscara.
 */
function scrubLine(raw: string): string {
  const m = TRAILING_AMOUNTS.exec(raw);
  if (!m) return scrubFinancialText(raw);
  return `${scrubFinancialText(raw.slice(0, m.index))} ${m[1]!.trim()}`.trim();
}

/** Só as linhas com cara de lançamento (têm um valor "1.234,56"), cada uma mascarada. Cabeçalho nunca sai daqui. */
export function candidateLines(text: string): string {
  const lines: string[] = [];
  let total = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (!/\d{1,3}(?:\.\d{3})*,\d{2}/.test(raw)) continue;
    const line = scrubLine(raw).slice(0, 200);
    if (!line) continue;
    total += line.length + 1;
    if (lines.length >= MAX_LINES || total > MAX_CHARS) break;
    lines.push(line);
  }
  return lines.join('\n');
}

const validDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [+m[1]!, +m[2]!, +m[3]!];
  return y >= 1990 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(`${y}-${m[2]}`);
};

export type AiExtraction = { bank: string | null; kind: 'BANK' | 'CREDIT'; rows: PdfRow[] };

/** Devolve as linhas lidas pela IA, ou null se ela não conseguiu (a pessoa preenche na mão). */
export async function extractWithAi(
  ai: AiGateway,
  text: string,
  hints: { bank: string | null; kind: 'BANK' | 'CREDIT'; year: number },
): Promise<AiExtraction | null> {
  const lines = candidateLines(text);
  if (!lines) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
  try {
    const content = await ai.reply(
      [
        {
          role: 'system',
          content:
            'Você lê linhas de uma fatura de cartão ou extrato bancário brasileiro e devolve SÓ um JSON, sem texto fora dele. ' +
            'Formato: {"bank": string|null, "kind": "BANK"|"CREDIT", "rows": [{"date":"AAAA-MM-DD","description":string,"amountInCents":inteiro}]}. ' +
            'amountInCents em CENTAVOS; NEGATIVO = dinheiro que saiu (compra, débito, tarifa), POSITIVO = entrou (pagamento recebido, estorno, crédito, depósito). ' +
            'Ignore totais, saldos, limites e linhas que não são lançamentos. Nomes entre colchetes ([PESSOA], [ID]) são máscaras: mantenha como estão. ' +
            `Se a data não tiver ano, use ${hints.year} (ou ${hints.year - 1} se o mês for bem posterior ao vencimento).`,
        },
        {
          role: 'user',
          content: `Dica: banco=${hints.bank ?? 'desconhecido'}, tipo=${hints.kind === 'CREDIT' ? 'fatura de cartão' : 'extrato de conta'}.\nLinhas:\n${lines}`,
        },
      ],
      { json: true, temperature: 0, maxTokens: 6000, signal: ctrl.signal },
    );
    const parsed = reply.safeParse(JSON.parse(content));
    if (!parsed.success) return null;
    const seen = new Map<string, number>();
    const rows: PdfRow[] = [];
    for (const r of parsed.data.rows) {
      const description = r.description.trim().slice(0, 140);
      if (!validDate(r.date) || !description || r.amountInCents === 0 || Math.abs(r.amountInCents) > MAX_CENTS)
        continue;
      const base = createHash('sha1')
        .update(`${r.date}|${r.amountInCents}|${description.toLowerCase()}`)
        .digest('hex')
        .slice(0, 16);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      rows.push({ key: n === 0 ? base : `${base}:${n}`, date: r.date, description, amountInCents: r.amountInCents });
    }
    if (rows.length === 0) return null;
    return { bank: parsed.data.bank?.trim() || hints.bank, kind: parsed.data.kind ?? hints.kind, rows };
  } catch (err) {
    if (err instanceof AiUnavailableError || err instanceof SyntaxError || (err as Error).name === 'AbortError')
      return null;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
