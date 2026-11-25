#!/usr/bin/env node
// pnpm shots: sobe API e web numa pilha descartável, cria o usuário de demonstração (dados fictícios) e salva os prints
// das telas em 390×844 e 1440×900, claro e escuro. Derruba tudo no fim. Como usar e variáveis: README, "Prints".
//
//   SHOTS_DATABASE_URL=… SHOTS_REDIS_URL=… pnpm shots            tira os prints
//   … pnpm shots --check                                          só confere a configuração
//   … pnpm shots --serve                                          deixa a pilha no ar (Ctrl+C derruba)
/* global fetch, setTimeout, setInterval, clearInterval, AbortSignal */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { constants, setPriority, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ShotsConfigError, readConfig } from './shots/config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'apps/api');
const webDir = join(root, 'apps/web');
const DEMO_EMAIL = 'demo@tostao.test';
const DEMO_FLAG = '--confirmo-banco-de-demo';

const children = new Set();
const cleanups = [];
let containerName = null;

/** Só o básico do ambiente de quem rodou: nenhum segredo (chave de IA, Pluggy, e-mail) vaza pros processos daqui. */
function baseEnv() {
  const keep = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'DOCKER_HOST', 'PLAYWRIGHT_BROWSERS_PATH'];
  return Object.fromEntries(keep.filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
}

/** Variáveis da API. Tudo que fala com serviço externo vai explicitamente vazio ou "fake". */
function apiEnv(config, jwtSecret) {
  const off = [
    'DEEPSEEK_API_KEY',
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'PLUGGY_CLIENT_ID',
    'PLUGGY_CLIENT_SECRET',
    'PLUGGY_INCLUDE_SANDBOX',
    'WHATSAPP_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_APP_SECRET',
    'WHATSAPP_VERIFY_TOKEN',
    'WHATSAPP_NUMBER',
    'N8N_WHATSAPP_SECRET',
    'N8N_WHATSAPP_SEND_URL',
    'N8N_LISTEN_HOST',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT',
    'WHISPER_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'APPLE_CLIENT_ID',
    'APPLE_TEAM_ID',
    'APPLE_KEY_ID',
    'APPLE_PRIVATE_KEY',
  ];
  return {
    ...baseEnv(),
    ...Object.fromEntries(off.map((k) => [k, ''])),
    NODE_ENV: 'development',
    DATABASE_URL: config.databaseUrl,
    REDIS_URL: config.redisUrl,
    JWT_SECRET: jwtSecret,
    HOST: '127.0.0.1',
    PORT: String(config.apiPort),
    WEB_ORIGIN: `http://localhost:${config.webPort}`,
    BANK_GATEWAY: 'fake',
    EMAIL_PROVIDER: 'fake',
    // Uma vez por ano: nenhum sync nem lançamento automático mexe nos dados no meio das capturas.
    SYNC_CRON: '0 0 1 1 *',
    RECURRING_CRON: '0 0 1 1 *',
  };
}

function webEnv(config) {
  return {
    ...baseEnv(),
    API_URL: `http://127.0.0.1:${config.apiPort}`,
    APP_PUBLIC_URL: '',
    OAUTH_COOKIE_SECRET: '',
    NEXT_DIST_DIR: config.distDir,
    NEXT_TELEMETRY_DISABLED: '1',
  };
}

/** Roda um passo até o fim, com a saída na tela. Falhou, para tudo. */
function step(title, command, args, options) {
  console.log(`\n▶ ${title}`);
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`"${title}" falhou (código ${result.status ?? result.signal})`);
}

/** Sobe um servidor em segundo plano, no próprio grupo de processos (pra derrubar a árvore inteira). */
function serve(name, command, args, options, logDir) {
  const logFile = join(logDir, `${name}.log`);
  const fd = openSync(logFile, 'w');
  const child = spawn(command, args, { ...options, detached: true, stdio: ['ignore', fd, fd] });
  closeSync(fd);
  const entry = { name, child, logFile, exited: false };
  child.once('exit', () => (entry.exited = true));
  children.add(entry);
  return entry;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitForUrl(entry, url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (entry.exited) break;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'manual' });
      if (res.ok) return;
    } catch {
      // ainda subindo
    }
    await sleep(500);
  }
  const tail = readFileSync(entry.logFile, 'utf8').split('\n').slice(-30).join('\n');
  throw new Error(`${entry.name} não respondeu em ${url}. Fim do log (${entry.logFile}):\n${tail}`);
}

const portIsFree = (port) =>
  new Promise((done) => {
    const server = createServer();
    server.once('error', () => done(false));
    server.listen(port, '127.0.0.1', () => server.close(() => done(true)));
  });

/** Onde o Chromium vai rodar: na máquina, se ele abrir aqui; senão na imagem oficial do Playwright (mesma versão). */
function chooseRunner(config) {
  const require = createRequire(import.meta.url);
  const { version } = require('playwright/package.json');
  const image = config.dockerImage ?? `mcr.microsoft.com/playwright:v${version}-noble`;
  if (config.runner !== 'docker') {
    const probe = spawnSync(process.execPath, [join(root, 'scripts/shots/capture.mjs'), '--probe'], {
      env: baseEnv(),
      encoding: 'utf8',
      timeout: 60_000,
    });
    if (probe.status === 0) return { kind: 'local' };
    if (config.runner === 'local') {
      throw new Error(
        `O Chromium não abriu nesta máquina:\n${probe.stderr}\nRode "pnpm exec playwright install chromium" e, uma vez, ` +
          '"sudo npx playwright install-deps chromium". Ou use SHOTS_RUNNER=docker.',
      );
    }
    console.log('ℹ️  Chromium não abre direto nesta máquina: usando a imagem Docker do Playwright.');
  }
  if (spawnSync('docker', ['image', 'inspect', image], { stdio: 'ignore' }).status !== 0) {
    step(`Baixando ${image} (só na primeira vez)`, 'docker', ['pull', image]);
  }
  return { kind: 'docker', image };
}

function runCapture(runner, config, outDir, password) {
  const env = {
    SHOTS_BASE_URL: `http://localhost:${config.webPort}`,
    SHOTS_DEMO_EMAIL: DEMO_EMAIL,
    SHOTS_DEMO_PASSWORD: password,
    SHOTS_ONLY: config.only,
  };
  let command = process.execPath;
  let args = [join(root, 'scripts/shots/capture.mjs')];
  const childEnv = { ...baseEnv(), ...env, SHOTS_OUT: outDir };
  if (runner.kind === 'docker') {
    containerName = `tostao-shots-${process.pid}`;
    const user = process.getuid ? ['--user', `${process.getuid()}:${process.getgid()}`] : [];
    command = 'docker';
    // Só entram as dependências e o script (somente leitura) e a pasta de saída: nenhum .env nem o resto do repo.
    args = [
      ...['run', '--rm', '--init', '--name', containerName, '--network', 'host'],
      ...['--shm-size=1g', '--memory=2g', '--cpus=2', '--cpu-shares=512', ...user],
      ...['-v', `${join(root, 'node_modules')}:/work/node_modules:ro`],
      ...['-v', `${join(root, 'scripts/shots')}:/work/scripts/shots:ro`],
      ...['-v', `${outDir}:/saida`, '-w', '/work', '-e', 'HOME=/tmp', '-e', 'SHOTS_OUT=/saida'],
      // "-e NOME" sem valor: o Docker lê do ambiente, e a senha não aparece na lista de processos.
      ...Object.keys(env).flatMap((name) => ['-e', name]),
      ...[runner.image, 'node', 'scripts/shots/capture.mjs'],
    ];
  }
  return new Promise((done, reject) => {
    const child = spawn(command, args, { env: childEnv, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => done(code ?? 1));
  });
}

/**
 * Os prints fazem centenas de pedidos por minuto com um usuário só, acima do limite de 120/min da API. Em vez de abrir
 * uma exceção no código da API, apaga os contadores no Redis DE TESTE enquanto a captura roda.
 */
async function keepRateLimitsClear(redisUrl) {
  const require = createRequire(join(apiDir, 'package.json'));
  const { Redis } = require('ioredis');
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  const clear = async (pattern) => {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  };
  await clear('tostao:rl:*');
  const timer = setInterval(() => void clear('tostao:rl:*global:*').catch(() => {}), 1000);
  cleanups.push(async () => {
    clearInterval(timer);
    await redis.quit().catch(() => {});
  });
}

/** O `next build` reescreve tsconfig.json e next-env.d.ts apontando pra pasta de build: guarda e devolve como estavam. */
function preserveFiles(paths) {
  const saved = paths.map((path) => [path, existsSync(path) ? readFileSync(path, 'utf8') : null]);
  const restore = () => {
    for (const [path, content] of saved) {
      if (!existsSync(path)) continue;
      if (content === null) rmSync(path);
      else if (readFileSync(path, 'utf8') !== content) writeFileSync(path, content);
    }
  };
  cleanups.push(async () => restore());
  return restore;
}

let tearingDown = null;
function teardown() {
  tearingDown ??= (async () => {
    if (containerName) spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' });
    const signal = (entry, name) => {
      try {
        process.kill(-entry.child.pid, name);
      } catch {
        // já saiu
      }
    };
    for (const entry of children) signal(entry, 'SIGTERM');
    const deadline = Date.now() + 10_000;
    while ([...children].some((c) => !c.exited) && Date.now() < deadline) await sleep(100);
    for (const entry of children) signal(entry, 'SIGKILL');
    for (const cleanup of cleanups.reverse()) await cleanup();
  })();
  return tearingDown;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const unknown = args.filter((a) => a !== '--check' && a !== '--serve');
  if (unknown.length)
    throw new ShotsConfigError(`Opção desconhecida: ${unknown.join(' ')} (aceito --check e --serve).`);
  const config = readConfig(process.env);
  const outDir = resolve(root, config.outDir);

  if (args.includes('--check')) {
    console.log(
      `Configuração ok: API :${config.apiPort}, web :${config.webPort} (${config.webMode}, ${config.distDir}), prints em ${outDir}.`,
    );
    return 0;
  }

  // Devagar de propósito (herdado pelos filhos): o servidor divide memória e CPU com a produção.
  try {
    setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
  } catch {
    // sem permissão pra mudar prioridade: segue normal
  }

  for (const port of [config.apiPort, config.webPort]) {
    if (!(await portIsFree(port))) throw new ShotsConfigError(`A porta ${port} já está em uso.`);
  }
  const serveOnly = args.includes('--serve');
  const runner = serveOnly ? null : chooseRunner(config);
  const password = randomBytes(18).toString('base64url');
  const logDir = mkdtempSync(join(tmpdir(), 'tostao-shots-'));
  mkdirSync(outDir, { recursive: true });

  // Banco: primeiro as travas (nada é escrito num banco que não seja de teste), depois migrations e seeds.
  const tsx = join(apiDir, 'node_modules/.bin/tsx');
  const dbEnv = {
    ...baseEnv(),
    NODE_ENV: 'development',
    DATABASE_URL: config.databaseUrl,
    DEMO_DATABASE_URL: config.databaseUrl,
    DEMO_PASSWORD: password,
  };
  const inApi = { cwd: apiDir, env: dbEnv };
  const demoSeed = ['src/demo/seed-demo.ts', DEMO_FLAG];
  step('Conferindo que o banco é de teste', tsx, [...demoSeed, '--apenas-conferir'], inApi);
  step('Aplicando as migrations', join(apiDir, 'node_modules/.bin/prisma'), ['migrate', 'deploy'], inApi);
  step('Categorias e regras padrão', tsx, ['prisma/seed.ts'], inApi);
  step('Usuário de demonstração', tsx, demoSeed, inApi);

  const next = join(webDir, 'node_modules/.bin/next');
  const web = { cwd: webDir, env: webEnv(config) };
  const restore = preserveFiles([join(webDir, 'tsconfig.json'), join(webDir, 'next-env.d.ts')]);
  if (config.webMode === 'build' && !(config.skipBuild && existsSync(join(webDir, config.distDir, 'BUILD_ID')))) {
    step(`Compilando a web em ${config.distDir} (leva alguns minutos)`, next, ['build'], web);
    restore();
  }

  console.log('\n▶ Subindo a API e a web');
  const apiServer = serve(
    'api',
    tsx,
    ['src/server.ts'],
    { cwd: apiDir, env: apiEnv(config, randomBytes(32).toString('hex')) },
    logDir,
  );
  await waitForUrl(apiServer, `http://127.0.0.1:${config.apiPort}/health`);
  const mode = config.webMode === 'build' ? 'start' : 'dev';
  const webServer = serve('web', next, [mode, '-p', String(config.webPort), '-H', '127.0.0.1'], web, logDir);
  await waitForUrl(webServer, `http://127.0.0.1:${config.webPort}/entrar`);
  await keepRateLimitsClear(config.redisUrl);

  if (serveOnly) {
    console.log(`\n✅ No ar: http://localhost:${config.webPort}  ·  ${DEMO_EMAIL}  ·  senha ${password}`);
    console.log(`   Logs em ${logDir}. Ctrl+C derruba tudo.`);
    await Promise.race([apiServer, webServer].map((s) => new Promise((done) => s.child.once('exit', done))));
    return 1;
  }

  console.log(`\n▶ Tirando os prints (${runner.kind === 'docker' ? runner.image : 'Chromium local'})`);
  const code = await runCapture(runner, config, outDir, password);
  containerName = null;
  console.log(`Logs da API e da web em ${logDir}.`);
  return code;
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.once(signal, () => void teardown().then(() => process.exit(130)));
}

try {
  process.exitCode = await main();
} catch (err) {
  console.error(`❌ ${err instanceof ShotsConfigError ? err.message : (err.stack ?? err.message)}`);
  process.exitCode = 1;
} finally {
  await teardown();
}
