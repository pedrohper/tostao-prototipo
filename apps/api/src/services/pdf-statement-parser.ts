// T5.3: lê o PDF da fatura/extrato (o que Nubank, PicPay, C6, Caixa... entregam fácil) e devolve lançamentos.
//
// Duas etapas, ambas sem tocar em banco:
//   1. `extractPdfText`: valida o arquivo (magic bytes `%PDF-`, tamanho) e extrai o texto numa THREAD separada com
//      timeout rígido. PDF malicioso/enorme que trave o parser é MORTO (worker.terminate), não congela a API.
//   2. `parsePdfText`: parsers determinísticos por banco (Nubank, Itaú, Inter, Bradesco, Santander, C6). Função pura.
// O fallback com IA fica em pdf-ai-fallback.ts (só com aceite LGPD e texto mascarado).
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { PDF_MAX_BYTES } from '@tostao/contracts';
import { daysInMonth } from '../lib/tz.js';

export class PdfParseError extends Error {
  constructor(
    message: string,
    readonly code: 'not_pdf' | 'too_big' | 'encrypted' | 'timeout' | 'too_many_pages' | 'unreadable' | 'empty',
  ) {
    super(message);
  }
}

export const PDF_TIMEOUT_MS = 15_000;
export const PDF_MAX_PAGES = 60;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** Confere o tamanho e os 5 primeiros bytes (`%PDF-`). A extensão do arquivo não vale nada: quem manda é o conteúdo. */
export function assertPdf(bytes: Uint8Array): void {
  if (bytes.length > PDF_MAX_BYTES) throw new PdfParseError('PDF grande demais (máx. 10 MB).', 'too_big');
  // Alguns geradores põem lixo (até 1 KB) antes do cabeçalho; a especificação aceita. Procura o magic no começo.
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i + PDF_MAGIC.length <= head.length; i++) {
    if (PDF_MAGIC.every((b, j) => head[i + j] === b)) return;
  }
  throw new PdfParseError('Esse arquivo não é um PDF.', 'not_pdf');
}

// Código do worker (string): não depende de loader de TypeScript, funciona igual em tsx, vitest e produção.
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  try {
    const { getDocumentProxy, extractText } = await import(workerData.unpdfUrl);
    const pdf = await getDocumentProxy(new Uint8Array(workerData.bytes), { isEvalSupported: false });
    if (pdf.numPages > workerData.maxPages) return parentPort.postMessage({ error: 'too_many_pages' });
    const { text } = await extractText(pdf, { mergePages: false });
    parentPort.postMessage({ ok: true, pages: text });
  } catch (e) {
    const name = e && e.name ? String(e.name) : '';
    parentPort.postMessage({ error: /Password/i.test(name) ? 'encrypted' : 'unreadable' });
  }
})();
`;

/** Extrai o texto (uma string por página) numa thread descartável, com timeout rígido. */
export async function extractPdfText(
  bytes: Uint8Array,
  { timeoutMs = PDF_TIMEOUT_MS, maxPages = PDF_MAX_PAGES }: { timeoutMs?: number; maxPages?: number } = {},
): Promise<string> {
  assertPdf(bytes);
  const unpdfUrl = new URL(`file://${createRequire(import.meta.url).resolve('unpdf')}`).href;
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      // Cópia: a thread não enxerga (nem altera) o buffer da requisição.
      workerData: { bytes: Uint8Array.from(bytes), unpdfUrl, maxPages },
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      fn();
    };
    const timer = setTimeout(
      () =>
        finish(() => reject(new PdfParseError('O PDF demorou demais pra abrir. Tenta exportar de novo.', 'timeout'))),
      timeoutMs,
    );
    worker.once('message', (m: { ok?: true; pages?: string[]; error?: string }) =>
      finish(() => {
        if (m.ok && m.pages) return resolve(m.pages.join('\n'));
        if (m.error === 'encrypted')
          return reject(new PdfParseError('Esse PDF tem senha. Baixe de novo sem senha.', 'encrypted'));
        if (m.error === 'too_many_pages')
          return reject(new PdfParseError(`PDF com mais de ${maxPages} páginas.`, 'too_many_pages'));
        reject(new PdfParseError('Não consegui abrir esse PDF (corrompido?).', 'unreadable'));
      }),
    );
    worker.once('error', () =>
      finish(() => reject(new PdfParseError('Não consegui abrir esse PDF (corrompido?).', 'unreadable'))),
    );
    worker.once('exit', () => finish(() => reject(new PdfParseError('Não consegui abrir esse PDF.', 'unreadable'))));
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Parsers determinísticos
// ---------------------------------------------------------------------------------------------------------------------

export type PdfRow = { key: string; date: string; description: string; amountInCents: number };
export type ParsedPdf = {
  bank: string | null;
  kind: 'BANK' | 'CREDIT';
  rows: PdfRow[];
  statedTotalInCents: number | null;
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

type Bank = { id: string; label: string; detect: RegExp };
// Ordem importa: o primeiro que casar no cabeçalho vence.
const BANKS: Bank[] = [
  { id: 'nubank', label: 'Nubank', detect: /nu\s?pagamentos|nubank|\bnu\s?bank\b/i },
  { id: 'inter', label: 'Inter', detect: /banco\s+inter\b|bancointer|inter\s*&\s*co|inter\s+medium/i },
  { id: 'c6', label: 'C6 Bank', detect: /c6\s*bank|\bc6\s+(?:carbon|bank|fatura|extrato)\b/i },
  { id: 'itau', label: 'Itaú', detect: /ita[uú]\b|itaucard|ita[uú]\s+unibanco/i },
  { id: 'bradesco', label: 'Bradesco', detect: /bradesco/i },
  { id: 'santander', label: 'Santander', detect: /santander/i },
];

const normalizeLine = (l: string) =>
  l
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[−–—]/g, '-')
    .replace(/[•·●]+\s*\d{4}/g, ' ') // "•••• 1234": final do cartão, não é descrição
    .replace(/\s+/g, ' ')
    .trim();

const AMOUNT = String.raw`[-+]?\s?(?:R\$\s?)?[-+]?\s?\d{1,3}(?:\.\d{3})*,\d{2}`;
const AMOUNT_RE = new RegExp(AMOUNT, 'g');
const DATE = String.raw`\d{2}[/.-]\d{2}[/.-]\d{4}|\d{2}/\d{2}/\d{2}|\d{2}/\d{2}|\d{2}\s(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:\s\d{4})?`;
// data + descrição + (um ou dois valores) + C/D opcional
const ROW_RE = new RegExp(
  String.raw`^(${DATE})\s+(.+?)\s+((?:${AMOUNT})(?:\s+(?:${AMOUNT}))?)(?:\s*(C|D|CR|DB))?$`,
  'i',
);
// "Pagamento em 05 NOV -R$ 500,00" (Nubank: a descrição vem antes da data)
const PAYMENT_RE = new RegExp(String.raw`^(pagamento(?:\s+em)?)\s+(${DATE})\s+(${AMOUNT})$`, 'i');

const SKIP_DESC =
  /^(total|subtotal|saldo|resumo|limite|vencimento|pagamento\s+m[ií]nimo|valor\s+(?:total|da\s+fatura|m[ií]nimo)|fatura\s+(?:anterior|atual)|pr[oó]xima|data\s|lan[cç]amentos?\s+(?:do|no)\s+per)/i;
const CREDIT_HINT =
  /pagamento\s+(?:recebido|efetuado|em\b|de\s+fatura|on-?line)|estorno|cr[eé]dito|reembolso|desconto|cashback/i;
const DEBIT_HINT =
  /compra|d[eé]bito|saque|tarifa|boleto|enviad[oa]|pix\s+(?:enviado|pagamento)|pagamento\s+de\s+(?:conta|boleto)|pagto|iof|juros|multa|anuidade/i;
const CREDIT_ENTRY_HINT = /recebid[oa]|dep[oó]sito|cr[eé]dito|rendimento|estorno|sal[aá]rio|reembolso|cashback/i;

export function parseBrAmount(token: string): number | null {
  const neg = /-/.test(token) || /^\(.*\)$/.test(token.trim());
  const m = /(\d{1,3}(?:\.\d{3})*),(\d{2})/.exec(token);
  if (!m) return null;
  const cents = Number(m[1]!.replace(/\./g, '')) * 100 + Number(m[2]);
  return neg ? -cents : cents;
}

const validDay = (y: number, m: number, d: number) =>
  y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(`${y}-${String(m).padStart(2, '0')}`);
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Ano de uma data sem ano: o mais próximo do "ponto de referência" do documento, sem passar de 1 mês à frente dele. */
function inferYear(month: number, ref: { y: number; m: number }): number {
  return month > ref.m + 1 ? ref.y - 1 : ref.y;
}

function parseDate(raw: string, ref: { y: number; m: number }): string | null {
  let m = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(raw);
  if (m) return validDay(+m[3]!, +m[2]!, +m[1]!) ? iso(+m[3]!, +m[2]!, +m[1]!) : null;
  m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(raw);
  if (m) return validDay(2000 + +m[3]!, +m[2]!, +m[1]!) ? iso(2000 + +m[3]!, +m[2]!, +m[1]!) : null;
  m = /^(\d{2})\/(\d{2})$/.exec(raw);
  if (m) {
    const y = inferYear(+m[2]!, ref);
    return validDay(y, +m[2]!, +m[1]!) ? iso(y, +m[2]!, +m[1]!) : null;
  }
  m = /^(\d{2})\s([a-z]{3})[a-z]*\.?(?:\s(\d{4}))?$/i.exec(raw);
  if (m) {
    const mon = MONTHS[m[2]!.toLowerCase()];
    if (!mon) return null;
    const y = m[3] ? +m[3] : inferYear(mon, ref);
    return validDay(y, mon, +m[1]!) ? iso(y, mon, +m[1]!) : null;
  }
  return null;
}

/** Ponto de referência do documento: o vencimento (fatura) ou a data completa mais frequente; senão, hoje. */
function referenceDate(text: string, now: Date): { y: number; m: number } {
  const due = /vencimento[^\d]{0,25}(\d{2})[/.\s-]+(\d{2}|[a-z]{3})[a-z]*[/.\s-]+(\d{4})/i.exec(text);
  if (due) {
    const mon = /^\d+$/.test(due[2]!) ? +due[2]! : (MONTHS[due[2]!.toLowerCase()] ?? 0);
    if (mon) return { y: +due[3]!, m: mon };
  }
  const full = [...text.matchAll(/\b(\d{2})[/.-](\d{2})[/.-](20\d{2})\b/g)].map((x) => ({ y: +x[3]!, m: +x[2]! }));
  if (full.length) {
    const sorted = full.filter((f) => f.m >= 1 && f.m <= 12).sort((a, b) => a.y * 12 + a.m - (b.y * 12 + b.m));
    if (sorted.length) return sorted[sorted.length - 1]!;
  }
  return { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 };
}

function detectKind(text: string): 'BANK' | 'CREDIT' {
  const credit = (
    text.match(
      /fatura|vencimento|pagamento\s+m[ií]nimo|limite\s+(?:total|dispon[ií]vel)|cart[aã]o\s+de\s+cr[eé]dito|data\s+de\s+fechamento/gi,
    ) ?? []
  ).length;
  const bank = (
    text.match(/extrato|saldo\s+(?:anterior|do\s+dia|final|dispon[ií]vel)|conta\s+corrente|ag[eê]ncia/gi) ?? []
  ).length;
  return credit > bank ? 'CREDIT' : 'BANK';
}

function statedTotal(text: string): number | null {
  const m = new RegExp(
    String.raw`(?:total\s+(?:da\s+fatura|a\s+pagar|desta\s+fatura)|valor\s+total\s+da\s+fatura|fatura\s+atual)[^\d-]{0,20}(${AMOUNT})`,
    'i',
  ).exec(text);
  const v = m ? parseBrAmount(m[1]!) : null;
  return v === null ? null : Math.abs(v);
}

/** Chave estável: mesma data + valor + descrição = mesma chave; repetidas no mesmo PDF ganham `:1`, `:2`... */
function withKeys(rows: Omit<PdfRow, 'key'>[]): PdfRow[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = createHash('sha1')
      .update(`${r.date}|${r.amountInCents}|${r.description.toLowerCase()}`)
      .digest('hex')
      .slice(0, 16);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { ...r, key: n === 0 ? base : `${base}:${n}` };
  });
}

/** Parser por texto. Devolve `rows: []` se nada reconhecível (quem chama decide: IA ou erro). */
export function parsePdfText(text: string, { now = new Date() }: { now?: Date } = {}): ParsedPdf {
  const head = text.slice(0, 2500);
  const bank = BANKS.find((b) => b.detect.test(head)) ?? BANKS.find((b) => b.detect.test(text)) ?? null;
  const kind = detectKind(text);
  const ref = referenceDate(text, now);
  const warnings: string[] = [];
  let uncertainSign = 0;
  const raw: Omit<PdfRow, 'key'>[] = [];

  for (const original of text.split(/\r?\n/)) {
    const line = normalizeLine(original);
    if (line.length < 8) continue;

    let date: string | null;
    let description: string;
    let amountToken: string;
    let cd: string | undefined;

    const pay = PAYMENT_RE.exec(line);
    if (pay) {
      date = parseDate(pay[2]!.trim(), ref);
      description = 'Pagamento recebido';
      amountToken = pay[3]!;
    } else {
      const m = ROW_RE.exec(line);
      if (!m) continue;
      date = parseDate(m[1]!.trim(), ref);
      description = m[2]!.trim();
      // Extrato com coluna de saldo: o 1º valor é o lançamento, o 2º é o saldo depois dele.
      amountToken = (m[3]!.match(AMOUNT_RE) ?? [])[0] ?? '';
      cd = m[4]?.toUpperCase();
    }
    if (!date || !amountToken) continue;
    if (SKIP_DESC.test(description)) continue;
    description = description.replace(/\s{2,}/g, ' ').slice(0, 140);
    if (!description) continue;

    const value = parseBrAmount(amountToken);
    if (value === null || value === 0) continue;
    const explicitNegative = /-/.test(amountToken);
    let signed: number;
    if (kind === 'CREDIT') {
      // Fatura: o que aparece como positivo é compra (saída); sinal negativo ou palavra de crédito é pagamento/estorno (entrada).
      signed = explicitNegative || CREDIT_HINT.test(description) ? Math.abs(value) : -Math.abs(value);
    } else if (cd === 'D' || cd === 'DB') signed = -Math.abs(value);
    else if (cd === 'C' || cd === 'CR') signed = Math.abs(value);
    else if (explicitNegative) signed = -Math.abs(value);
    else if (DEBIT_HINT.test(description) && !CREDIT_ENTRY_HINT.test(description)) signed = -Math.abs(value);
    else {
      signed = Math.abs(value);
      if (!/^\+/.test(amountToken.trim()) && !CREDIT_ENTRY_HINT.test(description)) uncertainSign++;
    }
    raw.push({ date, description, amountInCents: signed });
  }

  if (uncertainSign > 0)
    warnings.push(
      `${uncertainSign} linha(s) sem sinal claro foram lidas como entrada. Confere os valores antes de importar.`,
    );
  if (!bank && raw.length > 0) warnings.push('Não reconheci o banco desse PDF. Confere as linhas com atenção.');
  const rows = withKeys(raw);
  const stated = kind === 'CREDIT' ? statedTotal(text) : null;
  if (stated !== null && rows.length > 0) {
    const out = rows.reduce((s, r) => s + (r.amountInCents < 0 ? -r.amountInCents : 0), 0);
    const credits = rows.reduce((s, r) => s + (r.amountInCents > 0 ? r.amountInCents : 0), 0);
    if (Math.abs(out - credits - stated) > 1 && Math.abs(out - stated) > 1)
      warnings.push('O total das linhas lidas não bate com o total da fatura. Pode ter faltado alguma linha.');
  }
  return { bank: bank?.label ?? null, kind, rows, statedTotalInCents: stated, warnings };
}

/** Atalho: bytes → texto → parser. */
export async function parsePdfStatement(bytes: Uint8Array, opts: { now?: Date; timeoutMs?: number } = {}) {
  const text = await extractPdfText(bytes, { timeoutMs: opts.timeoutMs });
  return { text, parsed: parsePdfText(text, { now: opts.now }) };
}
