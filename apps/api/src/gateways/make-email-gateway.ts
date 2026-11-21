import { FakeEmailGateway, ResendEmailGateway, type EmailGateway } from './email-gateway.js';

export function makeEmailGateway(env: {
  EMAIL_PROVIDER: 'resend' | 'fake';
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
}): EmailGateway {
  if (env.EMAIL_PROVIDER === 'resend') return new ResendEmailGateway(env.RESEND_API_KEY, env.EMAIL_FROM);
  // Só chega aqui em development/test (o env.ts barra "fake" em produção): mostra o link no console da API.
  return new FakeEmailGateway((e) => {
    if (e.kind !== 'security-alert') console.info(`[email:fake] ${e.kind} para ${e.to}: ${e.url}`);
  });
}
