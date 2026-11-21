import type { CategoryRule } from '../domain/entities.js';
import { normalizeDescription } from '../lib/text.js';

/**
 * Descobre a categoria de uma transação pelas regras.
 * Função pura: mesma entrada, mesma saída, sem banco. Por isso é fácil de testar.
 *
 * Prioridade: regra do usuário vence regra do sistema; entre iguais, o padrão mais longo (mais específico) vence.
 */
export function categorizeByRules(
  description: string,
  rules: CategoryRule[],
  merchantName?: string | null,
): string | null {
  const candidates = [description, merchantName]
    .filter((s): s is string => Boolean(s?.trim()))
    .map((s) => {
      const text = normalizeDescription(s);
      // O padrão salvo não tem números ("PIX ENVIADO - DES FULANO / - DOCTO:"), então compara também sem eles.
      const bare = text.replace(/\d+/g, ' ').replace(/\s+/g, ' ');
      return { text, bare };
    });
  if (candidates.length === 0) return null;
  const matches = rules.filter((r) => candidates.some((c) => c.text.includes(r.pattern) || c.bare.includes(r.pattern)));
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const userA = a.userId ? 1 : 0;
    const userB = b.userId ? 1 : 0;
    if (userA !== userB) return userB - userA;
    return b.pattern.length - a.pattern.length;
  });
  return matches[0]!.categoryId;
}

const PLUGGY_OUT_CATEGORY_MAP: Record<string, string> = {
  'food delivery': 'delivery',
  'eating out': 'comer-fora',
  'food and drinks': 'comer-fora',
  restaurants: 'comer-fora',
  groceries: 'mercado',
  supermarket: 'mercado',
  'video streaming': 'assinaturas',
  'music streaming': 'assinaturas',
  'digital services': 'assinaturas',
  subscriptions: 'assinaturas',
  streaming: 'assinaturas',
  'taxi and ride-hailing': 'transporte',
  'public transport': 'transporte',
  parking: 'transporte',
  tolls: 'transporte',
  'gas stations': 'transporte',
  fuel: 'transporte',
  'vehicle maintenance': 'transporte',
  transportation: 'transporte',
  transport: 'transporte',
  'cinema, theater and concerts': 'role',
  entertainment: 'role',
  'bars and pubs': 'role',
  nightlife: 'role',
  water: 'casa',
  electricity: 'casa',
  gas: 'casa',
  internet: 'casa',
  telecommunications: 'casa',
  housing: 'casa',
  rent: 'casa',
  utilities: 'casa',
  healthcare: 'saude',
  pharmacy: 'saude',
  medical: 'saude',
  bookstore: 'estudo',
  education: 'estudo',
  shopping: 'compras',
  'online shopping': 'compras',
  clothing: 'compras',
  houseware: 'compras',
  electronics: 'compras',
  gaming: 'jogos',
  'video games': 'jogos',
  gambling: 'apostas',
  betting: 'apostas',
};

const PLUGGY_IN_CATEGORY_MAP: Record<string, string> = {
  salary: 'salario',
  payroll: 'salario',
  'proceeds interests and dividends': 'entrada-outros',
  'non-recurring income': 'entrada-outros',
};

/**
 * Fallback quando nenhuma regra bateu: aproveita a categoria enriquecida do Pluggy
 * apenas para categorias inequívocas (nunca chuta em "Services", "Transfers", "Transfer - PIX" etc.).
 */
export function categorizeByProviderCategory(
  providerCategory: string | null | undefined,
  amountInCents: number,
): string | null {
  if (!providerCategory || amountInCents === 0) return null;
  const key = providerCategory.trim().toLowerCase();
  if (amountInCents < 0) return PLUGGY_OUT_CATEGORY_MAP[key] ?? null;
  return PLUGGY_IN_CATEGORY_MAP[key] ?? null;
}

/**
 * Transforma uma descrição de extrato num padrão de regra.
 * Tira números (data, parcela, código) que mudam a cada compra: "UBER *TRIP 8821" -> "UBER *TRIP".
 */
export function patternFromDescription(description: string): string {
  return normalizeDescription(description)
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s\-*/.]+$/, '')
    .trim();
}
