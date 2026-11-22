// T5.2 · "Repetir todo mês / Parcelar com geração automática" no /anotar: monta o corpo do POST /recurring-rules.
import { createRecurringRuleBody, type CreateRecurringRuleBody } from '@tostao/contracts';

export type RecurringFormInput = {
  /** O que a pessoa digitou no campo valor, em centavos (positivo). */
  cents: number;
  kind: 'saida' | 'entrada';
  repeat: 'nao' | 'mensal' | 'parcelado';
  times: number;
  /** AAAA-MM-DD do 1º lançamento. */
  date: string;
  description: string;
  accountId: string | null;
  categoryId: string | null;
  /** Marcou "lançar sozinho". */
  automatic: boolean;
};

/**
 * Parcelado: o campo é o TOTAL, e a regra guarda o valor de CADA parcela (arredondado ao centavo; o total pode diferir
 * em até `times / 2` centavos do que a pessoa digitou, e a tela avisa o valor da parcela).
 * Devolve null quando o caminho é o antigo (sem "automático", ou "só esse").
 */
export function recurringBodyFrom(i: RecurringFormInput) {
  if (!i.automatic || i.repeat === 'nao') return null;
  const parcelado = i.repeat === 'parcelado';
  const each = parcelado ? Math.round(i.cents / Math.max(2, i.times)) : i.cents;
  return createRecurringRuleBody.safeParse({
    description: i.description,
    amountInCents: each,
    kind: i.kind,
    frequency: 'MONTHLY',
    startDate: i.date,
    accountId: i.accountId,
    categoryId: i.categoryId,
    totalInstallments: parcelado ? Math.max(2, i.times) : null,
    autoPost: true,
  });
}

/** Quanto vale cada parcela (pra mostrar antes de salvar). */
export const installmentCents = (totalCents: number, times: number) => Math.round(totalCents / Math.max(2, times));

export type RecurringBody = CreateRecurringRuleBody;
