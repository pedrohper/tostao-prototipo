// Lê e valida as variáveis de ambiente UMA vez, na subida.
// Se faltar algo, o servidor nem sobe (fail fast), em vez de quebrar no meio de uma requisição.
import { z } from 'zod';

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa de pelo menos 16 caracteres'),
    PORT: z.coerce.number().default(3333),
    WEB_ORIGIN: z.string().default('http://localhost:3000'),
    BANK_GATEWAY: z.enum(['fake', 'pluggy']).default('fake'),
    PLUGGY_CLIENT_ID: z.string().default(''),
    PLUGGY_CLIENT_SECRET: z.string().default(''),
    SYNC_CRON: z.string().default('0 6 * * *'),
  })
  .refine((e) => e.BANK_GATEWAY !== 'pluggy' || (e.PLUGGY_CLIENT_ID && e.PLUGGY_CLIENT_SECRET), {
    message: 'Com BANK_GATEWAY=pluggy, preencha PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET',
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:\n', z.prettifyError(parsed.error));
  process.exit(1);
}
export const env = parsed.data;
