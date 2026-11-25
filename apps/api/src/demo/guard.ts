// Travas do seed de demonstração (`pnpm shots`). O usuário de demonstração tem dados fictícios e uma senha que o script
// conhece: ele NUNCA pode nascer num banco de verdade. Por isso o seed é um script separado do `db:seed`, lê a própria
// variável (DEMO_DATABASE_URL, que nenhum .env de produção define) e só segue se TODAS as condições abaixo valerem.

export const DEMO_FLAG = '--confirmo-banco-de-demo';

export class DemoGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DemoGuardError';
  }
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
/** "demo", "test", "teste" ou "shots" como um pedaço do nome: tostao_demo, tostao_a_shots, test-tostao. */
const TEST_DB_NAME = /(^|[_-])(demo|test|teste|shots)([_-]|$)/i;
/** Domínios reservados (RFC 2606 e 6761): ninguém recebe e-mail neles, então só existem em teste. */
const RESERVED_EMAIL = /@([a-z0-9-]+\.)*(test|invalid|example|localhost)$|@(example)\.(com|net|org)$/i;

export const isTestEmail = (email: string) => RESERVED_EMAIL.test(email.trim());

export type DemoTarget = { host: string; port: string; database: string };

/** Confere o ambiente ANTES de abrir qualquer conexão. Lança `DemoGuardError` explicando o que faltou. */
export function assertDemoTarget(input: {
  nodeEnv: string | undefined;
  argv: readonly string[];
  databaseUrl: string | undefined;
}): DemoTarget {
  const { nodeEnv, argv, databaseUrl } = input;
  // Mesma regra do env.ts: fora de development/test (inclusive vazio) conta como produção.
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new DemoGuardError(
      `Seed de demonstração recusado: NODE_ENV="${nodeEnv ?? ''}". Ele só roda com NODE_ENV=development ou test.`,
    );
  }
  if (!argv.includes(DEMO_FLAG)) {
    throw new DemoGuardError(`Seed de demonstração recusado: faltou a flag ${DEMO_FLAG}.`);
  }
  if (!databaseUrl) {
    throw new DemoGuardError('Seed de demonstração recusado: defina DEMO_DATABASE_URL (o DATABASE_URL é ignorado).');
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new DemoGuardError('Seed de demonstração recusado: DEMO_DATABASE_URL não é uma URL válida.');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new DemoGuardError('Seed de demonstração recusado: DEMO_DATABASE_URL precisa ser postgresql://.');
  }
  // `?host=` troca o servidor por trás da URL (soquete ou outra máquina): não vale a pena interpretar, recusa.
  if (url.searchParams.has('host')) {
    throw new DemoGuardError('Seed de demonstração recusado: não use o parâmetro "host" na DEMO_DATABASE_URL.');
  }
  if (!LOOPBACK.has(url.hostname.toLowerCase())) {
    throw new DemoGuardError(`Seed de demonstração recusado: só banco local (recebi o host "${url.hostname}").`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!TEST_DB_NAME.test(database)) {
    throw new DemoGuardError(
      `Seed de demonstração recusado: o banco "${database}" não parece de teste. O nome precisa ter "demo", "test", "teste" ou "shots" (ex.: tostao_shots).`,
    );
  }
  return { host: url.hostname, port: url.port || '5432', database };
}

/** Segunda trava, já com o banco aberto: se existe alguma conta que não é de teste, este banco é de verdade. */
export function assertOnlyTestAccounts(emails: readonly string[]) {
  const real = emails.filter((e) => !isTestEmail(e)).length;
  if (real > 0) {
    // Sem listar os e-mails: se o banco for o errado, eles são de pessoas reais.
    throw new DemoGuardError(
      `Seed de demonstração recusado: este banco tem ${real} conta(s) que não são de teste. Não é um banco de demonstração.`,
    );
  }
}
