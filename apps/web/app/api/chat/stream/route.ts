import { proxyChatStream } from '@/lib/chat-stream-proxy';
import { getToken } from '@/lib/session';

// Nunca em cache e sempre no Node: é um corpo SSE que vai chegando.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function POST(request: Request) {
  return proxyChatStream(request, {
    getToken,
    apiUrl: process.env.API_URL ?? 'http://localhost:3333',
    appPublicUrl: process.env.APP_PUBLIC_URL,
  });
}
