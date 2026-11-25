// Cliente da API, usado só no servidor (server components e server actions).
// O navegador nunca fala direto com a API: passa sempre pelo Next, que anexa o token do cookie.
import { headers as requestHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { clientIpFromHeaders, forwardedForHeader } from './client-ip';
import { getToken } from './session';

const API_URL = process.env.API_URL ?? 'http://localhost:3333';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Código estável vindo da API (ex.: AI_CONSENT_REQUIRED). */
    public code?: string,
  ) {
    super(message);
  }
}

/** IP de quem fez o pedido ao site (a API usa pra limitar abuso por IP). Fora de um pedido (scripts), é null. */
async function currentClientIp(): Promise<string | null> {
  try {
    const h = await requestHeaders();
    return clientIpFromHeaders((name) => h.get(name));
  } catch {
    return null;
  }
}

export async function api<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    skipAuthRedirect?: boolean;
    /** Segundos de cache do Next pra essa resposta (só GET e só dado que muda pouco, ex.: logos). Padrão: sem cache. */
    revalidate?: number;
    /** Desiste depois desse tempo (vira o mesmo erro de "API fora"). Pra leitura que não pode segurar a tela. */
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { ...forwardedForHeader(await currentClientIp()) };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      ...(init.timeoutMs !== undefined ? { signal: AbortSignal.timeout(init.timeoutMs) } : {}),
      // O cache do Next separa por cabeçalho (Authorization incluso): a resposta de uma pessoa nunca serve outra.
      ...(init.revalidate !== undefined ? { next: { revalidate: init.revalidate } } : { cache: 'no-store' as const }),
    });
  } catch {
    throw new ApiError('Não consegui falar com o servidor agora. Tenta de novo em instantes.', 503);
  }

  // skipAuthRedirect (ex.: o próprio login) vem ANTES de olhar o cookie: 401 ali é "senha errada", não "sessão vencida".
  // Um cookie velho no navegador não pode transformar senha errada em redirect (e muito menos em redirect engolido).
  if (res.status === 401 && !init.skipAuthRedirect) {
    // Com token: o proxy já tentou renovar e não deu. /sair limpa os cookies. Sem token: é só entrar.
    redirect(token ? '/sair' : '/entrar');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = data as { message?: string; code?: string };
    throw new ApiError(body.message ?? 'Algo deu errado.', res.status, body.code);
  }
  return data as T;
}
