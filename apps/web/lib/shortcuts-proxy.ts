// BFF do webhook dos Atalhos do iOS (T5.3): o iPhone fala com `https://<site>/api/webhooks/shortcuts` e este código repassa
// pra `POST /webhooks/shortcuts` da API, que não é pública. A credencial é SÓ o token de automação (Bearer tst_...):
// cookies são ignorados (nada de sessão aqui, então não há CSRF), e o IP real segue pra API limitar por IP.
import { clientIpFromHeaders, forwardedForHeader } from './client-ip';

export type ShortcutsProxyDeps = { apiUrl: string; fetchImpl?: typeof fetch };

const MAX_BODY = 16 * 1024;
const TOKEN_HEADER = /^Bearer tst_[A-Za-z0-9_-]{20,100}$/;
const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export async function proxyShortcuts(request: Request, deps: ShortcutsProxyDeps): Promise<Response> {
  const auth = request.headers.get('authorization') ?? '';
  // Formato errado nem chega na API (menos tráfego inútil e nenhum cabeçalho estranho repassado).
  if (!TOKEN_HEADER.test(auth)) return json(401, 'Token inválido.');
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json'))
    return json(415, 'Mande JSON (Content-Type: application/json).');
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY) return json(413, 'Corpo grande demais.');
  const body = await request.text();
  if (body.length > MAX_BODY) return json(413, 'Corpo grande demais.');

  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const upstream = await fetchImpl(`${deps.apiUrl}/webhooks/shortcuts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: auth,
        ...forwardedForHeader(clientIpFromHeaders((n) => request.headers.get(n))),
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    // Só repassa status e o JSON de volta (e o Retry-After do limite): nada mais da API chega no iPhone.
    const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
    const retry = upstream.headers.get('retry-after');
    if (retry) headers.set('retry-after', retry);
    return new Response(await upstream.text(), { status: upstream.status, headers });
  } catch {
    return json(503, 'Não consegui falar com o servidor agora. Tente de novo.');
  }
}
