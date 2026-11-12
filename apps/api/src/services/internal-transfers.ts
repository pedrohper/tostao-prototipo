import { NEUTRAL_CATEGORY_ID, type Transaction } from '../domain/entities.js';
import { normalizeDescription } from '../lib/text.js';

// Palavras que indicam dinheiro mudando de bolso, não saindo de você.
const KEYWORDS = [
  'PAGAMENTO DE FATURA',
  'PAG FATURA',
  'PAGTO FATURA',
  'PAGAMENTO FATURA',
  'PAGAMENTO RECEBIDO', // como aparece do lado do cartão
  'TRANSFERENCIA ENTRE CONTAS',
  'PIX NU PAGAMENTOS', // pagar a fatura do Nubank por Pix, de outra conta sua
  'GASTOS CARTAO DE CREDITO', // fatura do cartão debitada na conta corrente (lado da conta no Bradesco)
  'PAGTO. POR DEB EM C/C', // fatura do cartão debitada na conta corrente (lado do cartão no Bradesco)
  'DINHEIRO RESERVADO', // cofrinho do Mercado Pago (guardar)
  'DINHEIRO RETIRADO', // cofrinho do Mercado Pago (tirar)
  'APLICACAO RDB',
  'RESGATE RDB',
];

const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * Marca transferências internas, que NÃO podem contar como gasto nem como renda.
 * Ex.: Pix do Nubank pro Mercado Pago é R$ 100 saindo e R$ 100 entrando, ganho zero.
 *
 * Duas pistas:
 * 1. Palavra-chave na descrição (pagar a própria fatura).
 * 0. Você mandou pra categoria "Não conta" (ex.: repasse com a família).
 * 2. Par espelhado: mesmo valor, sinais opostos, contas diferentes do mesmo usuário, até 1 dia de distância.
 *
 * Devolve os ids que devem ser marcados. Não altera nada (função pura).
 */
export function detectInternalTransfers(transactions: Transaction[]): Set<string> {
  const ids = new Set<string>();

  const neutral = new Set<string>();
  for (const t of transactions) {
    if (t.categoryId === NEUTRAL_CATEGORY_ID) {
      ids.add(t.id);
      neutral.add(t.id);
      continue;
    }
    const text = normalizeDescription(t.description);
    if (KEYWORDS.some((k) => text.includes(k))) ids.add(t.id);
  }

  // As já marcadas pela descrição continuam podendo ser o "outro lado" de um par:
  // "Pagamento recebido" no cartão é o espelho do Pix/boleto que saiu da conta pra pagar a fatura.
  const fromBank = transactions.filter((t) => t.accountId !== null);
  const outs = fromBank.filter((t) => t.amountInCents < 0 && !ids.has(t.id));
  const ins = fromBank.filter((t) => t.amountInCents > 0 && !neutral.has(t.id));
  const used = new Set<string>();

  for (const out of outs) {
    const pair = ins.find(
      (inn) =>
        !used.has(inn.id) &&
        inn.accountId !== out.accountId &&
        inn.amountInCents === -out.amountInCents &&
        Math.abs(inn.occurredAt.getTime() - out.occurredAt.getTime()) <= ONE_DAY,
    );
    if (pair) {
      used.add(pair.id);
      ids.add(out.id);
      ids.add(pair.id);
    }
  }
  return ids;
}
