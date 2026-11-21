// BFF do chat em streaming (T4.5): o navegador fala com `/api/chat/stream` (mesma origem, cookie httpOnly) e este
// código repassa pra API com o token no cabeçalho, devolvendo o corpo SSE sem segurar nada. O navegador nunca vê
// o token nem fala direto com a API. Função pura com dependências injetadas: a route só liga `getToken` e a env.
import { chatBody } from '@tostao/contracts';
import { clientIpFromHeaders, forwardedForHeader } from './client-ip';

export type ChatProxyDeps = {
  getToken: () => Promise<string | null>;
  apiUrl: string;
  /** `APP_PUBLIC_URL` (produção atrás do proxy do Tailscale). */
  appPublicUrl?: string;
  fetchImpl?: typeof fetch;
};

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: { 'content-type': 'application/json' } });

/**
 * Anti-CSRF das Route Handlers (as Server Actions já têm isso embutido): o `Origin` do navegador tem que ser o
 * próprio site. Um POST vindo de outro site carrega o `Origin` dele, e o navegador não deixa a página forjar o header.
 */
export function isTrustedOrigin(headers: Headers, appPublicUrl?: string): boolean {
  const origin = headers.get('origin');
  if (!origin || origin === 'null') return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const own = [headers.get('x-forwarded-host')?.split(',')[0]?.trim(), headers.get('host')?.trim()];
  if (appPublicUrl) {
    try {
      own.push(new URL(appPublicUrl).host);
    } catch {
      // APP_PUBLIC_URL inválida: só vale a comparação com o Host
    }
  }
  return own.some((h) => h && h === originHost);
}

export async function proxyChatStream(request: Request, deps: ChatProxyDeps): Promise<Response> {
  if (!isTrustedOrigin(request.headers, deps.appPublicUrl)) return json(403, 'Origem não permitida.');
  // JSON exige preflight de outro site; um <form> cross-site não consegue mandar isso.
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json'))
    return json(415, 'Formato não suportado.');

  const token = await deps.getToken();
  if (!token) return json(401, 'Sessão vencida.');

  const parsed = chatBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, parsed.error.issues[0]?.message ?? 'Pergunta inválida.');

  const fetchImpl = deps.fetchImpl ?? fetch;
  let upstream: Response;
  try {
    upstream = await fetchImpl(`${deps.apiUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        authorization: `Bearer ${token}`,
        ...forwardedForHeader(clientIpFromHeaders((n) => request.headers.get(n))),
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
      signal: request.signal, // a pessoa fechou a aba: derruba a chamada e a API cancela a IA
    });
  } catch {
    return json(502, 'A API tá fora do ar.');
  }

  const type = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !upstream.body || !type.includes('text/event-stream')) {
    // Erro normal da API (403 sem aceite de IA, 429 de cota...): repassa status e corpo JSON como vieram.
    const text = await upstream.text().catch(() => '');
    return new Response(text, {
      status: upstream.ok ? 502 : upstream.status,
      headers: { 'content-type': type.includes('json') ? 'application/json' : 'text/plain; charset=utf-8' },
    });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
