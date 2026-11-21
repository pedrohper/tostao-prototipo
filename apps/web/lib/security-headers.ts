// Cabeçalhos de segurança do site (aplicados por next.config.ts em todas as rotas). Puro, pra poder testar.
//
// CSP: o Next injeta scripts inline de inicialização, então script-src precisa de 'unsafe-inline' (o jeito mais forte,
// com nonce por requisição, exige renderização 100% dinâmica e fica pra depois). O resto é bem fechado:
// nada de plugin (object-src), nada de moldura em outro site (frame-ancestors), base fixa, e só o Pluggy Connect
// (SDK em cdn.pluggy.ai, janela em connect.pluggy.ai) como terceiro.

const PLUGGY_SCRIPT = ['https://cdn.pluggy.ai'];
const PLUGGY_FRAME = ['https://connect.pluggy.ai', 'https://*.pluggy.ai'];
const PLUGGY_CONNECT = ['https://api.pluggy.ai', 'https://*.pluggy.ai'];
const PLUGGY_IMG = ['https://cdn.pluggy.ai', 'https://*.pluggy.ai'];

export function buildCsp({ isProd }: { isProd: boolean }): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'unsafe-eval' só no dev: o React/Next usam pra mapear erros e o HMR.
    'script-src': ["'self'", "'unsafe-inline'", ...(isProd ? [] : ["'unsafe-eval'"]), ...PLUGGY_SCRIPT],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...PLUGGY_IMG],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...PLUGGY_CONNECT, ...(isProd ? [] : ['ws:', 'wss:'])],
    'frame-src': ["'self'", ...PLUGGY_FRAME],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'media-src': ["'self'", 'blob:', 'data:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

export function securityHeaders({ isProd }: { isProd: boolean }): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: buildCsp({ isProd }) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    // HSTS só em produção (é HTTPS lá). Em localhost/HTTP o navegador ignora, mas evitamos mandar à toa.
    ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
  ];
}
