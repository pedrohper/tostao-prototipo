// Lê extrato baixado do app do banco (OFX ou CSV) e devolve transações no formato do Tostão.
// Função pura: não sabe de banco de dados. Quem grava é o ImportStatementUseCase.
import { createHash } from 'node:crypto';

export type ParsedTransaction = { externalId: string; occurredAt: Date; amountInCents: number; description: string };
export type ParsedStatement = { format: 'ofx' | 'csv'; kind: 'BANK' | 'CREDIT'; balanceInCents: number | null; transactions: ParsedTransaction[] };

export class StatementParseError extends Error {}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Meio-dia de Brasília: extrato só tem o dia, e assim ele não pula pro dia anterior. */
const noonBr = (y: string, m: string, d: string) => new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00-03:00`);

/** "1.234,56", "-12.50", "R$ 9,90", "(10,00)" → centavos */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/R\$|\s/g, '').trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.'); // formato BR
  else s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return negative ? -cents : cents;
}

function parseDate(raw: string): Date | null {
  const s = raw.trim().replace(/^"|"$/g, '');
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return noonBr(m[3]!, m[2]!, m[1]!);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?!\d)/); // 12/11/26
  if (m) return noonBr(`20${m[3]}`, m[2]!, m[1]!);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return noonBr(m[1]!, m[2]!, m[3]!);
  m = s.match(/^(\d{4})(\d{2})(\d{2})/); // OFX: 20261112000000[-3:BRT]
  if (m) return noonBr(m[1]!, m[2]!, m[3]!);
  return null;
}

/** Linha de saldo no meio do extrato (BB, Itaú, Bradesco põem) não é transação. */
const isBalanceLine = (desc: string) => /^\s*(s\s*a\s*l\s*d\s*o|saldo (anterior|do dia|final|disponivel|em conta)|saldo$)/i.test(norm(desc));

const hashId = (parts: string[]) => createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);

/** Mesma data+valor+descrição duas vezes no mesmo arquivo (dois cafés iguais) = transações diferentes. */
function withStableIds(rows: Omit<ParsedTransaction, 'externalId'>[], idOf: (r: Omit<ParsedTransaction, 'externalId'>, i: number) => string | null) {
  const seen = new Map<string, number>();
  return rows.map((r, i) => {
    const given = idOf(r, i);
    if (given) return { ...r, externalId: given };
    const base = [r.occurredAt.toISOString().slice(0, 10), String(r.amountInCents), r.description.toUpperCase()].join('|');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...r, externalId: `h:${hashId([base, String(n)])}` };
  });
}

function parseOfx(text: string): ParsedStatement {
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '';
  const blocks = text.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]!);
  const isCard = /<CCSTMTRS>/i.test(text);
  const fitids: (string | null)[] = [];
  const rows: Omit<ParsedTransaction, 'externalId'>[] = [];
  for (const b of blocks) {
    const occurredAt = parseDate(tag(b, 'DTPOSTED'));
    const amount = parseAmount(tag(b, 'TRNAMT'));
    const description = (tag(b, 'MEMO') || tag(b, 'NAME') || 'Sem descrição').replace(/\s+/g, ' ');
    if (!occurredAt || amount === null || amount === 0 || isBalanceLine(description)) continue;
    rows.push({ occurredAt, amountInCents: amount, description });
    fitids.push(tag(b, 'FITID') || null);
  }
  const bal = parseAmount(tag(text.match(/<LEDGERBAL>[\s\S]*?(<\/LEDGERBAL>|<AVAILBAL>|$)/i)?.[0] ?? '', 'BALAMT'));
  return {
    format: 'ofx',
    kind: isCard ? 'CREDIT' : 'BANK',
    balanceInCents: bal,
    transactions: withStableIds(rows, (_, i) => (fitids[i] ? `ofx:${fitids[i]}` : null)),
  };
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (c === sep && !quoted) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}


const DATE_COL = /(^|[\s_])(data|date|dt)([\s_.]|$)|^data/;
const AMOUNT_COL = /(valor|amount|quantia|montante)/;
const CREDIT_COL = /(credito|entrada)/;
const DEBIT_COL = /(debito|saida)/;

function findHeader(lines: string[]) {
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i]!;
    const sep = [';', '\t', ','].sort((a, b) => line.split(b).length - line.split(a).length)[0]!;
    const header = splitCsvLine(line, sep).map((h) => norm(h).replace(/^"|"$/g, ''));
    const hasDate = header.some((h) => DATE_COL.test(h));
    const hasAmount = header.some((h) => AMOUNT_COL.test(h) && !/saldo|balance/.test(h));
    const hasSplit = header.some((h) => CREDIT_COL.test(h)) && header.some((h) => DEBIT_COL.test(h));
    if (hasDate && (hasAmount || hasSplit)) return { idx: i, sep, header };
  }
  return null;
}

function parseCsv(text: string, isCardHint: boolean | undefined): ParsedStatement {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  // O cabeçalho pode não ser a primeira linha (alguns bancos põem título e resumo antes)
  const found = findHeader(lines);
  if (!found) throw new StatementParseError('Não achei as colunas de data e valor nesse CSV.');
  const { idx: headerIdx, sep, header } = found;
  const find = (re: RegExp, not?: RegExp) => header.findIndex((h) => re.test(h) && !(not && not.test(h)));
  // Primeira coluna de data (Inter/C6 têm "Data Lançamento" e "Data Contábil": vale a primeira)
  const iDate = find(DATE_COL);
  // Mercado Pago: TRANSACTION_NET_AMOUNT. Ignora colunas de saldo.
  const iNet = find(/net_amount|valor liquido/);
  const iAmount = iNet >= 0 ? iNet : find(AMOUNT_COL, /saldo|balance|credito|debito|entrada|saida/);
  const iCredit = iAmount < 0 ? find(CREDIT_COL, /saldo/) : -1;
  const iDebit = iAmount < 0 ? find(DEBIT_COL, /saldo/) : -1;
  // Descrição: junta "Histórico" + "Descrição" quando os dois existem (Inter, Bradesco, C6)
  const descCols = header
    .map((h, i) => (/(descri|title|titulo|hist|memo|estabelecimento|lancamento|transaction_type|tipo)/.test(h) && !DATE_COL.test(h) ? i : -1))
    .filter((i) => i >= 0)
    .slice(0, 2);
  const iId = find(/^(identificador|id|reference_id|id da transacao)$/);

  // Fatura do Nubank: date,title,amount, com gasto POSITIVO. Pro Tostão, gasto é negativo.
  const nubankCard = header.includes('title') && header.includes('amount');
  const isCard = isCardHint ?? nubankCard;

  const ids: (string | null)[] = [];
  const rows: Omit<ParsedTransaction, 'externalId'>[] = [];
  for (const line of lines.slice(headerIdx + 1)) {
    const cols = splitCsvLine(line, sep).map((c) => c.replace(/^"|"$/g, ''));
    const occurredAt = parseDate(cols[iDate] ?? '');
    let amount: number | null;
    if (iAmount >= 0) amount = parseAmount(cols[iAmount] ?? '');
    else {
      const credit = parseAmount(cols[iCredit] ?? '') ?? 0;
      const debit = parseAmount(cols[iDebit] ?? '') ?? 0;
      amount = credit === 0 && debit === 0 ? null : Math.abs(credit) - Math.abs(debit);
    }
    const parts = descCols.map((i) => cols[i] ?? '').filter(Boolean);
    const description = [...new Set(parts)].join(' - ').replace(/\s+/g, ' ').trim() || 'Sem descrição';
    if (!occurredAt || amount === null || amount === 0 || isBalanceLine(description)) continue;
    rows.push({ occurredAt, amountInCents: isCard ? -amount : amount, description });
    ids.push(iId >= 0 && cols[iId] ? `csv:${cols[iId]}` : null);
  }
  return { format: 'csv', kind: isCard ? 'CREDIT' : 'BANK', balanceInCents: null, transactions: withStableIds(rows, (_, i) => ids[i] ?? null) };
}

export function parseStatement(content: string, fileName: string, opts: { isCard?: boolean } = {}): ParsedStatement {
  const text = content.replace(/^﻿/, '');
  const looksOfx = /\.ofx$/i.test(fileName) || /<OFX>/i.test(text) || /OFXHEADER/i.test(text);
  const parsed = looksOfx ? parseOfx(text) : parseCsv(text, opts.isCard);
  if (looksOfx && opts.isCard !== undefined) parsed.kind = opts.isCard ? 'CREDIT' : 'BANK';
  if (!parsed.transactions.length) throw new StatementParseError('Não achei nenhuma transação nesse arquivo.');
  return parsed;
}
