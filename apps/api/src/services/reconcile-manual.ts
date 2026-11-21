import type { Transaction } from '../domain/entities.js';

const DAY = 24 * 60 * 60 * 1000;
/** Diferença máxima de data entre o que foi anotado e a cobrança que o banco trouxe. */
export const MATCH_WINDOW_DAYS = 5;

const STOPWORDS = new Set([
  'pix',
  'compra',
  'pagamento',
  'pgto',
  'pagto',
  'debito',
  'credito',
  'cartao',
  'transferencia',
]);

/** Minúsculas, sem acento, só palavras com 3+ letras e fora do ruído que todo extrato tem. */
function tokens(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(\d+\/\d+\)/g, ' ') // "(2/5)" de parcelado
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** Palavra igual, ou uma começando na outra (ex.: "pizza" ↔ "pizzaria"). Sem prefixo curto demais. */
const sameWord = (x: string, y: string) =>
  x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)));

/** Palavras que aparecem em qualquer extrato: sozinhas não provam que são a mesma cobrança. */
const GENERIC_TOKENS = new Set(['mercado', 'casa', 'loja', 'pago', 'pix']);

/**
 * Todas as palavras da descrição mais curta aparecem na outra, E a correspondência é forte:
 * 2 ou mais palavras em comum, ou uma só com mais de 5 letras e que não seja genérica (mercado, casa, loja, pago, pix).
 * "Netflix" ↔ "NETFLIX.COM" casa; "Mercado Livre" ↔ "Mercado Pago" não; "Mercado" ↔ "MERCADO CENTRAL" também não.
 * Na dúvida não casa: deixar um lançamento repetido é melhor que apagar um gasto que era diferente.
 */
export function descriptionsLookAlike(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length === 0 || !short.every((x) => long.some((y) => sameWord(x, y)))) return false;
  if (short.length >= 2) return true;
  const only = short[0]!;
  return only.length > 5 && !GENERIC_TOKENS.has(only);
}

/** Anotado à mão e ainda não confirmado pelo banco. Acerto com pessoa e transferência ficam de fora. */
const isManualEntry = (t: Transaction) => t.externalId === null && !t.personId && !t.isInternalTransfer;
/** Cobrança de verdade do banco. Transferência interna (pagar a própria fatura, Pix entre contas) não é gasto: não confirma nada. */
const isBankEntry = (t: Transaction) => t.externalId !== null && t.accountId !== null && !t.isInternalTransfer;

function sameCharge(manual: Transaction, bank: Transaction): boolean {
  return (
    manual.userId === bank.userId &&
    // Anotado numa conta específica só confirma cobrança DESSA conta; dinheiro vivo (sem conta) pode casar com qualquer uma.
    (manual.accountId === null || manual.accountId === bank.accountId) &&
    manual.amountInCents === bank.amountInCents && // mesmo valor, mesmo sinal
    Math.abs(manual.occurredAt.getTime() - bank.occurredAt.getTime()) <= MATCH_WINDOW_DAYS * DAY &&
    descriptionsLookAlike(manual.description, bank.description)
  );
}

export type ManualBankPair = { manual: Transaction; bank: Transaction };

export type ReconcileResult = {
  /** Pares com certeza (1 anotada ↔ 1 do banco): a anotada pode sair. */
  matched: ManualBankPair[];
  /** Anotadas que parecem iguais a mais de uma cobrança (ou vice-versa): não se mexe, só avisa. */
  ambiguous: Transaction[];
};

/**
 * Procura, entre as transações, anotações à mão que o banco já trouxe de verdade.
 * Só considera par seguro quando é 1 para 1: se uma anotação casa com duas cobranças iguais
 * (ou duas anotações com a mesma cobrança), não dá pra saber qual é qual e nada é apagado.
 * Apagar dinheiro por engano é pior do que deixar duplicado.
 */
export function findManualDuplicates(
  transactions: Transaction[],
  /** Contas ocultas não aparecem pra pessoa: cobrança delas não confirma nada. */
  ignoreAccountIds: ReadonlySet<string> = new Set(),
): ReconcileResult {
  const manuals = transactions.filter(isManualEntry);
  const banks = transactions.filter((t) => isBankEntry(t) && !ignoreAccountIds.has(t.accountId!));

  const banksOf = new Map<string, Transaction[]>();
  const manualsOf = new Map<string, Transaction[]>();
  for (const m of manuals)
    banksOf.set(
      m.id,
      banks.filter((b) => sameCharge(m, b)),
    );
  for (const b of banks)
    manualsOf.set(
      b.id,
      manuals.filter((m) => sameCharge(m, b)),
    );

  const matched: ManualBankPair[] = [];
  const ambiguous: Transaction[] = [];
  for (const m of manuals) {
    const candidates = banksOf.get(m.id) ?? [];
    if (candidates.length === 0) continue;
    const [bank] = candidates;
    if (candidates.length === 1 && bank && (manualsOf.get(bank.id) ?? []).length === 1)
      matched.push({ manual: m, bank });
    else ambiguous.push(m);
  }
  return { matched, ambiguous };
}
