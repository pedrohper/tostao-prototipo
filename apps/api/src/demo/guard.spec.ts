// As travas do usuário de demonstração: ele nunca pode nascer num banco de verdade.
import { execFile } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_EMAILS } from './data.js';
import { DEMO_FLAG, DemoGuardError, assertDemoTarget, assertOnlyTestAccounts, isTestEmail } from './guard.js';

const ok = {
  nodeEnv: 'development',
  argv: [DEMO_FLAG],
  databaseUrl: 'postgresql://tostao:segredo@127.0.0.1:55432/tostao_a_shots?schema=public',
};
const apiDir = fileURLToPath(new URL('../../', import.meta.url));
const read = (path: string) => readFileSync(join(apiDir, path), 'utf8');

describe('assertDemoTarget', () => {
  it('aceita banco local com cara de teste, com a flag', () => {
    expect(assertDemoTarget(ok)).toEqual({ host: '127.0.0.1', port: '55432', database: 'tostao_a_shots' });
    for (const name of ['tostao_demo', 'tostao-test', 'teste', 'demo_tostao']) {
      expect(assertDemoTarget({ ...ok, databaseUrl: `postgres://u:p@localhost/${name}` }).database).toBe(name);
    }
  });

  it.each([['production'], [''], [undefined], ['staging'], ['PRODUCTION']])('recusa NODE_ENV=%s', (nodeEnv) => {
    expect(() => assertDemoTarget({ ...ok, nodeEnv })).toThrow(DemoGuardError);
  });

  it('recusa sem a flag explícita', () => {
    expect(() => assertDemoTarget({ ...ok, argv: [] })).toThrow(/flag/);
    expect(() => assertDemoTarget({ ...ok, argv: ['--yes'] })).toThrow(/flag/);
  });

  it.each([
    ['sem URL', undefined],
    ['URL torta', 'nao-e-url'],
    ['outro banco de dados', 'mysql://u:p@localhost/tostao_demo'],
    ['o banco de produção', 'postgresql://u:p@localhost:5432/tostao'],
    ['nome que só contém o pedaço no meio de outra palavra', 'postgresql://u:p@localhost/contest'],
    ['demonstrativo não é demo', 'postgresql://u:p@localhost/demonstrativo'],
    ['servidor remoto', 'postgresql://u:p@db.exemplo.com/tostao_demo'],
    ['rede local', 'postgresql://u:p@192.168.0.10/tostao_demo'],
    ['host escondido no parâmetro', 'postgresql://u:p@localhost/tostao_demo?host=db.exemplo.com'],
  ])('recusa %s', (_caso, databaseUrl) => {
    expect(() => assertDemoTarget({ ...ok, databaseUrl })).toThrow(DemoGuardError);
  });

  it('a mensagem de erro nunca repete a senha do banco', () => {
    try {
      assertDemoTarget({ ...ok, databaseUrl: 'postgresql://tostao:segredo-do-banco@localhost/tostao' });
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).not.toContain('segredo-do-banco');
    }
  });
});

describe('contas de teste', () => {
  it('todas as contas da demonstração usam domínio reservado', () => {
    expect(DEMO_EMAILS.length).toBeGreaterThan(1);
    for (const email of DEMO_EMAILS) expect(isTestEmail(email)).toBe(true);
  });

  it.each(['pessoa@gmail.com', 'alguem@tostao.com.br', 'x@test.com', 'x@example.com.br'])(
    '%s não é conta de teste',
    (email) => expect(isTestEmail(email)).toBe(false),
  );

  it('banco com uma conta de verdade é recusado, sem vazar o e-mail', () => {
    expect(() => assertOnlyTestAccounts(['a@tostao.test', 'b@example.com'])).not.toThrow();
    expect(() => assertOnlyTestAccounts(['a@tostao.test', 'pessoa@gmail.com'])).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('pessoa@gmail.com') }),
    );
  });
});

describe('o usuário de demonstração fica fora do caminho de produção', () => {
  it('db:seed não conhece a demonstração', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['db:seed']).toBe('tsx --env-file=.env prisma/seed.ts');
    expect(Object.values(pkg.scripts).join('\n')).not.toContain('seed-demo');
    expect(read('prisma/seed.ts')).not.toMatch(/demo/i);
    expect(read('prisma.config.ts')).not.toMatch(/demo/i);
  });

  it('nada fora de src/demo importa a demonstração', () => {
    const files = readdirSync(join(apiDir, 'src'), { recursive: true, encoding: 'utf8' }).filter(
      (f) => f.endsWith('.ts') && !f.startsWith('demo') && !f.endsWith('.spec.ts'),
    );
    expect(files.length).toBeGreaterThan(50);
    const importers = files.filter((f) => /from '[./]*(\/)?demo\//.test(read(join('src', f))));
    expect(importers).toEqual([]);
  });

  it('o script de verdade sai com erro em produção, antes de abrir o banco', async () => {
    const result = await new Promise<{ code: number; stderr: string }>((resolve) => {
      execFile(
        join(apiDir, 'node_modules/.bin/tsx'),
        ['src/demo/seed-demo.ts', DEMO_FLAG],
        {
          cwd: apiDir,
          // Porta 9 (discard): se a trava falhasse, a conexão quebraria com outra mensagem.
          env: {
            PATH: process.env.PATH,
            NODE_ENV: 'production',
            DEMO_DATABASE_URL: 'postgresql://u:p@127.0.0.1:9/tostao_demo',
          },
        },
        (error, _stdout, stderr) => resolve({ code: (error?.code as number) ?? 0, stderr }),
      );
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('NODE_ENV="production"');
  });
});
