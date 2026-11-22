import { proxyShortcuts } from '@/lib/shortcuts-proxy';

// Nunca em cache, sempre no Node. Só POST: o GET/PUT/DELETE caem no 405 padrão do Next.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function POST(request: Request) {
  return proxyShortcuts(request, { apiUrl: process.env.API_URL ?? 'http://localhost:3333' });
}
