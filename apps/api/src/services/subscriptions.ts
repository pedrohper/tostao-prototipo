import type { Transaction } from '../domain/entities.js';
import { normalizeDescription } from '../lib/text.js';
import { civilParts } from '../lib/tz.js';

const DAY = 24 * 60 * 60 * 1000;
/** Alta que vira aviso: MAIS de 5% sobre a cobrança anterior. */
export const PRICE_INCREASE_PERCENT = 5;

export type PriceIncrease = {
  fromInCents: number;
  toInCents: number;
  /** Quando caiu a cobrança mais cara. */
  chargedAt: Date;
};

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
  /** Mesmo serviço cobrando em dobro (ex.: dois Prime ativos): nome da outra cobrança. */
  duplicateOf: string | null;
  /** Reajuste visto no histórico (usado pelo Tostão Automático). null = o preço não subiu. */
  priceIncrease: PriceIncrease | null;
};

// Parcela no fim/meio da descrição: "5/12", "PARC 03/10", "PARCELA 2 DE 6" (sem diferenciar maiúscula)
const INSTALLMENT = /(?:PARC(?:ELA)?\.?\s*)?\b(\d{1,2})\s*(?:\/|DE)\s*(\d{1,2})\b/i;
const INSTALLMENT_GLOBAL = new RegExp(INSTALLMENT.source, 'gi');

/**
 * "5/12" é a parcela 5 de 12; "15/12" é uma DATA (15 de dezembro), não parcela. Parcela válida tem 1 <= n <= total.
 * Devolve null pra tudo que não é parcela de verdade.
 */
export function installmentOf(text: string): { n: number; total: number } | null {
  for (const m of text.matchAll(INSTALLMENT_GLOBAL)) {
    const n = Number(m[1]);
    const total = Number(m[2]);
    if (total >= 2 && n >= 1 && n <= total) return { n, total };
  }
  return null;
}
/** Tira só a parcela VÁLIDA do texto (uma data DD/MM continua no texto). */
const stripInstallment = (text: string) =>
  text.replace(INSTALLMENT_GLOBAL, (whole, n: string, total: string) =>
    Number(total) >= 2 && Number(n) >= 1 && Number(n) <= Number(total) ? ' ' : whole,
  );

/** A chave sem os sufixos de série (#) e de faixa de valor (@): a loja em si. É o que casa com a descrição de uma compra. */
export const subscriptionBaseKey = (key: string) => key.split(/[#@]/)[0]!;
// Não é assinatura: Pix, transferência e pagamento de fatura/boleto
const NOT_SUBSCRIPTION = /\bPIX\b|TRANSF|\bTED\b|\bDOC\b|PAGTO|FATURA|NU PAGAMENTOS|BOLETO|SAQUE/;
// Ruído no fim das descrições de loja
const NOISE = new Set(['BR', 'COM', 'WWW', 'LTDA', 'SA', 'ME', 'EIRELI', 'BRASIL', 'HTTPS', 'HTTP']);

/**
 * "Dl*Spotify P47b1" -> "SPOTIFY", "AMAZON PRIME BR 5/12" -> "AMAZON PRIME", "TIM*34988291118" -> "TIM".
 * Prefixo curto antes do * é o intermediário de pagamento (DL*, DM*, EBW*, GLOBO*): fica o nome depois dele.
 */
export function subscriptionKey(description: string): string {
  let text = stripInstallment(normalizeDescription(description));
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
export function detectSubscriptions(transactions: Transaction[], now: Date, tz?: string): Subscription[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    // "Todo mês" anotado à mão já entra na previsão pela série: não conta de novo como assinatura.
    if (t.amountInCents >= 0 || t.isInternalTransfer || t.seriesId) continue;
    const text = normalizeDescription(t.description);
    if (NOT_SUBSCRIPTION.test(text)) continue;
    // Parcela só entra se for x/12 (plano anual parcelado). Compra em 10x não é assinatura.
    // "15/12" é data (dia 15), não a parcela 15: installmentOf recusa.
    const parcel = installmentOf(text);
    if (parcel && parcel.total !== 12) continue;
    let key = subscriptionKey(t.description);
    if (key.length < 3) continue;
    // Duas séries do mesmo plano parcelado (ex.: renovou o Prime) não podem se misturar:
    // separa pelo mês em que a série começou (mês da cobrança menos o número da parcela).
    if (parcel) {
      // O mês da cobrança é o do FUSO da pessoa (uma cobrança às 22h de Brasília já é do dia seguinte em UTC).
      const p = civilParts(t.occurredAt, tz);
      key += `#${p.year * 12 + (p.month - 1) - parcel.n}`;
    }
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const found: Subscription[] = [];
  for (const [key, all] of groups) {
    if (all.length < 2) continue;
    all.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    // Mesma loja com valores bem diferentes pode ser duas assinaturas (ex.: dois planos): separa por faixa de valor.
    const bands = splitByAmount(all);
    const monthlyBands = bands.filter((b) => b.length >= 2).length;
    for (const txs of bands) {
      if (txs.length < 2) continue;
      const gaps = txs.slice(1).map((t, i) => (t.occurredAt.getTime() - txs[i]!.occurredAt.getTime()) / DAY);
      const gap = median(gaps);
      if (gap < 25 || gap > 35) continue; // não é mensal (mercado toda semana, compra solta...)
      if (gaps.some((g) => g < 20)) continue; // duas cobranças no mesmo mês: não é assinatura

      const last = txs[txs.length - 1]!;
      const nextChargeAt = new Date(last.occurredAt.getTime() + Math.round(gap) * DAY);
      const parcel = installmentOf(normalizeDescription(last.description));
      const installmentsLeft = parcel ? Math.max(0, parcel.total - parcel.n) : null;
      // Dois planos da MESMA loja (faixas de valor diferentes) precisam de chaves diferentes, senão "ignorar um"
      // esconde os dois e o aviso de duplicidade se confunde. A faixa entra na chave só quando há mais de uma.
      const bandKey =
        monthlyBands > 1 ? `${key}@${Math.round(median(txs.map((x) => Math.abs(x.amountInCents))) / 100)}` : key;
      found.push({
        key: bandKey,
        name: stripInstallment(last.description).replace(/\s+/g, ' ').trim(),
        amountInCents: Math.abs(last.amountInCents),
        chargeCount: txs.length,
        lastChargedAt: last.occurredAt,
        nextChargeAt,
        // 3 dias de folga: o banco às vezes lança atrasado. Parcelado que acabou também não está mais ativo.
        active: nextChargeAt.getTime() >= now.getTime() - 3 * DAY && installmentsLeft !== 0,
        installmentsLeft,
        accountId: last.accountId,
        duplicateOf: null,
        // Parcela não é reajuste (a 1ª costuma vir uns centavos diferente das outras).
        priceIncrease: parcel ? null : priceIncreaseOf(txs, all, bands),
      });
    }
  }
  return markDuplicates(found).sort((a, b) => Number(b.active) - Number(a.active) || b.amountInCents - a.amountInCents);
}

/**
 * O mesmo serviço ativo duas vezes ao mesmo tempo (ex.: dois Prime anuais parcelados no mesmo cartão):
 * costuma ser cobrança em dobro de verdade. Não esconde nenhuma, marca as duas pra pessoa conferir.
 */
function markDuplicates(subs: Subscription[]): Subscription[] {
  return subs.map((s) => {
    if (!s.active) return s;
    const base = subscriptionBaseKey(s.key);
    // Duplicata = mesmo serviço, valor PARECIDO (até 25%) ativo ao mesmo tempo. Planos de preço diferente da mesma loja
    // (ex.: Netflix básico e premium) não são cobrança em dobro.
    const twin = subs.find(
      (o) =>
        o !== s &&
        o.active &&
        subscriptionBaseKey(o.key) === base &&
        Math.abs(o.amountInCents - s.amountInCents) <= 0.25 * Math.max(o.amountInCents, s.amountInCents),
    );
    return twin ? { ...s, duplicateOf: twin.name } : s;
  });
}

const chargeCents = (t: Transaction) => Math.abs(t.amountInCents);

/** Conta em centavos inteiros: exatamente 5% não passa. */
const roseEnough = (from: number, to: number) => to * 100 > from * (100 + PRICE_INCREASE_PERCENT);

/**
 * Reajuste de uma assinatura (`band` = cobranças dela; `all` = tudo da mesma loja, em ordem de data). Dois casos:
 * 1. salto grande, que cai fora da faixa de ±25% e por isso não entrou na assinatura: só vale se o preço era fixo
 *    (3 cobranças iguais), depois dele há UMA única cobrança da loja, um ciclo depois, e no máximo o dobro. Sem essas
 *    travas, qualquer compra solta na mesma loja viraria "aumento";
 * 2. a última cobrança da assinatura veio mais cara que a anterior.
 */
function priceIncreaseOf(band: Transaction[], all: Transaction[], bands: Transaction[][]): PriceIncrease | null {
  const last = band[band.length - 1]!;
  const increase = (from: Transaction, to: Transaction): PriceIncrease => ({
    fromInCents: chargeCents(from),
    toInCents: chargeCents(to),
    chargedAt: to.occurredAt,
  });

  const later = all.filter((t) => t.occurredAt.getTime() > last.occurredAt.getTime());
  const recent = band.slice(-3);
  if (later.length === 1 && recent.length === 3 && recent.every((t) => chargeCents(t) === chargeCents(last))) {
    const jump = later[0]!;
    const days = (jump.occurredAt.getTime() - last.occurredAt.getTime()) / DAY;
    const alone = bands.some((b) => b.length === 1 && b[0] === jump);
    if (
      alone &&
      days >= 25 &&
      days <= 35 &&
      roseEnough(chargeCents(last), chargeCents(jump)) &&
      chargeCents(jump) <= 2 * chargeCents(last)
    )
      return increase(last, jump);
  }

  const previous = band[band.length - 2]!;
  return roseEnough(chargeCents(previous), chargeCents(last)) ? increase(previous, last) : null;
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
