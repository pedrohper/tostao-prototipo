import type { Transaction } from '../domain/entities.js';
import { normalizeDescription } from '../lib/text.js';

const DAY = 24 * 60 * 60 * 1000;

export type Subscription = {
  /** Chave de agrupamento: é o que a pessoa marca como "não é assinatura". */
  key: string;
  name: string;
  amountInCents: number; // positivo: quanto custa por cobrança (a última)
  chargeCount: number;
  lastChargedAt: Date;
  nextChargeAt: Date;
  active: boolean; // false = não cobrou no último ciclo (cancelou?)
  /** Plano/compra em parcelas (ex.: "Globoplay 7/12"): quantas faltam. null = assinatura comum. */
  installmentsLeft: number | null;
  /** Onde cobrou da última vez (cartão ou conta). */
  accountId: string | null;
};

// Parcela no fim/meio da descrição: "5/12", "PARC 03/10", "PARCELA 2 DE 6"
const INSTALLMENT = /(?:PARC(?:ELA)?\.?\s*)?\b(\d{1,2})\s*(?:\/|DE)\s*(\d{1,2})\b/;
// Não é assinatura: Pix, transferência e pagamento de fatura/boleto
const NOT_SUBSCRIPTION = /\bPIX\b|TRANSF|\bTED\b|\bDOC\b|PAGTO|FATURA|NU PAGAMENTOS|BOLETO|SAQUE/;
// Ruído no fim das descrições de loja
const NOISE = new Set(['BR', 'COM', 'WWW', 'LTDA', 'SA', 'ME', 'EIRELI', 'BRASIL', 'HTTPS', 'HTTP']);

/**
 * "Dl*Spotify P47b1" -> "SPOTIFY", "AMAZON PRIME BR 5/12" -> "AMAZON PRIME", "TIM*34988291118" -> "TIM".
 * Prefixo curto antes do * é o intermediário de pagamento (DL*, DM*, EBW*, GLOBO*): fica o nome depois dele.
 */
export function subscriptionKey(description: string): string {
  let text = normalizeDescription(description).replace(INSTALLMENT, ' ');
  const star = text.indexOf('*');
  if (star >= 0) {
    const before = text.slice(0, star).trim();
    const after = text.slice(star + 1);
    text = before.length <= 6 && /[A-Z]{3,}/.test(after) ? after : `${before} ${after}`;
  }
  const words = text
    .split(/[^A-Z0-9]+/)
    .filter((w) => w && !/\d/.test(w) && !NOISE.has(w)) // tira códigos (P47B1, 2K8XX) e ruído
    .filter((w, i, all) => !(i === all.length - 1 && w.length === 1)); // letra solta no fim
  return words.join(' ');
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * Acha cobranças que se repetem todo mês: mesma loja (sem códigos), valor parecido (até 25%)
 * e ~1 mês entre elas. Plano anual parcelado (x/12 com mesmo valor) entra marcado com as parcelas que faltam.
 * Função pura: recebe as transações, devolve as assinaturas.
 */
export function detectSubscriptions(transactions: Transaction[], now: Date): Subscription[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    // "Todo mês" anotado à mão já entra na previsão pela série: não conta de novo como assinatura.
    if (t.amountInCents >= 0 || t.isInternalTransfer || t.seriesId) continue;
    const text = normalizeDescription(t.description);
    if (NOT_SUBSCRIPTION.test(text)) continue;
    // Parcela só entra se for x/12 (plano anual parcelado). Compra em 10x não é assinatura.
    const parcel = text.match(INSTALLMENT);
    if (parcel && parcel[2] !== '12') continue;
    let key = subscriptionKey(t.description);
    if (key.length < 3) continue;
    // Duas séries do mesmo plano parcelado (ex.: renovou o Prime) não podem se misturar:
    // separa pelo mês em que a série começou (mês da cobrança menos o número da parcela).
    if (parcel) key += `#${t.occurredAt.getUTCFullYear() * 12 + t.occurredAt.getUTCMonth() - Number(parcel[1])}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const found: Subscription[] = [];
  for (const [key, all] of groups) {
    if (all.length < 2) continue;
    all.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    // Mesma loja com valores bem diferentes pode ser duas assinaturas (ex.: dois planos): separa por faixa de valor.
    for (const txs of splitByAmount(all)) {
      if (txs.length < 2) continue;
      const gaps = txs.slice(1).map((t, i) => (t.occurredAt.getTime() - txs[i]!.occurredAt.getTime()) / DAY);
      const gap = median(gaps);
      if (gap < 25 || gap > 35) continue; // não é mensal (mercado toda semana, compra solta...)
      if (gaps.some((g) => g < 20)) continue; // duas cobranças no mesmo mês: não é assinatura

      const last = txs[txs.length - 1]!;
      const nextChargeAt = new Date(last.occurredAt.getTime() + Math.round(gap) * DAY);
      const parcel = normalizeDescription(last.description).match(INSTALLMENT);
      const installmentsLeft = parcel ? Math.max(0, Number(parcel[2]) - Number(parcel[1])) : null;
      found.push({
        key,
        name: last.description.replace(INSTALLMENT, '').replace(/\s+/g, ' ').trim(),
        amountInCents: Math.abs(last.amountInCents),
        chargeCount: txs.length,
        lastChargedAt: last.occurredAt,
        nextChargeAt,
        // 3 dias de folga: o banco às vezes lança atrasado. Parcelado que acabou também não está mais ativo.
        active: nextChargeAt.getTime() >= now.getTime() - 3 * DAY && installmentsLeft !== 0,
        installmentsLeft,
        accountId: last.accountId,
      });
    }
  }
  return found.sort((a, b) => Number(b.active) - Number(a.active) || b.amountInCents - a.amountInCents);
}

/** Agrupa valores parecidos (até 25% da mediana do grupo), mantendo a ordem por data. */
function splitByAmount(txs: Transaction[]): Transaction[][] {
  const bands: Transaction[][] = [];
  for (const t of txs) {
    const v = Math.abs(t.amountInCents);
    const band = bands.find((b) => {
      const m = median(b.map((x) => Math.abs(x.amountInCents)));
      return Math.abs(v - m) <= m * 0.25;
    });
    if (band) band.push(t);
    else bands.push([t]);
  }
  return bands;
}
