// T5.3 · pré-visualização editável do PDF: o que a pessoa vê e edita antes de gravar. Funções puras.
import { importRowsBody, type ImportPreviewRow } from '@tostao/contracts';
import { parseMoney } from './format';

/** Linha na tela: o valor é TEXTO (a pessoa digita "45,90") e `out` diz se é saída. */
export type EditableRow = {
  key: string;
  date: string;
  description: string;
  amount: string;
  out: boolean;
  /** Desmarcada = não entra. */
  keep: boolean;
};

export const centsToInput = (cents: number) => (Math.abs(cents) / 100).toFixed(2).replace('.', ',');

export function toEditable(rows: ImportPreviewRow[]): EditableRow[] {
  return rows.map((r) => ({
    key: r.key,
    date: r.date,
    description: r.description,
    amount: centsToInput(r.amountInCents),
    out: r.amountInCents < 0,
    keep: true,
  }));
}

export type RowIssue = { index: number; message: string };

/** Linhas mantidas → corpo do POST /imports/rows. Qualquer linha ruim aponta o problema (não grava nada pela metade). */
export function buildRowsBody(
  rows: EditableRow[],
  meta: { accountName: string; fileName: string; isCard: boolean },
): { ok: true; body: ReturnType<typeof importRowsBody.parse> } | { ok: false; issues: RowIssue[] } {
  const issues: RowIssue[] = [];
  const out: { key: string; date: string; description: string; amountInCents: number }[] = [];
  rows.forEach((r, index) => {
    if (!r.keep) return;
    const cents = parseMoney(r.amount);
    if (cents === null || cents === 0) return void issues.push({ index, message: 'Valor inválido' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return void issues.push({ index, message: 'Data inválida' });
    if (!r.description.trim()) return void issues.push({ index, message: 'Falta a descrição' });
    out.push({
      key: r.key,
      date: r.date,
      description: r.description.trim(),
      amountInCents: (r.out ? -1 : 1) * Math.abs(cents),
    });
  });
  if (issues.length) return { ok: false, issues };
  const parsed = importRowsBody.safeParse({ ...meta, rows: out });
  if (!parsed.success)
    return { ok: false, issues: [{ index: -1, message: parsed.error.issues[0]?.message ?? 'Confere as linhas' }] };
  return { ok: true, body: parsed.data };
}

/** Total das mantidas: fatura = o que saiu; conta = saldo do período. */
export function keptTotal(rows: EditableRow[], isCard: boolean): number {
  let sum = 0;
  for (const r of rows) {
    if (!r.keep) continue;
    const c = parseMoney(r.amount);
    if (c === null) continue;
    const signed = (r.out ? -1 : 1) * Math.abs(c);
    sum += isCard ? (signed < 0 ? -signed : 0) : signed;
  }
  return sum;
}
