// T5.3: o que o Atalho do iOS manda (valor ou texto cru da notificação) vira lançamento. Funções puras.
import type { ShortcutWebhookBody } from '@tostao/contracts';
import { MAX_CENTS } from '@tostao/contracts';
import { parseAmount } from './statement-parser.js';

export type ShortcutExpense = {
  kind: 'saida' | 'entrada';
  /** Sempre positivo; `kind` dá o sinal. */
  amountInCents: number;
  description: string;
};

const IN_HINT = /\b(recebid[oa]|recebeu|dep[oó]sito|cr[eé]dito em conta|estorno|reembolso|cashback|pix recebido)\b/i;
const AMOUNT_IN_TEXT = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i;
// "... R$ 45,90 em PADARIA CENTRAL." / "... no IFOOD" / "... para Fulano"
const MERCHANT_AFTER = /\b(?:em|no|na|de|para|pra|:)\s+([^\n]{2,80})$/i;

const FALLBACK_NAME: Record<ShortcutWebhookBody['source'], string> = {
  apple_pay: 'Apple Pay',
  ios_notification: 'Notificação do banco',
  shortcut: 'Atalho do iPhone',
};

/** Valor em centavos (positivo) do campo `amount` (número em reais ou texto BR/US), ou null. */
function amountOf(raw: ShortcutWebhookBody['amount']): number | null {
  if (raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(Math.abs(raw) * 100) : null;
  const cents = parseAmount(raw);
  return cents === null ? null : Math.abs(cents);
}

/**
 * Normaliza o que o Atalho mandou:
 *  - valor: `amount` (número em reais ou "R$ 45,90") ou o 1º "R$ ..." do `text`;
 *  - sinal: compra é SAÍDA por padrão (Apple Pay, notificação, atalho); `kind` explícito vence; texto de "recebido/estorno" vira entrada.
 *    O sinal do número é ignorado (cada app do banco escreve de um jeito): quem decide é o `kind`.
 *  - descrição: `merchant`, ou o estabelecimento achado no texto, ou um nome padrão da origem.
 */
export function parseShortcutPayload(body: ShortcutWebhookBody): ShortcutExpense | null {
  let cents = amountOf(body.amount);
  const text = body.text?.replace(/\s+/g, ' ').trim() ?? '';
  let matchedAmountText = '';
  if ((cents === null || cents === 0) && text) {
    const m = AMOUNT_IN_TEXT.exec(text);
    if (m) {
      cents = parseAmount(m[1]!);
      cents = cents === null ? null : Math.abs(cents);
      matchedAmountText = m[0];
    }
  }
  if (!cents || cents <= 0 || cents > MAX_CENTS) return null;

  const kind = body.kind ?? (IN_HINT.test(text) ? 'entrada' : 'saida');

  let merchant = body.merchant?.trim() ?? '';
  if (!merchant && text) {
    const afterAmount = matchedAmountText
      ? text.slice(text.indexOf(matchedAmountText) + matchedAmountText.length).trim()
      : text;
    const m = MERCHANT_AFTER.exec(afterAmount) ?? MERCHANT_AFTER.exec(text);
    merchant = (m?.[1] ?? '').replace(/[.!\s]+$/g, '').trim();
  }
  const description = (merchant || FALLBACK_NAME[body.source]).slice(0, 140);
  return { kind, amountInCents: cents, description };
}
