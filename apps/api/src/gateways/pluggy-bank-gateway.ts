import { BankConnectionError } from '../domain/errors.js';
import type { BankAccountData, BankGateway, BankItemData, BankTransactionData } from './bank-gateway.js';
import { bankNameFromTransferNumber, prettyName } from '../services/bank-names.js';

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
  id: string; description: string; amount: number; date: string; type: 'DEBIT' | 'CREDIT';
  currencyCode?: string | null; amountInAccountCurrency?: number | null;
  creditCardMetadata?: { billId?: string | null } | null;
};
type Page<T> = { total: number; totalPages: number; page: number; results: T[] };
type CursorPage<T> = { results: T[]; next: string | null };

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
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Só pra cartão: bandeira + 4 últimos dígitos. Conta corrente e poupança podem ter o mesmo número, então ficam de fora. */
export function cardFingerprint(a: Pick<PluggyAccount, 'type' | 'number' | 'creditData'>): string | null {
  const last4 = (a.number ?? '').replace(/\D/g, '').slice(-4);
  if (a.type !== 'CREDIT' || last4.length < 4) return null;
  return `CREDIT:${(a.creditData?.brand ?? '').trim().toUpperCase()}:${last4}`;
}

/**
 * Fala com a API do Pluggy usando as credenciais do Meu Pluggy.
 * Docs: https://docs.pluggy.ai
 */
export class PluggyBankGateway implements BankGateway {
  private apiKey: string | null = null;
  private apiKeyExpiresAt = 0;

  constructor(private readonly clientId: string, private readonly clientSecret: string) {}

  // /auth tem limite de chamadas: guardamos a chave em memória e reaproveitamos.
  private async getApiKey(): Promise<string> {
    if (this.apiKey && Date.now() < this.apiKeyExpiresAt) return this.apiKey;
    const res = await fetch(`${BASE_URL}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: this.clientId, clientSecret: this.clientSecret }),
    });
    if (!res.ok) throw new BankConnectionError(`Pluggy recusou as credenciais (${res.status}). Confere o client id e o secret.`);
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

  // O connect token é o que o navegador recebe: ele só abre o widget, não dá acesso à API.
  // clientUserId marca o Item com o nosso usuário (aparece no dashboard do Pluggy).
  async createConnectToken(clientUserId: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/connect_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-API-KEY': await this.getApiKey() },
      body: JSON.stringify({ options: { clientUserId, avoidDuplicates: true } }),
    });
    if (!res.ok) throw new BankConnectionError(`Pluggy não liberou o widget (${res.status}). O trial do dashboard ainda tá ativo?`);
    const { accessToken } = (await res.json()) as { accessToken: string };
    return accessToken;
  }

  async fetchItem(itemId: string): Promise<BankItemData> {
    const item = await this.get<{ connector?: { name?: string } }>(`/items/${itemId}`);
    return { institution: item.connector?.name ?? null };
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
    const itemBank = page.results.map((a) => bankNameFromTransferNumber(a.bankData?.transferNumber)).find(Boolean) ?? null;
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
    let path: string | null = `/v2/transactions?${new URLSearchParams({ accountId: accountExternalId, dateFrom: ymd(from), dateTo: ymd(to) })}`;
    while (path) {
      const res: CursorPage<PluggyTransaction> = await this.get(path);
      for (const t of res.results) {
        // DEBIT = dinheiro saindo, CREDIT = entrando. Usamos o "type" pro sinal e o valor absoluto pro tamanho.
        // Compra em dólar: "amount" vem em USD; o que conta é o valor em reais.
        const value = t.currencyCode && t.currencyCode !== 'BRL' && t.amountInAccountCurrency != null ? t.amountInAccountCurrency : t.amount;
        const cents = Math.abs(toCents(value));
        all.push({
          externalId: t.id, description: t.description, amountInCents: t.type === 'DEBIT' ? -cents : cents,
          occurredAt: pluggyDate(t.date), billId: t.creditCardMetadata?.billId ?? null,
        });
      }
      path = res.next ? `/v2/transactions${res.next.startsWith('?') ? res.next : `?${res.next}`}` : null;
    }
    return all;
  }

}

/**
 * Nome bonito da conta. Pelo MeuPluggy vem "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)",
 * então, quando dá pra saber o banco, usa ele: "Nubank", "Bradesco (Poupança)", "Nubank Gold".
 */
export function accountName(a: Pick<PluggyAccount, 'type' | 'name' | 'marketingName' | 'subtype'>, bank: string | null) {
  const savings = a.subtype === 'SAVINGS_ACCOUNT' ? ' (Poupança)' : '';
  if (a.type === 'CREDIT') {
    const raw = a.name || (a.marketingName && a.marketingName !== 'OUTROS' ? a.marketingName : '') || 'Cartão';
    const card = prettyName(raw);
    return bank && !card.toLowerCase().includes(bank.toLowerCase()) ? `${bank} ${card}` : card;
  }
  if (bank) return `${bank}${savings}`;
  return `${a.marketingName || a.name}${savings}`;
}
