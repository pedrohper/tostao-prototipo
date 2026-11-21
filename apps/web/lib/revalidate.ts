import { revalidatePath } from 'next/cache';

/**
 * Telas (e as sub-rotas delas) que mostram dinheiro: saldo, extrato, previsão, limites, metas, acertos, assinaturas.
 * Depois de uma mutação financeira só essas são invalidadas. Antes era `revalidatePath('/', 'layout')`, que derruba o
 * cache do site INTEIRO (inclusive Aprender, Perfil, Amigos, que nada têm a ver com o lançamento que acabou de entrar).
 */
const FINANCE_ROUTES = [
  '/inicio',
  '/carteira',
  '/previsao',
  '/assinaturas',
  '/limites',
  '/acertos',
  '/meta',
  '/categorias',
  '/anotacoes',
  '/fechamento',
  '/renda',
  '/tostao',
  '/mais',
  '/conectar',
] as const;

export function revalidateFinance() {
  // 'layout' num prefixo também cobre as sub-rotas dele (/carteira/[id], /carteira/busca, /acertos/[id]...).
  for (const route of FINANCE_ROUTES) revalidatePath(route, 'layout');
}
