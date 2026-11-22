import { handleShare } from '@/lib/share-handler';
import { getToken } from '@/lib/session';
import { publicOrigin } from '@/lib/public-origin';

// Share Target do PWA (manifest.webmanifest): recebe o arquivo compartilhado pelo Android. Sempre dinâmico, Node.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function POST(request: Request) {
  return handleShare(request, {
    getToken,
    appPublicUrl: process.env.APP_PUBLIC_URL,
    isProd: process.env.NODE_ENV === 'production',
  });
}

// Quem abre /compartilhar direto (GET) vai pra tela de importar.
export function GET(request: Request) {
  return new Response(null, {
    status: 303,
    headers: { location: `${publicOrigin(request.headers, process.env.APP_PUBLIC_URL)}/importar` },
  });
}
