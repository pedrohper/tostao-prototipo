// T6.3: scripts/healthcheck.sh. Alerta depois de 2 falhas seguidas, uma vez só ao cair e uma ao voltar.
// Sobe dois servidores locais (alvo de saúde e webhook) e roda o script de verdade com bash.
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const SCRIPT = fileURLToPath(new URL('../../../scripts/healthcheck.sh', import.meta.url));

let apiStatus = 200;
let webStatus = 200;
let webhookStatus = 200;
let webhookBodies: Array<Record<string, unknown>> = [];
let servers: Server[] = [];
let ports = { api: 0, web: 0, hook: 0 };
let stateDir = '';
let envFile = '';

function listen(handler: Parameters<typeof createServer>[1]) {
  return new Promise<{ server: Server; port: number }>((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: typeof addr === 'object' && addr ? addr.port : 0 });
    });
  });
}

beforeAll(async () => {
  const api = await listen((_req, res) => res.writeHead(apiStatus).end('{}'));
  const web = await listen((_req, res) => res.writeHead(webStatus).end('ok'));
  const hook = await listen((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      webhookBodies.push(JSON.parse(body));
      res.writeHead(webhookStatus).end();
    });
  });
  servers = [api.server, web.server, hook.server];
  ports = { api: api.port, web: web.port, hook: hook.port };
});

afterAll(() => servers.forEach((s) => s.close()));

beforeEach(() => {
  apiStatus = 200;
  webStatus = 200;
  webhookStatus = 200;
  webhookBodies = [];
  if (stateDir) rmSync(stateDir, { recursive: true, force: true });
  stateDir = mkdtempSync(join(tmpdir(), 'tostao-hc-'));
  envFile = join(stateDir, 'api.env');
  // A URL do webhook vem do .env (entre aspas, como no apps/api/.env), não do ambiente.
  writeFileSync(envFile, `OTHER=1\nALERT_WEBHOOK_URL="http://127.0.0.1:${ports.hook}/alerta"\n`);
});

const check = () =>
  run('bash', [SCRIPT], {
    env: {
      PATH: process.env.PATH,
      HOME: stateDir,
      API_URL: `http://127.0.0.1:${ports.api}/health`,
      WEB_URL: `http://127.0.0.1:${ports.web}/entrar`,
      ENV_FILE: envFile,
      STATE_DIR: join(stateDir, 'state'),
    },
  });

describe('healthcheck.sh', () => {
  it('tudo ok: em silêncio, sem alerta', async () => {
    const { stdout } = await check();
    expect(stdout).toBe('');
    expect(webhookBodies).toHaveLength(0);
  });

  it('uma falha só não alerta; a segunda seguida alerta; as seguintes não repetem', async () => {
    apiStatus = 503;
    await check();
    expect(webhookBodies).toHaveLength(0);
    await check();
    expect(webhookBodies).toHaveLength(1);
    expect(webhookBodies[0]).toMatchObject({ status: 'down', failed: ['api'], failures: 2 });
    await check();
    await check();
    expect(webhookBodies).toHaveLength(1);
  });

  it('falha intercalada com sucesso zera a contagem (só vale falha SEGUIDA)', async () => {
    apiStatus = 503;
    await check();
    apiStatus = 200;
    await check();
    apiStatus = 503;
    await check();
    expect(webhookBodies).toHaveLength(0);
  });

  it('quando volta avisa uma vez só e depois fica quieto', async () => {
    apiStatus = 503;
    await check();
    await check();
    apiStatus = 200;
    await check();
    expect(webhookBodies.map((b) => b.status)).toEqual(['down', 'up']);
    await check();
    expect(webhookBodies).toHaveLength(2);
    // e uma queda nova depois da recuperação volta a alertar
    apiStatus = 503;
    await check();
    await check();
    expect(webhookBodies.map((b) => b.status)).toEqual(['down', 'up', 'down']);
  });

  it('a página /entrar da web também conta, e o alerta nomeia quem caiu', async () => {
    webStatus = 500;
    await check();
    await check();
    expect(webhookBodies).toHaveLength(1);
    expect(webhookBodies[0]).toMatchObject({ status: 'down', failed: ['web'] });
  });

  it('webhook fora do ar: não marca como avisado e tenta de novo na próxima rodada', async () => {
    apiStatus = 503;
    webhookStatus = 500;
    await check();
    await check();
    await check();
    expect(webhookBodies).toHaveLength(2); // 2ª e 3ª rodadas tentaram
    webhookStatus = 200;
    await check();
    expect(webhookBodies).toHaveLength(3);
    await check();
    expect(webhookBodies).toHaveLength(3); // entregue: para de repetir
  });

  it('não escreve a URL do webhook no log nem no estado', async () => {
    apiStatus = 503;
    await check();
    const { stdout } = await check();
    expect(stdout).not.toContain('/alerta');
    expect(readFileSync(join(stateDir, 'state', 'healthcheck.state'), 'utf8')).toBe('fails=2\nalerted=1\n');
  });
});
