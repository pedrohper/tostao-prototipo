import { BankConnectionError } from '../domain/errors.js';
import type {
  BankAccountData,
  BankGateway,
  BankItemData,
  BankTransactionData,
  InstitutionLogo,
} from './bank-gateway.js';
import { bankNameFromTransferNumber, prettyName } from '../services/bank-names.js';
import { normalizeDescription } from '../lib/text.js';

const BASE_URL = 'https://api.pluggy.ai';
const API_KEY_TTL_MS = 110 * 60 * 1000; // a chave vale 2h; renovamos com 10 min de folga

type PluggyAccount = {
  id: string;
  name: string;
  marketingName?: string | null;
  type: 'BANK' | 'CREDIT';
  subtype?: string | null;
  balance: number;
  number?: string | null;
  bankData?: { transferNumber?: string | null } | null;
  creditData?: { brand?: string | null; creditLimit?: number | null; balanceDueDate?: string | null } | null;
};
type PluggyTransaction = {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'DEBIT' | 'CREDIT';
  currencyCode?: string | null;
  amountInAccountCurrency?: number | null;
  category?: string | null;
  merchant?: {
    name?: string | null;
    businessName?: string | null;
    category?: string | null;
  } | null;
  creditCardMetadata?: { billId?: string | null } | null;
};
type Page<T> = { total: number; totalPages: number; page: number; results: T[] };
type CursorPage<T> = { results: T[]; next: string | null };

const ITEM_ID_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toCents = (value: number) => Math.round(value * 100);

/**
 * Muitos bancos mandam só o dia, como meia-noite UTC ("2026-11-12T00:00:00.000Z").
 * Em Brasília isso vira 21h do dia ANTERIOR. Sem hora de verdade, fixamos meio-dia de Brasília do mesmo dia.
 */
export function pluggyDate(iso: string): Date {
  const d = new Date(iso);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
    return new Date(`${iso.slice(0, 10)}T12:00:00-03:00`);
  }
  return d;
}
/** O ISO do Pluggy veio sem hora (meia-noite UTC exata)? */
export function isDateOnlyIso(iso: string): boolean {
  const d = new Date(iso);
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Só pra cartão: bandeira + 4 últimos dígitos. Conta corrente e poupança podem ter o mesmo número, então ficam de fora. */
export function cardFingerprint(a: Pick<PluggyAccount, 'type' | 'number' | 'creditData'>): string | null {
  const last4 = (a.number ?? '').replace(/\D/g, '').slice(-4);
  if (a.type !== 'CREDIT' || last4.length < 4) return null;
  return `CREDIT:${(a.creditData?.brand ?? '').trim().toUpperCase()}:${last4}`;
}

type PluggyConnectorItem = {
  id?: number;
  name: string;
  imageUrl?: string | null;
  primaryColor?: string | null;
  isSandbox?: boolean;
};

// No plano MeuPluggy, GET /connectors?countries=BR devolve só o conector 200 (MeuPluggy),
// mas GET /connectors/{id} continua público pra cada banco brasileiro com o imageUrl oficial.
const BR_CONNECTOR_IDS = [
  601, // Itaú
  602, // XP Banking
  603, // Bradesco
  605, // Rico Investimentos
  606, // Mercado Pago
  608, // Santander
  611, // Banco do Brasil
  612, // Nubank
  613, // Banco Genial
  214, // BTGPactual
  615, // Banco Inter
  619, // Caixa Econômica Federal
  623, // Clear Corretora
  624, // Ailos
  626, // C6 Bank
  650, // Cora
  651, // PicPay
  652, // Banco Bmg
  653, // Banco Digio
  656, // Next
  657, // Banco PAN
  658, // Sicoob
  659, // Banrisul
  661, // Sicredi
  663, // Unicred
  671, // Banco do Nordeste do Brasil
  674, // Uber Conta by Digio
  678, // Agi
  681, // Banestes
  682, // BRB
  684, // Cresol
  685, // Daycoval
  686, // Efí
  689, // Neon
  692, // PagBank
  698, // Superdigital
  714, // Banco Sofisa
  716, // BV
  720, // Méliuz
  723, // Banco BS2
  730, // Ame Digital
  742, // Banco Mercantil
  743, // Banco Original
  750, // Crefisa
  769, // Rendimento
  777, // InfinitePay
  783, // Caixa Tem
  787, // Stone Pagamentos
  796, // Toro Investimentos
  800, // Porto Bank
  804, // 99Pay
  807, // Modalmais
  826, // Mercado Bitcoin
  830, // banQi
  831, // Will Bank
  230, // Avenue
] as const;

const toLogo = (c: PluggyConnectorItem): InstitutionLogo | null => {
  if (!c.imageUrl || c.isSandbox || /pluggy/i.test(c.name)) return null;
  return {
    name: c.name,
    imageUrl: c.imageUrl,
    color: c.primaryColor ? `#${c.primaryColor.replace(/^#/, '')}` : null,
  };
};

/**
 * Fala com a API do Pluggy usando as credenciais do Meu Pluggy.
 * Docs: https://docs.pluggy.ai
 */
export class PluggyBankGateway implements BankGateway {
  private apiKey: string | null = null;
  private apiKeyExpiresAt = 0;

  readonly enforcesItemOwnership = true;
  readonly allowsSandbox: boolean;

  /** includeSandbox: libera conectores de teste no widget. Padrão: só fora de produção. */
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly options: { includeSandbox?: boolean } = {},
  ) {
    this.options = { includeSandbox: options.includeSandbox ?? process.env.NODE_ENV !== 'production' };
    this.allowsSandbox = this.options.includeSandbox === true;
  }

  // /auth tem limite de chamadas: guardamos a chave em memória e reaproveitamos.
  private async getApiKey(): Promise<string> {
    if (this.apiKey && Date.now() < this.apiKeyExpiresAt) return this.apiKey;
    const res = await fetch(`${BASE_URL}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: this.clientId, clientSecret: this.clientSecret }),
    });
    if (!res.ok)
      throw new BankConnectionError(`Pluggy recusou as credenciais (${res.status}). Confere o client id e o secret.`);
    const { apiKey } = (await res.json()) as { apiKey: string };
    this.apiKey = apiKey;
    this.apiKeyExpiresAt = Date.now() + API_KEY_TTL_MS;
    return apiKey;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { headers: { 'X-API-KEY': await this.getApiKey() } });
    if (res.status === 404) throw new BankConnectionError('Esse Item ID não existe ou expirou no Pluggy.');
    if (!res.ok) throw new BankConnectionError(`Pluggy respondeu ${res.status} em ${path.split('?')[0]}.`);
    return (await res.json()) as T;
  }

  // Lista pública de conectores: cada banco tem o logo oficial (imageUrl) e a cor.
  async listInstitutionLogos(): Promise<InstitutionLogo[]> {
    const page = await this.get<{ results: PluggyConnectorItem[] }>('/connectors?countries=BR');
    const fromList = page.results.map(toLogo).filter((l): l is InstitutionLogo => l !== null);
    if (fromList.length >= 5) return fromList;

    const settled = await Promise.allSettled(
      BR_CONNECTOR_IDS.map((id) => this.get<PluggyConnectorItem>(`/connectors/${id}`)),
    );
    const seen = new Set(fromList.map((l) => l.name.toLowerCase()));
    const combined = [...fromList];
    for (const res of settled) {
      if (res.status !== 'fulfilled') continue;
      const logo = toLogo(res.value);
      if (!logo) continue;
      const key = logo.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(logo);
    }
    return combined;
  }

  // O connect token é o que o navegador recebe: ele só abre o widget, não dá acesso à API.
  // clientUserId marca o Item com o nosso usuário (aparece no dashboard do Pluggy).
  async createConnectToken(clientUserId: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/connect_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-API-KEY': await this.getApiKey() },
      body: JSON.stringify({
        options: { clientUserId, avoidDuplicates: true, includeSandbox: this.options.includeSandbox === true },
      }),
    });
    if (!res.ok) throw new BankConnectionError(`Não consegui abrir a conexão com o banco agora (${res.status}).`);
    const { accessToken } = (await res.json()) as { accessToken: string };
    return accessToken;
  }

  async fetchItem(itemId: string): Promise<BankItemData> {
    // O Item ID vira parte do caminho: só UUID passa, e ainda assim vai codificado (nada de "../" com a nossa X-API-KEY).
    if (!ITEM_ID_UUID.test(itemId)) throw new BankConnectionError('Item ID inválido.');
    const item = await this.get<{ clientUserId?: string | null; connector?: { name?: string; isSandbox?: boolean } }>(
      `/items/${encodeURIComponent(itemId)}`,
    );
    return {
      institution: item.connector?.name ?? null,
      clientUserId: item.clientUserId ?? null,
      isSandbox: item.connector?.isSandbox === true,
    };
  }

  // Apaga só o Item da nossa Application. A conexão no meu.pluggy.ai continua lá.
  async deleteItem(itemId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      headers: { 'X-API-KEY': await this.getApiKey() },
    });
    if (res.status === 404 || res.status === 400) return; // já não existe (ou nunca foi um Item válido)
    if (!res.ok) throw new BankConnectionError(`Pluggy respondeu ${res.status} ao apagar o Item.`);
  }

  async fetchAccounts(itemId: string): Promise<BankAccountData[]> {
    const page = await this.get<Page<PluggyAccount>>(`/accounts?itemId=${encodeURIComponent(itemId)}`);
    // O código do banco (COMPE) só vem nas contas; o cartão herda o banco da conta do mesmo Item.
    const itemBank =
      page.results.map((a) => bankNameFromTransferNumber(a.bankData?.transferNumber)).find(Boolean) ?? null;
    return page.results.map((a) => {
      const bank = bankNameFromTransferNumber(a.bankData?.transferNumber) ?? itemBank;
      return {
        externalId: a.id,
        name: accountName(a, bank),
        institution: bank,
        fingerprint: cardFingerprint(a),
        type: a.type,
        // No cartão, "balance" é o limite usado (inclui parcelas futuras). Pra gente, dívida é negativo.
        // O sync desconta as parcelas futuras pra chegar na fatura aberta.
        balanceInCents: a.type === 'CREDIT' ? -Math.abs(toCents(a.balance)) : toCents(a.balance),
        ...(a.type === 'CREDIT' && {
          creditLimitInCents: a.creditData?.creditLimit != null ? Math.abs(toCents(a.creditData.creditLimit)) : null,
          dueDate: a.creditData?.balanceDueDate ? new Date(a.creditData.balanceDueDate) : null,
        }),
      };
    });
  }

  // GET /transactions (paginado por página) responde 410 pra Applications novas.
  // O /v2/transactions usa cursor: cada resposta traz "next" (query string pronta) ou null no fim.
  async fetchTransactions(accountExternalId: string, from: Date, to: Date): Promise<BankTransactionData[]> {
    const all: BankTransactionData[] = [];
    let path: string | null =
      `/v2/transactions?${new URLSearchParams({ accountId: accountExternalId, dateFrom: ymd(from), dateTo: ymd(to) })}`;
    while (path) {
      const res: CursorPage<PluggyTransaction> = await this.get(path);
      for (const t of res.results) {
        // DEBIT = dinheiro saindo, CREDIT = entrando. Usamos o "type" pro sinal e o valor absoluto pro tamanho.
        // Compra em dólar: "amount" vem em USD; o que conta é o valor em reais.
        const value =
          t.currencyCode && t.currencyCode !== 'BRL' && t.amountInAccountCurrency != null
            ? t.amountInAccountCurrency
            : t.amount;
        const cents = Math.abs(toCents(value));
        const merchantName = t.merchant?.name?.trim() || null;
        const rawCat = t.category?.trim() || null;
        const merchCat = t.merchant?.category?.trim() || null;
        const providerCategory = rawCat && rawCat.toLowerCase() !== 'services' ? rawCat : (merchCat ?? rawCat);
        all.push({
          externalId: t.id,
          description: cleanPluggyDescription(t.description, merchantName, providerCategory),
          amountInCents: t.type === 'DEBIT' ? -cents : cents,
          occurredAt: pluggyDate(t.date),
          dateOnly: isDateOnlyIso(t.date),
          billId: t.creditCardMetadata?.billId ?? null,
          merchantName,
          providerCategory,
        });
      }
      path = res.next ? `/v2/transactions${res.next.startsWith('?') ? res.next : `?${res.next}`}` : null;
    }
    return all;
  }
}

const KEEP_RAW_DESC =
  /\b(PIX|TED|DOC|TRANSF|TRANSFERENCIA|PAGAMENTO|FATURA|RENDIMENTO|JUROS|DIVIDENDO|RESGATE|APLICACAO|ESTORNO|REEMBOLSO|SALARIO|BOLETO|IOF)\b/;
const KEEP_RAW_CATEGORIES = new Set([
  'same person transfer',
  'same person transfer - cash',
  'transfer - pix',
  'transfers',
  'transfer - internal',
  'transfer - bank slip',
  'credit card payment',
  'proceeds interests and dividends',
  'investments',
  'salary',
  'non-recurring income',
  'tax on financial operations',
  'loans and financing',
]);
const INTERMEDIARIES = new Set([
  'MERCADO PAGO',
  'MERCADOPAGO',
  'PAGSEGURO',
  'PAGBANK',
  'PICPAY',
  'STONE',
  'CIELO',
  'GETNET',
  'REDE',
  'SUMUP',
  'INFINITEPAY',
  'ASAAS',
  'PAYPAL',
  'GOOGLE',
  'APPLE',
]);
const NOISE_TOKENS = new Set([
  'TRIP',
  'PENDING',
  'HELP',
  'HELPUB',
  'UB',
  'COM',
  'BR',
  'BRA',
  'LTDA',
  'SA',
  'PAG',
  'PG',
  'DL',
  'APP',
  'BILL',
]);

/** Limpa descrições ruidosas de cartão ("UBER *UBER *TRIP HELP.UB" -> "Uber") sem apagar contexto de loja ou transferência. */
export function cleanPluggyDescription(
  description: string,
  merchantName: string | null | undefined,
  providerCategory?: string | null,
): string {
  const merchant = merchantName?.trim();
  if (!merchant || merchant.length < 3) return description;
  if (providerCategory && KEEP_RAW_CATEGORIES.has(providerCategory.trim().toLowerCase())) return description;
  const normDesc = normalizeDescription(description);
  const normMerchant = normalizeDescription(merchant);
  if (!normDesc || !normMerchant || normMerchant.length < 3) return description;
  if (KEEP_RAW_DESC.test(normDesc) || INTERMEDIARIES.has(normMerchant)) return description;
  if (!normDesc.includes(normMerchant)) return description;

  const withoutBrand = normDesc.split(normMerchant).join(' ');
  const remaining = withoutBrand
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok && !NOISE_TOKENS.has(tok) && !/\d/.test(tok));

  return remaining.length === 0 ? merchant : description;
}

/**
 * Nome bonito da conta. Pelo MeuPluggy vem "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)",
 * então, quando dá pra saber o banco, usa ele: "Nubank", "Bradesco (Poupança)", "Nubank Gold".
 */
export function accountName(
  a: Pick<PluggyAccount, 'type' | 'name' | 'marketingName' | 'subtype'>,
  bank: string | null,
) {
  const savings = a.subtype === 'SAVINGS_ACCOUNT' ? ' (Poupança)' : '';
  if (a.type === 'CREDIT') {
    const raw = a.name || (a.marketingName && a.marketingName !== 'OUTROS' ? a.marketingName : '') || 'Cartão';
    const card = prettyName(raw);
    return bank && !card.toLowerCase().includes(bank.toLowerCase()) ? `${bank} ${card}` : card;
  }
  if (bank) return `${bank}${savings}`;
  return `${a.marketingName || a.name}${savings}`;
}
