import type { CategoryRule } from '../domain/entities.js';
import { normalizeDescription } from '../lib/text.js';

/**
 * Descobre a categoria de uma transação pelas regras.
 * Função pura: mesma entrada, mesma saída, sem banco. Por isso é fácil de testar.
 *
 * Prioridade: regra do usuário vence regra do sistema; entre iguais, o padrão mais longo (mais específico) vence.
 */
export function categorizeByRules(description: string, rules: CategoryRule[]): string | null {
  const text = normalizeDescription(description);
  // O padrão salvo não tem números ("PIX ENVIADO - DES FULANO / - DOCTO:"), então compara também sem eles.
  const bare = text.replace(/\d+/g, ' ').replace(/\s+/g, ' ');
  const matches = rules.filter((r) => text.includes(r.pattern) || bare.includes(r.pattern));
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const userA = a.userId ? 1 : 0;
    const userB = b.userId ? 1 : 0;
    if (userA !== userB) return userB - userA;
    return b.pattern.length - a.pattern.length;
  });
  return matches[0]!.categoryId;
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
