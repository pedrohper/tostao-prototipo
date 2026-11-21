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
  // Alinhado com o aviso do Tostão Auto (antes a regex dele conhecia frases que esta lista não conhecia):
  'PAGAMENTO DA FATURA',
  'PGTO FATURA',
  'MESMA TITULARIDADE', // Pix/TED entre contas do mesmo CPF
];

/** O texto (já normalizado: maiúsculas, sem acento) lembra transferência entre contas suas? Fonte única da regra. */
export const looksInternalByDescription = (normalizedText: string) => KEYWORDS.some((k) => normalizedText.includes(k));

const ONE_DAY = 24 * 60 * 60 * 1000;
/**
 * Compensação de boleto/TED pode levar dias: o outro lado do par pode cair até 3 dias depois.
 * Janela maior = mais acerto; o par continua exigindo mesmo valor, sinais opostos e contas diferentes.
 */
export const PAIR_WINDOW_DAYS = 3;

/**
 * Marca transferências internas, que NÃO podem contar como gasto nem como renda.
 * Ex.: Pix do Nubank pro Mercado Pago é R$ 100 saindo e R$ 100 entrando, ganho zero.
 *
 * Pistas:
 * 1. Palavra-chave na descrição (pagar a própria fatura, "mesma titularidade").
 * 2. Você mandou pra categoria "Não conta" (ex.: repasse com a família) ou ligou a uma pessoa (acerto).
 * 3. Par espelhado: mesmo valor, sinais opostos, contas diferentes do mesmo usuário, até 3 dias de distância.
 *
 * A palavra da PESSOA vale mais que a máquina: lançamento com `internalTransferManual` definido (true = ela marcou,
 * false = ela desmarcou) nunca é reclassificado. Marcado entra no resultado e pode ser o outro lado de um par;
 * desmarcado fica de fora de tudo (nem palavra-chave nem par o puxam de volta).
 *
 * Devolve os ids que devem ser marcados. Não altera nada (função pura).
 */
export function detectInternalTransfers(transactions: Transaction[]): Set<string> {
  const ids = new Set<string>();

  const neutral = new Set<string>();
  const forcedOff = new Set<string>();
  for (const t of transactions) {
    if (t.internalTransferManual === false) {
      forcedOff.add(t.id); // "isso NÃO é transferência": ninguém reclassifica
      continue;
    }
    if (t.internalTransferManual === true) {
      ids.add(t.id);
      continue;
    }
    // "Não conta" e acerto com alguém (empréstimo, cartão emprestado) nunca são gasto nem renda.
    if (t.categoryId === NEUTRAL_CATEGORY_ID || t.personId) {
      ids.add(t.id);
      neutral.add(t.id);
      continue;
    }
    if (looksInternalByDescription(normalizeDescription(t.description))) ids.add(t.id);
  }

  // As já marcadas pela descrição continuam podendo ser o "outro lado" de um par:
  // "Pagamento recebido" no cartão é o espelho do Pix/boleto que saiu da conta pra pagar a fatura.
  const fromBank = transactions.filter((t) => t.accountId !== null && !forcedOff.has(t.id));
  const outs = fromBank.filter((t) => t.amountInCents < 0 && !ids.has(t.id));
  const ins = fromBank.filter((t) => t.amountInCents > 0 && !neutral.has(t.id));
  const used = new Set<string>();

  for (const out of outs) {
    // O candidato MAIS PRÓXIMO no tempo: com a janela de 3 dias, "o primeiro que serve" poderia roubar o par de outra saída.
    let pair: Transaction | undefined;
    let best = Infinity;
    for (const inn of ins) {
      if (used.has(inn.id) || inn.accountId === out.accountId || inn.amountInCents !== -out.amountInCents) continue;
      const gap = Math.abs(inn.occurredAt.getTime() - out.occurredAt.getTime());
      if (gap <= PAIR_WINDOW_DAYS * ONE_DAY && gap < best) {
        best = gap;
        pair = inn;
      }
    }
    if (pair) {
      used.add(pair.id);
      ids.add(out.id);
      ids.add(pair.id);
    }
  }
  return ids;
}

/**
 * O que o sync e a importação devem gravar depois de rodar a detecção numa janela de tempo.
 * - Só lançamentos de banco (accountId) e SEM decisão manual são reclassificados.
 * - Quem hoje é transferência por PAR e ficou perto da borda da janela NÃO é desmarcado: o outro lado do par pode
 *   estar fora da janela (a detecção não o enxergou), e desmarcar quebraria o par.
 */
export function internalTransferUpdates(
  window: Transaction[],
  edge: { from: Date; to: Date },
): { transaction: Transaction; isInternalTransfer: boolean }[] {
  const detected = detectInternalTransfers(window);
  const margin = PAIR_WINDOW_DAYS * ONE_DAY;
  const out: { transaction: Transaction; isInternalTransfer: boolean }[] = [];
  for (const t of window) {
    if (!t.accountId) continue;
    if (t.internalTransferManual !== null && t.internalTransferManual !== undefined) continue;
    const shouldBe = detected.has(t.id);
    if (t.isInternalTransfer === shouldBe) continue;
    const nearEdge =
      t.occurredAt.getTime() < edge.from.getTime() + margin || t.occurredAt.getTime() > edge.to.getTime() - margin;
    if (!shouldBe && nearEdge) continue;
    out.push({ transaction: t, isInternalTransfer: shouldBe });
  }
  return out;
}
