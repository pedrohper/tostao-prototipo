import type { Transaction } from '../domain/entities.js';
import { normalizeDescription } from '../lib/text.js';

const DAY = 24 * 60 * 60 * 1000;

export type Subscription = {
  name: string;
  amountInCents: number; // positivo: quanto custa por cobrança (a última)
  chargeCount: number;
  lastChargedAt: Date;
  nextChargeAt: Date;
  active: boolean; // false = não cobrou no último ciclo (cancelou?)
};

/** "AMAZON PRIME*2K8XX 11/24" -> "AMAZON PRIME" : tira números, códigos e pontuação pra agrupar a mesma cobrança. */
export function subscriptionKey(description: string): string {
  return normalizeDescription(description)
    .replace(/\*\S*/g, ' ') // códigos depois do * (ex.: AMAZON PRIME*2K8XX)
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

// Parcelado não é assinatura: "PARC 03/10", "3/12"
const INSTALLMENT = /PARC|\b\d{1,2}\/\d{1,2}\b/;

/**
 * Acha cobranças que se repetem todo mês: mesma descrição (sem os códigos),
 * valor parecido (até 25% de diferença) e intervalo de ~1 mês entre elas.
 * Função pura: recebe as transações, devolve as assinaturas.
 */
export function detectSubscriptions(transactions: Transaction[], now: Date): Subscription[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.amountInCents >= 0 || t.isInternalTransfer) continue;
    if (INSTALLMENT.test(normalizeDescription(t.description))) continue;
    const key = subscriptionKey(t.description);
    if (key.length < 3) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const found: Subscription[] = [];
  for (const txs of groups.values()) {
    if (txs.length < 2) continue;
    txs.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    const gaps = txs.slice(1).map((t, i) => (t.occurredAt.getTime() - txs[i]!.occurredAt.getTime()) / DAY);
    const gap = median(gaps);
    if (gap < 25 || gap > 35) continue; // não é mensal (mercado toda semana, compra solta...)
    if (gaps.some((g) => g < 20)) continue; // duas cobranças no mesmo mês: não é assinatura

    const amounts = txs.map((t) => Math.abs(t.amountInCents));
    const typical = median(amounts);
    if (amounts.some((a) => Math.abs(a - typical) > typical * 0.25)) continue;

    const last = txs[txs.length - 1]!;
    const nextChargeAt = new Date(last.occurredAt.getTime() + Math.round(gap) * DAY);
    found.push({
      name: last.description,
      amountInCents: Math.abs(last.amountInCents),
      chargeCount: txs.length,
      lastChargedAt: last.occurredAt,
      nextChargeAt,
      active: now.getTime() - nextChargeAt.getTime() < 10 * DAY,
    });
  }
  return found.sort((a, b) => Number(b.active) - Number(a.active) || b.amountInCents - a.amountInCents);
}
