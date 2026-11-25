// BFF da exportação LGPD (T2.5): o navegador pede `/api/me/export` (mesma origem, cookie httpOnly) e este código
// repassa pra API com o token no cabeçalho, devolvendo o arquivo. O navegador nunca vê o token.
// O CSV (T6.21, `/api/me/export.csv`) usa o mesmo caminho e as mesmas travas.
// Função pura com dependências injetadas: a route só liga `getToken` e a env.
import { isTrustedOrigin } from './chat-stream-proxy';
import { clientIpFromHeaders, forwardedForHeader } from './client-ip';

export type ExportProxyDeps = {
  getToken: () => Promise<string | null>;
  apiUrl: string;
  appPublicUrl?: string;
  fetchImpl?: typeof fetch;
};

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/**
 * Anti-CSRF de um GET que gasta cota (2 por dia) e devolve dados pessoais: só aceita pedido feito pela nossa própria
 * página. `Sec-Fetch-Site` é posto pelo navegador e a página não consegue forjar; sem ele (navegador antigo), cai no
 * `Referer`. Um <img src> ou link em outro site cai fora e não consegue gastar a cota de ninguém.
 */
export function isSameOriginRequest(headers: Headers, appPublicUrl?: string): boolean {
  const site = headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const referer = headers.get('referer');
  if (!referer) return false;
  try {
    const synthetic = new Headers(headers);
    synthetic.set('origin', new URL(referer).origin);
    return isTrustedOrigin(synthetic, appPublicUrl);
  } catch {
    return false;
  }
}

/** Nome de arquivo seguro a partir do Content-Disposition da API (nada de caminho nem caractere estranho). */
export function filenameFromDisposition(header: string | null | undefined, fallback: string): string {
  const raw = header?.match(/filename="?([^";]+)"?/i)?.[1]?.trim();
  return raw && /^[A-Za-z0-9._-]{1,100}$/.test(raw) ? raw : fallback;
}

/** O que está sendo baixado. `params`: quais parâmetros da URL seguem pra API (o resto é descartado). */
export type ExportTarget = { path: string; contentType: string; fallbackName: string; params: string[] };

export const JSON_EXPORT: ExportTarget = {
  path: '/me/export',
  contentType: 'application/json; charset=utf-8',
  fallbackName: 'tostao-meus-dados.json',
  params: [],
};

export const CSV_EXPORT: ExportTarget = {
  path: '/me/export.csv',
  contentType: 'text/csv; charset=utf-8',
  fallbackName: 'tostao-lancamentos.csv',
  params: ['from', 'to'],
};

export async function proxyExport(
  request: Request,
  deps: ExportProxyDeps,
  target: ExportTarget = JSON_EXPORT,
): Promise<Response> {
  if (!isSameOriginRequest(request.headers, deps.appPublicUrl)) return json(403, 'Origem não permitida.');

  const token = await deps.getToken();
  if (!token) return json(401, 'Sessão vencida.');

  const asked = new URL(request.url).searchParams;
  const query = new URLSearchParams(
    target.params.flatMap((name) => (asked.has(name) ? [[name, asked.get(name)!]] : [])),
  ).toString();

  const fetchImpl = deps.fetchImpl ?? fetch;
  let upstream: Response;
  try {
    upstream = await fetchImpl(`${deps.apiUrl}${target.path}${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: {
        accept: target.contentType.split(';')[0]!,
        authorization: `Bearer ${token}`,
        ...forwardedForHeader(clientIpFromHeaders((n) => request.headers.get(n))),
      },
      cache: 'no-store',
      signal: request.signal,
    });
  } catch {
    return json(502, 'Não consegui falar com o servidor agora. Tenta de novo em instantes.');
  }

  if (!upstream.ok) {
    // 429 (cota do dia), 401 etc.: repassa status e mensagem como vieram.
    const body = (await upstream.json().catch(() => null)) as { message?: string } | null;
    return json(upstream.status, body?.message ?? 'Não deu pra baixar agora.');
  }

  const fileName = filenameFromDisposition(upstream.headers.get('content-disposition'), target.fallbackName);
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': target.contentType,
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
    },
  });
}
