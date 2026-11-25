// Configuração do `pnpm shots`, com as recusas que protegem a produção. Pura: recebe o ambiente, devolve o plano.

/** Portas da produção neste projeto (API, web e a ponte do n8n): o `pnpm shots` nunca sobe nada nelas. */
const PRODUCTION_PORTS = new Set([3000, 3333, 3334]);
/** Pastas de build que a produção usa (ver scripts/deploy.sh). */
const PRODUCTION_DIST_DIRS = new Set(['.next', '.next.new', '.next.prev']);
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export class ShotsConfigError extends Error {}

const fail = (message) => {
  throw new ShotsConfigError(message);
};

function localUrl(name, raw, protocols, example) {
  if (!raw) fail(`Defina ${name} (ex.: ${example}).`);
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`${name} não é uma URL válida (ex.: ${example}).`);
  }
  if (!protocols.includes(url.protocol)) fail(`${name} precisa começar com ${protocols.join(' ou ')}//.`);
  if (!LOOPBACK.has(url.hostname)) fail(`${name}: só serviço local (recebi o host "${url.hostname}").`);
  return url;
}

function port(env, name, fallback) {
  const value = Number(env[name] || fallback);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) fail(`${name} precisa ser uma porta de 1024 a 65535.`);
  if (PRODUCTION_PORTS.has(value)) fail(`${name}=${value} é porta da produção. Use outra (padrão: ${fallback}).`);
  return value;
}

function oneOf(env, name, options) {
  const value = env[name] || options[0];
  if (!options.includes(value)) fail(`${name} aceita: ${options.join(', ')}.`);
  return value;
}

export function readConfig(env) {
  if (env.NODE_ENV === 'production') fail('pnpm shots não roda com NODE_ENV=production.');

  const databaseUrl = env.SHOTS_DATABASE_URL;
  // O nome do banco, o host e as contas que já existem são conferidos pelo seed de demonstração (apps/api/src/demo).
  localUrl(
    'SHOTS_DATABASE_URL',
    databaseUrl,
    ['postgresql:', 'postgres:'],
    'postgresql://tostao:tostao@127.0.0.1:5432/tostao_shots',
  );

  const redisUrl = env.SHOTS_REDIS_URL;
  const redis = localUrl('SHOTS_REDIS_URL', redisUrl, ['redis:'], 'redis://127.0.0.1:6379/9');
  if ((redis.port || '6379') === '6379' && env.SHOTS_ALLOW_REDIS_6379 !== '1') {
    fail(
      'SHOTS_REDIS_URL está na porta 6379, que no servidor é o Redis da produção. Use um Redis de teste ou, na sua ' +
        'máquina de desenvolvimento, confirme com SHOTS_ALLOW_REDIS_6379=1 (e um número de banco só pros prints).',
    );
  }

  const apiPort = port(env, 'SHOTS_API_PORT', 4333);
  const webPort = port(env, 'SHOTS_WEB_PORT', 4100);
  if (apiPort === webPort) fail('SHOTS_API_PORT e SHOTS_WEB_PORT precisam ser diferentes.');

  const distDir = env.SHOTS_DIST_DIR || '.next.shots';
  if (!/^\.next\.[a-z0-9_-]+$/i.test(distDir) || PRODUCTION_DIST_DIRS.has(distDir)) {
    fail(`SHOTS_DIST_DIR="${distDir}" recusado: use ".next.<nome>" (nunca a pasta de build da produção).`);
  }

  return {
    databaseUrl,
    redisUrl,
    apiPort,
    webPort,
    distDir,
    outDir: env.SHOTS_DIR || 'shots',
    webMode: oneOf(env, 'SHOTS_WEB_MODE', ['build', 'dev']),
    skipBuild: env.SHOTS_SKIP_BUILD === '1',
    runner: oneOf(env, 'SHOTS_RUNNER', ['auto', 'local', 'docker']),
    dockerImage: env.SHOTS_DOCKER_IMAGE || null,
    only: env.SHOTS_ONLY || '',
  };
}
