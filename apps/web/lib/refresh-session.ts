// Renova a sessão chamando POST /sessions/refresh na API. Usado pelo proxy (sem dependência do Next).
//
// Por que existe o "dedupe": a API rotaciona o refresh token a cada uso, e reapresentar um token já trocado
// derruba a sessão inteira (detecção de roubo). Uma navegação dispara várias requisições ao mesmo tempo
// (página + prefetch + RSC) e TODAS saem com o mesmo cookie velho. Sem isto, a 2ª pareceria um ladrão e deslogaria
// a pessoa. Aqui, quem chega com o mesmo refresh token recebe o MESMO resultado (por alguns segundos).
// Vale por processo: o web roda em uma instância só (pm2). Com várias instâncias, trocar por lock no Redis.
import type { SessionTokens } from './session-constants';

export type RefreshResult =
  | ({ status: 'ok' } & SessionTokens)
  | { status: 'invalid' } // a API recusou (401): sessão acabou, limpar os cookies
  | { status: 'unavailable' }; // API fora/lenta: não mexer nos cookies, tentar de novo na próxima

const SHARE_WINDOW_MS = 15_000;
const TIMEOUT_MS = 5_000;
const shared = new Map<string, Promise<RefreshResult>>();

type Deps = { fetch?: typeof fetch; apiUrl?: string; clientIp?: string | null };

async function callApi(refreshToken: string, { fetch: f = fetch, apiUrl, clientIp }: Deps): Promise<RefreshResult> {
  const base = apiUrl ?? process.env.API_URL ?? 'http://localhost:3333';
  try {
    const res = await f(`${base}/sessions/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(clientIp ? { 'x-forwarded-for': clientIp } : {}) },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 400) return { status: 'invalid' };
    if (!res.ok) return { status: 'unavailable' };
    const body = (await res.json()) as Partial<SessionTokens>;
    // Resposta torta (vazia, sem os dois tokens) nunca vira cookie.
    if (
      typeof body.accessToken !== 'string' ||
      typeof body.refreshToken !== 'string' ||
      !body.accessToken ||
      !body.refreshToken
    ) {
      return { status: 'unavailable' };
    }
    return { status: 'ok', accessToken: body.accessToken, refreshToken: body.refreshToken };
  } catch {
    return { status: 'unavailable' };
  }
}

export function refreshSession(refreshToken: string, deps: Deps = {}): Promise<RefreshResult> {
  const existing = shared.get(refreshToken);
  if (existing) return existing;
  const promise = callApi(refreshToken, deps);
  shared.set(refreshToken, promise);
  void promise.then((r) => {
    // Falha de rede não fica guardada: a próxima requisição pode tentar de novo.
    if (r.status === 'unavailable') shared.delete(refreshToken);
  });
  const timer = setTimeout(() => shared.delete(refreshToken), SHARE_WINDOW_MS);
  timer.unref?.();
  return promise;
}

/** Só pra testes. */
export function resetRefreshSessionCache() {
  shared.clear();
}
