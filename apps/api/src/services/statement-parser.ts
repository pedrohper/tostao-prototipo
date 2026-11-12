// Lê extrato baixado do app do banco (OFX ou CSV) e devolve transações no formato do Tostão.
// Função pura: não sabe de banco de dados. Quem grava é o ImportStatementUseCase.
import { createHash } from 'node:crypto';

export type ParsedTransaction = { externalId: string; occurredAt: Date; amountInCents: number; description: string };
export type ParsedStatement = { format: 'ofx' | 'csv'; kind: 'BANK' | 'CREDIT'; balanceInCents: number | null; transactions: ParsedTransaction[] };

export class StatementParseError extends Error {}

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
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return noonBr(m[3]!, m[2]!, m[1]!);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return noonBr(m[1]!, m[2]!, m[3]!);
  m = s.match(/^(\d{4})(\d{2})(\d{2})/); // OFX: 20261112000000[-3:BRT]
  if (m) return noonBr(m[1]!, m[2]!, m[3]!);
  return null;
}

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
    if (!occurredAt || amount === null || amount === 0) continue;
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

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function parseCsv(text: string, isCardHint: boolean | undefined): ParsedStatement {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  // O cabeçalho pode não ser a primeira linha (alguns bancos põem título antes)
  const headerIdx = lines.findIndex((l) => /data|date/i.test(l) && /valor|amount|quantia/i.test(l));
  if (headerIdx < 0) throw new StatementParseError('Não achei as colunas de data e valor nesse CSV.');
  const headerLine = lines[headerIdx]!;
  const sep = (headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const header = splitCsvLine(headerLine, sep).map(norm);
  const find = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iDate = find(/^(data|date|dt)/);
  const iAmount = find(/(valor|amount|quantia)/);
  const iDesc = find(/(descri|title|titulo|hist|memo|estabelecimento|lancamento)/);
  const iId = find(/^(identificador|id)$/);
  if (iDate < 0 || iAmount < 0) throw new StatementParseError('Não achei as colunas de data e valor nesse CSV.');

  // Fatura do Nubank: date,title,amount, com gasto POSITIVO. Pro Tostão, gasto é negativo.
  const nubankCard = header.includes('title') && header.includes('amount');
  const isCard = isCardHint ?? nubankCard;

  const ids: (string | null)[] = [];
  const rows: Omit<ParsedTransaction, 'externalId'>[] = [];
  for (const line of lines.slice(headerIdx + 1)) {
    const cols = splitCsvLine(line, sep);
    const occurredAt = parseDate(cols[iDate] ?? '');
    const amount = parseAmount(cols[iAmount] ?? '');
    if (!occurredAt || amount === null || amount === 0) continue;
    rows.push({ occurredAt, amountInCents: isCard ? -amount : amount, description: (iDesc >= 0 ? cols[iDesc] : '') || 'Sem descrição' });
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
