// Porta extra só com POST /whatsapp/n8n, escutando no IP da ponte do Docker (no servidor, 172.18.0.1 da rede homelab_default).
// Assim o n8n (em container) alcança o Tostão sem a API inteira sair do 127.0.0.1.
import Fastify, { type FastifyInstance } from 'fastify';

export function buildN8nBridge(app: FastifyInstance) {
  const bridge = Fastify({ logger: false, bodyLimit: 256 * 1024 });
  bridge.post('/whatsapp/n8n', async (request, reply) => {
    const secret = request.headers['x-tostao-secret'];
    const r = await app.inject({
      method: 'POST',
      url: '/whatsapp/n8n',
      headers: { 'content-type': 'application/json', ...(typeof secret === 'string' ? { 'x-tostao-secret': secret } : {}) },
      payload: JSON.stringify(request.body ?? {}),
    });
    return reply.status(r.statusCode).header('content-type', 'application/json').send(r.body);
  });
  return bridge;
}

/** A ponte do Docker pode ainda não existir quando o pm2 sobe a API no boot: tenta de novo a cada 30 s. */
export async function listenN8nBridge(bridge: FastifyInstance, host: string, port: number, log: (msg: string) => void) {
  for (;;) {
    try {
      await bridge.listen({ host, port });
      log(`🔌 Ponte do n8n em http://${host}:${port}/whatsapp/n8n`);
      return;
    } catch (err) {
      log(`Ponte do n8n não subiu em ${host}:${port} (${(err as Error).message}). Tento de novo em 30 s.`);
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }
}
