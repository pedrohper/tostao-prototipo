// Dispara o e-mail de "esqueci a senha" por linha de comando (suporte). O link vai SÓ pelo e-mail: nada de token no terminal.
// Uso: pnpm --filter @tostao/api reset-link pessoa@email.com
import { env } from '../env.js';
import { makeEmailGateway } from '../gateways/make-email-gateway.js';
import { prisma } from '../lib/prisma.js';
import { makePrismaRepositories } from '../repositories/prisma/index.js';
import { RequestPasswordResetUseCase } from '../use-cases/password-reset.js';

const email = process.argv[2];
if (!email) {
  console.error('Uso: pnpm --filter @tostao/api reset-link pessoa@email.com');
  process.exit(1);
}
const request = new RequestPasswordResetUseCase(makePrismaRepositories(prisma), makeEmailGateway(env), env.WEB_ORIGIN);
await request.execute({ email });
await request.tasks.drain();
// Mesma resposta com ou sem conta (nem o terminal serve de oráculo de e-mails cadastrados).
console.log('Pedido processado. Se o e-mail tem conta, o link de redefinição foi enviado (vale 1 h).');
await prisma.$disconnect();
