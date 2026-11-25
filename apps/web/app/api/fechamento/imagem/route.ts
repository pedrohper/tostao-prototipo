import { createWindowLimiter } from '@/lib/resumo-mes';
import { shareImage } from '@/lib/resumo-mes-handler';
import { renderShareImage } from '@/lib/resumo-mes-imagem';
import { getToken } from '@/lib/session';

// Dado pessoal: nunca em cache. Lê fontes e artes do disco, então precisa do Node.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Desenhar a imagem custa CPU: 30 por pessoa a cada 5 minutos (a API ainda aplica o limite geral dela). */
const allow = createWindowLimiter(30, 5 * 60_000);

export function GET(request: Request) {
  return shareImage(request, {
    getToken,
    apiUrl: process.env.API_URL ?? 'http://localhost:3333',
    appPublicUrl: process.env.APP_PUBLIC_URL,
    render: renderShareImage,
    allow,
  });
}
