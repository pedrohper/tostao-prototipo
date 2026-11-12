// Gera link de "esqueci a senha" (vale 1 h, uma vez só). Uso: pnpm --filter @tostao/api reset-link pessoa@email.com
import { prisma } from '../lib/prisma.js';
import { makePrismaRepositories } from '../repositories/prisma/index.js';
import { CreatePasswordResetUseCase } from '../use-cases/password-reset.js';

const email = process.argv[2];
if (!email) {
  console.error('Uso: pnpm --filter @tostao/api reset-link pessoa@email.com');
  process.exit(1);
}
const base = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '');
try {
  const { token, user } = await new CreatePasswordResetUseCase(makePrismaRepositories(prisma)).execute({ email });
  console.log(`Link pra ${user.name} (vale 1 h):\n${base}/redefinir-senha?token=${token}`);
} catch {
  console.error('Não achei ninguém com esse e-mail.');
  process.exitCode = 1;
}
await prisma.$disconnect();
