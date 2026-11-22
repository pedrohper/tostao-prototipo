// T5.3 · POST /compartilhar (Share Target do PWA no Android). Lógica pura com dependências injetadas; a route só liga o `getToken`.
//
// Fluxo: o app do banco "Compartilhar" → Tostão → este POST (multipart) → guardamos o arquivo 10 min (só pra essa pessoa)
// → 303 pra /importar?arquivo=<id>, onde ela CONFERE e confirma. Nada é importado aqui.
// Segurança: anti-CSRF (Sec-Fetch-Site/Origin), exige sessão (o proxy.ts renova o access token antes de chegar aqui),
// teto de tamanho ANTES de ler o corpo, tipo conferido, nome saneado.
import { putShare } from './share-stash';
import { FLASH_COOKIE, FLASH_MAX_AGE_SECONDS, encodeFlash } from './flash-toast';
import { publicOrigin } from './public-origin';
import { SHARE_MAX_BYTES, classifySharedFile, isTrustedShareRequest, safeFileName } from './share-target';
import { accessTokenSub } from './token-expiry';
import type { ToastVariant } from './toast-state';

export type ShareDeps = { getToken: () => Promise<string | null>; appPublicUrl?: string; isProd?: boolean };

const redirect = (origin: string, path: string, flash?: { message: string; variant: ToastVariant }, isProd = false) => {
  const headers = new Headers({ location: `${origin}${path}`, 'cache-control': 'no-store' });
  if (flash)
    headers.append(
      'set-cookie',
      `${FLASH_COOKIE}=${encodeFlash(flash)}; Path=/; Max-Age=${FLASH_MAX_AGE_SECONDS}; SameSite=Lax${isProd ? '; Secure' : ''}`,
    );
  // 303: o navegador troca o POST por um GET (com 307 ele repetiria o POST com o arquivo).
  return new Response(null, { status: 303, headers });
};
const text = (status: number, message: string) =>
  new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export async function handleShare(request: Request, deps: ShareDeps): Promise<Response> {
  const own = [request.headers.get('x-forwarded-host')?.split(',')[0]?.trim(), request.headers.get('host')?.trim()];
  if (deps.appPublicUrl) {
    try {
      own.push(new URL(deps.appPublicUrl).host);
    } catch {
      // APP_PUBLIC_URL inválida: só vale o Host
    }
  }
  if (!isTrustedShareRequest(request.headers, own)) return text(403, 'Origem não permitida.');

  const origin = publicOrigin(request.headers, deps.appPublicUrl);
  const go = (path: string, flash?: { message: string; variant: ToastVariant }) =>
    redirect(origin, path, flash, deps.isProd);

  const token = await deps.getToken();
  const sub = token ? accessTokenSub(token) : null;
  if (!sub) return go('/entrar', { message: 'Entre no Tostão e compartilhe o arquivo de novo.', variant: 'info' });

  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data'))
    return text(415, 'Formato não suportado.');
  // Antes de ler o corpo: o teto vale pra o que o cliente DIZ (e o formData abaixo confere o que chegou de verdade).
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > SHARE_MAX_BYTES + 512 * 1024)
    return go('/importar', { message: 'O arquivo passa de 10 MB.', variant: 'error' });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return text(400, 'Pedido inválido.');
  }
  const file = form.getAll('file').find((f): f is File => typeof f !== 'string' && f.size > 0);
  if (!file)
    return go('/importar', { message: 'Não recebi nenhum arquivo. Tente compartilhar de novo.', variant: 'error' });
  if (file.size > SHARE_MAX_BYTES) return go('/importar', { message: 'O arquivo passa de 10 MB.', variant: 'error' });

  const kind = classifySharedFile(file);
  if (kind === 'image')
    return go('/anotar', {
      message: 'A leitura de comprovante por foto ainda não existe. Anote o valor aqui.',
      variant: 'info',
    });
  if (kind === 'unsupported')
    return go('/importar', { message: 'O Tostão lê extrato em PDF, OFX ou CSV.', variant: 'error' });

  const id = putShare(sub, {
    name: safeFileName(file.name),
    type: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!id)
    return go('/importar', {
      message: 'Muitos arquivos esperando. Tente de novo em alguns minutos.',
      variant: 'error',
    });
  return go(`/importar?arquivo=${encodeURIComponent(id)}`);
}
