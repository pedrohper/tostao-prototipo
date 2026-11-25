// T6.6: scripts/deploy.sh. Testa ordem do --dry-run, bloqueio de branch/tree sujo, build isolado com troca atômica e rollback.
import { execFile } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const REAL_SCRIPT = fileURLToPath(new URL('../../../scripts/deploy.sh', import.meta.url));

let apiStatus = 200;
let webStatus = 200;
let servers: Server[] = [];
let ports = { api: 0, web: 0 };
let sandbox = '';

function listen(handler: Parameters<typeof createServer>[1]) {
  return new Promise<{ server: Server; port: number }>((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: typeof addr === 'object' && addr ? addr.port : 0 });
    });
  });
}

function makeSandbox({ branch = 'main', dirty = '' }: { branch?: string; dirty?: string } = {}) {
  sandbox = mkdtempSync(join(tmpdir(), 'tostao-deploy-'));
  const binDir = join(sandbox, 'bin');
  const scriptsDir = join(sandbox, 'scripts');
  const webDir = join(sandbox, 'apps', 'web');
  const logFile = join(sandbox, 'calls.log');

  mkdirSync(binDir, { recursive: true });
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(join(webDir, '.next'), { recursive: true });
  writeFileSync(join(webDir, '.next', 'BUILD_ID'), 'old-build-id');

  const deployCopy = join(scriptsDir, 'deploy.sh');
  writeFileSync(deployCopy, readFileSync(REAL_SCRIPT, 'utf8'));
  chmodSync(deployCopy, 0o755);

  writeFileSync(join(scriptsDir, 'backup-db.sh'), `#!/usr/bin/env bash\necho "backup-db" >> "${logFile}"\n`);

  const writeBin = (name: string, body: string) => {
    const p = join(binDir, name);
    writeFileSync(p, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
    chmodSync(p, 0o755);
  };

  writeBin(
    'git',
    `case "\${1:-}" in
  rev-parse) echo "${branch}" ;;
  status) printf '%s' "${dirty}" ;;
  pull) echo "git $*" >> "${logFile}" ;;
  *) echo "git $*" >> "${logFile}" ;;
esac`,
  );

  writeBin(
    'pnpm',
    `echo "pnpm $* DIST=\${NEXT_DIST_DIR:-}" >> "${logFile}"
if [ "\${1:-}" = "build" ]; then
  dir="${webDir}/\${NEXT_DIST_DIR:-.next}"
  mkdir -p "$dir"
  echo "new-build-id" > "$dir/BUILD_ID"
fi`,
  );

  writeBin('pm2', `echo "pm2 $*" >> "${logFile}"`);

  return { binDir, deployCopy, webDir, logFile };
}

beforeAll(async () => {
  const api = await listen((_req, res) => res.writeHead(apiStatus).end('{"ok":true}'));
  const web = await listen((_req, res) => res.writeHead(webStatus).end('ok'));
  servers = [api.server, web.server];
  ports = { api: api.port, web: web.port };
});

afterAll(() => servers.forEach((s) => s.close()));

afterEach(() => {
  if (sandbox) {
    rmSync(sandbox, { recursive: true, force: true });
    sandbox = '';
  }
  apiStatus = 200;
  webStatus = 200;
});

describe('scripts/deploy.sh (T6.6)', () => {
  it('passa na verificação de sintaxe (bash -n)', async () => {
    await expect(run('bash', ['-n', REAL_SCRIPT])).resolves.toBeDefined();
  });

  it('--dry-run imprime os passos na ordem certa e omite seed sem --seed', async () => {
    const { stdout } = await run('bash', [REAL_SCRIPT, '--dry-run']);
    const expected = [
      'Conferir working tree limpo e branch main',
      'Atualizar main (git pull --ff-only)',
      'Fazer backup do banco (scripts/backup-db.sh)',
      'Instalar dependências (pnpm install --frozen-lockfile)',
      'Aplicar migrations (pnpm db:deploy)',
      'Build da web em pasta separada (NEXT_DIST_DIR=.next.new)',
      'Troca atômica de .next (guardando anterior em .next.prev)',
      'Reiniciar tostao-api e tostao-web juntos',
      'Esperar /health responder 200 (rollback se falhar)',
    ];
    let pos = -1;
    for (const marker of expected) {
      const next = stdout.indexOf(marker);
      expect(next, marker).toBeGreaterThan(pos);
      pos = next;
    }
    expect(stdout).not.toContain('pnpm db:seed');
  });

  it('--dry-run --seed inclui pnpm db:seed entre db:deploy e o build', async () => {
    const { stdout } = await run('bash', [REAL_SCRIPT, '--dry-run', '--seed']);
    const deployIdx = stdout.indexOf('pnpm db:deploy');
    const seedIdx = stdout.indexOf('pnpm db:seed');
    const buildIdx = stdout.indexOf('NEXT_DIST_DIR=.next.new');
    expect(seedIdx).toBeGreaterThan(deployIdx);
    expect(buildIdx).toBeGreaterThan(seedIdx);
  });

  it('recusa branch diferente de main e recusa working tree sujo', async () => {
    const s1 = makeSandbox({ branch: 'feat/outra' });
    await expect(run('bash', [s1.deployCopy], { env: { PATH: `${s1.binDir}:${process.env.PATH}` } })).rejects.toThrow();

    rmSync(sandbox, { recursive: true, force: true });
    const s2 = makeSandbox({ branch: 'main', dirty: ' M README.md' });
    await expect(run('bash', [s2.deployCopy], { env: { PATH: `${s2.binDir}:${process.env.PATH}` } })).rejects.toThrow();
  });

  it('fluxo feliz: builda em .next.new, guarda .next.prev, ativa .next, reinicia juntos e valida /health', async () => {
    const { binDir, deployCopy, webDir, logFile } = makeSandbox();
    await run('bash', [deployCopy], {
      env: {
        PATH: `${binDir}:${process.env.PATH}`,
        DEPLOY_HEALTH_URL: `http://127.0.0.1:${ports.api}/health`,
        DEPLOY_WEB_URL: `http://127.0.0.1:${ports.web}/entrar`,
        DEPLOY_HEALTH_ATTEMPTS: '2',
        DEPLOY_HEALTH_SLEEP: '0',
      },
    });

    expect(readFileSync(join(webDir, '.next', 'BUILD_ID'), 'utf8').trim()).toBe('new-build-id');
    expect(readFileSync(join(webDir, '.next.prev', 'BUILD_ID'), 'utf8').trim()).toBe('old-build-id');
    expect(existsSync(join(webDir, '.next.new'))).toBe(false);

    const calls = readFileSync(logFile, 'utf8').trim().split('\n');
    expect(calls).toEqual([
      'git pull --ff-only',
      'backup-db',
      'pnpm install --frozen-lockfile DIST=',
      'pnpm db:deploy DIST=',
      'pnpm build DIST=.next.new',
      'pm2 restart tostao-api tostao-web',
    ]);
  });

  it('se /health falhar, faz rollback de .next.prev para .next, reinicia e sai com erro', async () => {
    apiStatus = 503;
    const { binDir, deployCopy, webDir, logFile } = makeSandbox();
    await expect(
      run('bash', [deployCopy], {
        env: {
          PATH: `${binDir}:${process.env.PATH}`,
          DEPLOY_HEALTH_URL: `http://127.0.0.1:${ports.api}/health`,
          DEPLOY_WEB_URL: `http://127.0.0.1:${ports.web}/entrar`,
          DEPLOY_HEALTH_ATTEMPTS: '2',
          DEPLOY_HEALTH_SLEEP: '0',
        },
      }),
    ).rejects.toThrow();

    expect(readFileSync(join(webDir, '.next', 'BUILD_ID'), 'utf8').trim()).toBe('old-build-id');
    expect(readFileSync(join(webDir, '.next.failed', 'BUILD_ID'), 'utf8').trim()).toBe('new-build-id');

    const calls = readFileSync(logFile, 'utf8').trim().split('\n');
    expect(calls.filter((l) => l === 'pm2 restart tostao-api tostao-web')).toHaveLength(2);
  });
});
