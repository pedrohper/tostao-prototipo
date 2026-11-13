// Lê e valida as variáveis de ambiente UMA vez, na subida.
// Se faltar algo, o servidor nem sobe (fail fast), em vez de quebrar no meio de uma requisição.
import { z } from 'zod';

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa de pelo menos 16 caracteres'),
    PORT: z.coerce.number().default(3333),
    // Só a própria máquina fala com a API (o site chama por localhost). Use HOST=0.0.0.0 se precisar abrir.
    HOST: z.string().default('127.0.0.1'),
    WEB_ORIGIN: z.string().default('http://localhost:3000'),
    BANK_GATEWAY: z.enum(['fake', 'pluggy']).default('fake'),
    PLUGGY_CLIENT_ID: z.string().default(''),
    PLUGGY_CLIENT_SECRET: z.string().default(''),
    SYNC_CRON: z.string().default('0 6 * * *'),
    DEEPSEEK_API_KEY: z.string().default(''),
    DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
    CHAT_DAILY_LIMIT: z.coerce.number().int().positive().default(40),
    // WhatsApp Cloud API (Meta). Sem token, o WhatsApp fica desligado.
    // Avisos no celular (Web Push). Gere com: pnpm --filter @tostao/api vapid
    VAPID_PUBLIC_KEY: z.string().default(''),
    VAPID_PRIVATE_KEY: z.string().default(''),
    VAPID_SUBJECT: z.string().default('mailto:pedrohper.business@gmail.com'),
    WHATSAPP_TOKEN: z.string().default(''),
    WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
    WHATSAPP_APP_SECRET: z.string().default(''),
    WHATSAPP_VERIFY_TOKEN: z.string().default(''),
    // Ou WhatsApp via n8n (API não oficial). O segredo vai no header X-Tostao-Secret nos dois sentidos.
    N8N_WHATSAPP_SECRET: z.string().refine((v) => !v || v.length >= 16, 'N8N_WHATSAPP_SECRET precisa de pelo menos 16 caracteres').default(''),
    N8N_WHATSAPP_SEND_URL: z.string().refine((v) => !v || /^https?:\/\//.test(v), 'N8N_WHATSAPP_SEND_URL precisa ser uma URL http(s)').default(''),
    WHATSAPP_NUMBER: z.string().regex(/^\d*$/, 'WHATSAPP_NUMBER só com dígitos, com DDI (ex.: 5511999999999)').default(''),
  })
  .refine((e) => !e.WHATSAPP_TOKEN || (e.WHATSAPP_PHONE_NUMBER_ID && e.WHATSAPP_APP_SECRET && e.WHATSAPP_VERIFY_TOKEN), {
    message: 'Com WHATSAPP_TOKEN, preencha WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET e WHATSAPP_VERIFY_TOKEN',
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
