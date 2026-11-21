// Quem já está logado não precisa ver /entrar nem /criar-conta: vai direto pro app.
// Só olha se o cookie existe (quem valida de verdade é a API). Cookie velho/forjado não gera loop:
// /inicio recebe 401, manda pra /sair (que limpa os cookies) e aí /entrar abre normal.
import { redirect } from 'next/navigation';
import { getToken } from './session';

export const AUTHENTICATED_HOME = '/inicio';

export async function redirectIfAuthenticated(): Promise<void> {
  if (await getToken()) redirect(AUTHENTICATED_HOME);
}
