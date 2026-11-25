import type { NextConfig } from 'next';
import { securityHeaders } from './lib/security-headers';

const distDir = process.env.NEXT_DIST_DIR?.trim();

const config: NextConfig = {
  ...(distDir ? { distDir } : {}),
  transpilePackages: ['@tostao/contracts'],
  // Não anuncia "X-Powered-By: Next.js" (um detalhe a menos pra quem procura versão vulnerável).
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders({ isProd: process.env.NODE_ENV === 'production' }) }];
  },
  experimental: {
    // Importar extratos: até 12 arquivos x 4 MB por envio (importar/actions.ts), limite total 10 MB.
    // O padrão do Next é 1 MB e estoura com 413 antes da Server Action rodar.
    serverActions: { bodySizeLimit: '10mb' },
  },
};
export default config;
