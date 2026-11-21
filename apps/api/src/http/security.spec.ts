// T1.3: cabeçalhos de segurança (Helmet), cache, CORS, limites de requisição (429), erros nativos do Fastify
// (400/413/415 em vez de 500) e segredos censurados no log.
import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { LOG_REDACT_PATHS, buildApp, parseOrigins } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { MemoryKeyValueStore } from '../lib/redis.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';

const SECRET = 'segredo-de-teste-com-32-caracteres!!';

async function boot(opts: Partial<Parameters<typeof buildApp>[0]> = {}) {
  const repos = makeInMemoryRepositories();
  const app = await buildApp({
    repos,
    bank: new FakeBankGateway(),
    jwtSecret: SECRET,
    webOrigin: 'https://tostao.test',
    ...opts,
  });
  return { app, repos };
}

let ipCounter = 0;
/** IP novo a cada chamada: isola o limite que estamos testando dos demais. */
const freshIp = () => `10.9.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;

async function register(app: Awaited<ReturnType<typeof boot>>['app'], email = 'p@x.com') {
  const res = await app.inject({
    method: 'POST',
    url: '/users',
    headers: { 'x-forwarded-for': freshIp() },
    payload: { name: 'Pedro', email, password: '12345678', acceptedTerms: true },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as { accessToken: string; refreshToken: string };
}
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

describe('Helmet e cabeçalhos', () => {
  it('toda resposta leva CSP fechada, nosniff, DENY, no-referrer e sem X-Powered-By', async () => {
    const { app } = await boot();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('HSTS só em produção', async () => {
    const { app } = await boot();
    expect((await app.inject({ method: 'GET', url: '/health' })).headers['strict-transport-security']).toBeUndefined();
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { app: prod } = await boot({ kv: new MemoryKeyValueStore() });
      const res = await prod.inject({ method: 'GET', url: '/health' });
      expect(res.headers['strict-transport-security']).toContain('max-age=15552000');
    } finally {
      process.env.NODE_ENV = before;
    }
  });

  it('Cache-Control: no-store, private em rota autenticada, em erro e em 401; /health fica de fora', async () => {
    const { app } = await boot();
    const { accessToken } = await register(app);
    const me = await app.inject({ method: 'GET', url: '/me', headers: bearer(accessToken) });
    expect(me.statusCode).toBe(200);
    expect(me.headers['cache-control']).toBe('no-store, private');
    expect((await app.inject({ method: 'GET', url: '/me' })).headers['cache-control']).toBe('no-store, private');
    const bad = await app.inject({ method: 'GET', url: '/transactions?month=2026-13', headers: bearer(accessToken) });
    expect(bad.statusCode).toBe(400);
    expect(bad.headers['cache-control']).toBe('no-store, private');
    expect((await app.inject({ method: 'GET', url: '/health' })).headers['cache-control']).toBeUndefined();
  });
});

describe('CORS explícito', () => {
  it('só a origem do site entra, com credentials; outra origem não recebe cabeçalho CORS', async () => {
    const { app } = await boot({ webOrigin: 'https://tostao.test,https://preview.tostao.test' });
    const ok = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://preview.tostao.test' } });
    expect(ok.headers['access-control-allow-origin']).toBe('https://preview.tostao.test');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const evil = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://evil.example' } });
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('preflight só libera os métodos e cabeçalhos combinados', async () => {
    const { app } = await boot();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/transactions',
      headers: {
        origin: 'https://tostao.test',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-methods']).toBe('GET, POST, PUT, PATCH, DELETE, OPTIONS');
    expect(res.headers['access-control-allow-headers']).toBe('authorization, content-type');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('parseOrigins: lista separada por vírgula, com espaços', () => {
    expect(parseOrigins(' https://a.com , https://b.com ,')).toEqual(['https://a.com', 'https://b.com']);
    expect(parseOrigins('*')).toEqual(['*']);
  });
});

describe('erros nativos do Fastify viram 4xx (nunca 500)', () => {
  it('JSON malformado → 400', async () => {
    const { app } = await boot();
    const res = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': freshIp() },
      payload: '{"email": "a@x.com", ',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/inválido/i);
    expect(res.body).not.toMatch(/FST_ERR|Unexpected token|SyntaxError/);
  });

  it('corpo maior que 256 KiB → 413; só POST /imports aceita até 5 MiB', async () => {
    const { app } = await boot();
    const { accessToken } = await register(app);
    const big = JSON.stringify({ description: 'x'.repeat(300 * 1024) });
    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: { ...bearer(accessToken), 'content-type': 'application/json' },
      payload: big,
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().message).toMatch(/grande demais/i);

    // /imports tem limite próprio (5 MiB): 300 KiB passa do limite de tamanho e cai na validação (400), não em 413
    const imports = await app.inject({
      method: 'POST',
      url: '/imports',
      headers: { ...bearer(accessToken), 'content-type': 'application/json' },
      payload: JSON.stringify({ accountName: 'x', fileName: 'a.csv', content: 'x'.repeat(300 * 1024) }),
    });
    expect(imports.statusCode).not.toBe(413);
    // ...mas acima de 5 MiB também barra
    const huge = await app.inject({
      method: 'POST',
      url: '/imports',
      headers: { ...bearer(accessToken), 'content-type': 'application/json' },
      payload: JSON.stringify({ content: 'x'.repeat(5.2 * 1024 * 1024) }),
    });
    expect(huge.statusCode).toBe(413);
  });

  it('tipo de conteúdo não suportado → 415', async () => {
    const { app } = await boot();
    const res = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { 'content-type': 'application/xml', 'x-forwarded-for': freshIp() },
      payload: '<email>a@x.com</email>',
    });
    expect(res.statusCode).toBe(415);
    expect(res.json().message).toMatch(/não suportado/i);
  });

  it('rota que não existe segue 404 (e continua com os cabeçalhos de segurança)', async () => {
    const { app } = await boot();
    const res = await app.inject({ method: 'GET', url: '/nao-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('limite de requisições (429)', () => {
  /** Dispara `n` pedidos e devolve os status. */
  async function hit(n: number, call: (i: number) => Promise<{ statusCode: number }>) {
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push((await call(i)).statusCode);
    return out;
  }

  it('POST /sessions: 10 por IP + e-mail (o 11º leva 429 com Retry-After), e outro e-mail do mesmo IP ainda passa', async () => {
    const { app } = await boot();
    const ip = freshIp();
    const login = (email: string) =>
      app.inject({
        method: 'POST',
        url: '/sessions',
        headers: { 'x-forwarded-for': ip },
        payload: { email, password: 'errada00' },
      });
    const statuses = await hit(11, () => login('vitima@x.com'));
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
    const blocked = await login('vitima@x.com');
    expect(blocked.headers['retry-after']).toMatch(/^\d+$/);
    expect(blocked.json().message).toMatch(/Muitas tentativas/);
    // outro e-mail, mesmo IP: o bloqueio é por IP+e-mail, não derruba o e-mail dos outros
    expect((await login('outra@x.com')).statusCode).toBe(401);
  });

  it('POST /sessions: quem tenta e-mails diferentes bate no limite de 30 por IP', async () => {
    const { app } = await boot();
    const ip = freshIp();
    const statuses = await hit(31, (i) =>
      app.inject({
        method: 'POST',
        url: '/sessions',
        headers: { 'x-forwarded-for': ip },
        payload: { email: `pessoa${i}@x.com`, password: 'errada00' },
      }),
    );
    expect(statuses.slice(0, 30).every((s) => s === 401)).toBe(true);
    expect(statuses[30]).toBe(429);
  }, 60_000);

  it('IPs diferentes têm contadores separados (um cliente não trava o outro)', async () => {
    const { app } = await boot();
    const body = { email: 'a@x.com', password: 'errada00' };
    const a = freshIp();
    await hit(11, () =>
      app.inject({ method: 'POST', url: '/sessions', headers: { 'x-forwarded-for': a }, payload: body }),
    );
    const other = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: { 'x-forwarded-for': freshIp() },
      payload: body,
    });
    expect(other.statusCode).toBe(401);
  }, 60_000);

  it('só confia em X-Forwarded-For de proxy configurado: com trustProxy=false, o cabeçalho é ignorado', async () => {
    const { app } = await boot({ trustProxy: false });
    // forjar IPs diferentes não ajuda: todo mundo é 127.0.0.1 e o limite de 10 vale
    const statuses = await hit(11, (i) =>
      app.inject({
        method: 'POST',
        url: '/sessions',
        headers: { 'x-forwarded-for': `203.0.113.${i + 1}` },
        payload: { email: 'a@x.com', password: 'errada00' },
      }),
    );
    expect(statuses[10]).toBe(429);
  }, 60_000);

  it('POST /users, /password-resets/redeem e /password-resets: 5 por IP', async () => {
    const { app } = await boot();
    for (const [url, payload] of [
      ['/users', { name: 'A', email: 'a@x.com', password: '12345678' }],
      ['/password-resets/redeem', { token: 'a'.repeat(43), password: '12345678' }],
      ['/password-resets', { email: 'a@x.com' }],
    ] as const) {
      const ip = freshIp();
      const statuses = await hit(6, () =>
        app.inject({ method: 'POST', url, headers: { 'x-forwarded-for': ip }, payload }),
      );
      expect(statuses[5], url).toBe(429);
      expect(
        statuses.slice(0, 5).every((s) => s !== 429),
        url,
      ).toBe(true);
    }
  });

  it('POST /auth/resend-verification: 5 por usuário e por IP', async () => {
    const { app } = await boot();
    const { accessToken } = await register(app);
    const statuses = await hit(6, () =>
      app.inject({
        method: 'POST',
        url: '/auth/resend-verification',
        headers: { ...bearer(accessToken), 'x-forwarded-for': freshIp() },
      }),
    );
    expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
  });

  it('por usuário: /me/delete (5), /friends (10), /imports, /connections/:id/sync e /tostao/auto/check (10) e auto-categorize (5 por dia)', async () => {
    const { app } = await boot();
    const { accessToken } = await register(app);
    const auth = { ...bearer(accessToken) };
    const run = async (n: number, req: () => Promise<{ statusCode: number }>) => hit(n, req);

    const del = await run(6, () =>
      app.inject({
        method: 'POST',
        url: '/me/delete',
        headers: { ...auth, 'x-forwarded-for': freshIp() },
        payload: { password: 'errada00' },
      }),
    );
    expect(del[4]).toBe(403);
    expect(del[5]).toBe(429);

    const friends = await run(11, () =>
      app.inject({
        method: 'POST',
        url: '/friends',
        headers: { ...auth, 'x-forwarded-for': freshIp() },
        payload: { code: 'TOST-NADA' },
      }),
    );
    expect(friends[9]).not.toBe(429);
    expect(friends[10]).toBe(429);

    const auto = await run(6, () =>
      app.inject({
        method: 'POST',
        url: '/transactions/auto-categorize',
        headers: { ...auth, 'x-forwarded-for': freshIp() },
      }),
    );
    expect(auto.slice(0, 5).every((s) => s !== 429)).toBe(true);
    expect(auto[5]).toBe(429);

    const id = '11111111-1111-4111-8111-111111111111';
    for (const [method, url] of [
      ['POST', '/imports'],
      ['POST', `/connections/${id}/sync`],
      ['POST', '/tostao/auto/check'],
    ] as const) {
      const s = await run(11, () =>
        app.inject({
          method,
          url,
          headers: { ...auth, 'x-forwarded-for': freshIp() },
          payload:
            method === 'POST' && url === '/imports'
              ? { accountName: '', fileName: 'a.csv', content: 'x'.repeat(20) }
              : undefined,
        }),
      );
      expect(s[9], url).not.toBe(429);
      expect(s[10], url).toBe(429);
    }
  });

  it('o limite por usuário não depende do IP (trocar de IP não zera)', async () => {
    const { app } = await boot();
    const { accessToken } = await register(app);
    const statuses = await hit(6, () =>
      app.inject({
        method: 'POST',
        url: '/me/delete',
        headers: { ...bearer(accessToken), 'x-forwarded-for': freshIp() },
        payload: { password: 'errada00' },
      }),
    );
    expect(statuses[5]).toBe(429);
  });

  it('POST /whatsapp/webhook: 60 por minuto por IP', async () => {
    const { app } = await boot({ whatsappVerifyToken: 'tok' });
    const ip = freshIp();
    const statuses = await hit(61, () =>
      app.inject({
        method: 'POST',
        url: '/whatsapp/webhook',
        headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' },
        payload: '{}',
      }),
    );
    expect(statuses[59]).not.toBe(429);
    expect(statuses[60]).toBe(429);
  });

  it('teto geral: 120 por minuto por usuário em qualquer rota; /health não conta', async () => {
    const { app } = await boot();
    const { accessToken } = await register(app);
    const statuses = await hit(121, () => app.inject({ method: 'GET', url: '/me', headers: bearer(accessToken) }));
    expect(statuses.slice(0, 120).every((s) => s === 200)).toBe(true);
    expect(statuses[120]).toBe(429);
    // outro usuário não é afetado
    const other = await register(app, 'outro@x.com');
    expect((await app.inject({ method: 'GET', url: '/me', headers: bearer(other.accessToken) })).statusCode).toBe(200);
    // /health nunca limita
    const health = await hit(150, () => app.inject({ method: 'GET', url: '/health' }));
    expect(health.every((s) => s === 200)).toBe(true);
  });
});

describe('segredos censurados no log', () => {
  it('Authorization, cookie, x-tostao-secret, password, token, refreshToken e apiKey saem como [redacted]', async () => {
    let out = '';
    const stream = new Writable({
      write(chunk, _enc, cb) {
        out += chunk.toString();
        cb();
      },
    });
    const { app } = await boot({ logger: true, logStream: stream });
    await app.ready();
    app.log.info({
      req: {
        headers: {
          authorization: 'Bearer TOKEN-SECRETO',
          cookie: 'tostao_token=COOKIE-SECRETO',
          'x-tostao-secret': 'SEGREDO-N8N',
        },
      },
      body: { password: 'SENHA-SECRETA', token: 'TOKEN-DE-LINK', refreshToken: 'REFRESH-SECRETO', apiKey: 'CHAVE-API' },
      visivel: 'isto aparece',
    });
    await new Promise((r) => setTimeout(r, 20));
    for (const secret of [
      'TOKEN-SECRETO',
      'COOKIE-SECRETO',
      'SEGREDO-N8N',
      'SENHA-SECRETA',
      'TOKEN-DE-LINK',
      'REFRESH-SECRETO',
      'CHAVE-API',
    ]) {
      expect(out, secret).not.toContain(secret);
    }
    expect(out).toContain('[redacted]');
    expect(out).toContain('isto aparece');
    expect(LOG_REDACT_PATHS).toContain('req.headers.authorization');
  });
});
