// T6.8: as recusas do `pnpm shots` (scripts/shots.mjs). Ele sobe servidores e escreve em banco, então não pode encostar
// na produção: nem nas portas, nem na pasta de build, nem no Redis. Aqui roda o script de verdade em modo `--check`.
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../../scripts/shots.mjs', import.meta.url));
const OK = {
  SHOTS_DATABASE_URL: 'postgresql://tostao:tostao@127.0.0.1:55432/tostao_shots',
  SHOTS_REDIS_URL: 'redis://127.0.0.1:56379/1',
};

const run = (env: Record<string, string>, args = ['--check']) =>
  new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args],
      { env: { PATH: process.env.PATH, ...env } },
      (error, stdout, stderr) => resolve({ code: (error?.code as number) ?? 0, stdout, stderr }),
    );
  });

describe('pnpm shots --check', () => {
  it('aceita a pilha descartável com os padrões 4333/4100 e .next.shots', async () => {
    const result = await run(OK);
    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('API :4333, web :4100 (build, .next.shots)');
  });

  it('não usa o DATABASE_URL nem o REDIS_URL do ambiente (o .env da produção define esses)', async () => {
    const result = await run({ DATABASE_URL: OK.SHOTS_DATABASE_URL, REDIS_URL: OK.SHOTS_REDIS_URL });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Defina SHOTS_DATABASE_URL');
  });

  it.each([
    ['NODE_ENV=production', { NODE_ENV: 'production' }, 'NODE_ENV=production'],
    ['a porta da API de produção', { SHOTS_API_PORT: '3333' }, 'porta da produção'],
    ['a porta da web de produção', { SHOTS_WEB_PORT: '3000' }, 'porta da produção'],
    ['a mesma porta nos dois', { SHOTS_WEB_PORT: '4333' }, 'precisam ser diferentes'],
    ['a pasta de build da produção', { SHOTS_DIST_DIR: '.next' }, 'recusado'],
    ['a pasta temporária do deploy', { SHOTS_DIST_DIR: '.next.new' }, 'recusado'],
    ['a pasta de volta do deploy', { SHOTS_DIST_DIR: '.next.prev' }, 'recusado'],
    ['caminho que sai da web', { SHOTS_DIST_DIR: '../.next' }, 'recusado'],
    ['o Redis da produção', { SHOTS_REDIS_URL: 'redis://127.0.0.1:6379/1' }, 'Redis da produção'],
    ['Redis sem porta (6379)', { SHOTS_REDIS_URL: 'redis://localhost/1' }, 'Redis da produção'],
    ['banco remoto', { SHOTS_DATABASE_URL: 'postgresql://u:p@db.exemplo.com/tostao_shots' }, 'só serviço local'],
    ['Redis remoto', { SHOTS_REDIS_URL: 'redis://cache.exemplo.com:6380' }, 'só serviço local'],
    ['modo de web inventado', { SHOTS_WEB_MODE: 'prod' }, 'SHOTS_WEB_MODE aceita'],
  ])('recusa %s', async (_caso, env, message) => {
    const result = await run({ ...OK, ...env });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(message);
  });

  it('recusa opção desconhecida', async () => {
    const result = await run(OK, ['--producao']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Opção desconhecida');
  });
});
