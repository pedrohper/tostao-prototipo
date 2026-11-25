import { CSV_EXPORT, proxyExport } from '@/lib/export-proxy';
import { getToken } from '@/lib/session';

// Dado pessoal: nunca em cache e sempre no Node.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(request: Request) {
  return proxyExport(
    request,
    {
      getToken,
      apiUrl: process.env.API_URL ?? 'http://localhost:3333',
      appPublicUrl: process.env.APP_PUBLIC_URL,
    },
    CSV_EXPORT,
  );
}
