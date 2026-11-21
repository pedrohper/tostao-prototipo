// T2.4 · quem já está logado não vê /entrar nem /criar-conta: vai pra /inicio.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT:${to}`);
});
const getToken = vi.fn<() => Promise<string | null>>();
vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }));
vi.mock('./session', () => ({ getToken: () => getToken() }));

import { AUTHENTICATED_HOME, redirectIfAuthenticated } from './auth-redirect';

describe('redirectIfAuthenticated', () => {
  beforeEach(() => {
    redirect.mockClear();
    getToken.mockReset();
  });

  it('com sessão, manda pra /inicio', async () => {
    getToken.mockResolvedValue('um.token.qualquer');
    await expect(redirectIfAuthenticated()).rejects.toThrow('NEXT_REDIRECT:/inicio');
    expect(AUTHENTICATED_HOME).toBe('/inicio');
  });

  it('sem sessão, deixa a página de login/cadastro abrir', async () => {
    getToken.mockResolvedValue(null);
    await expect(redirectIfAuthenticated()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
