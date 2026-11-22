// Lê e valida as variáveis de ambiente UMA vez, na subida.
// Se faltar algo, o servidor nem sobe (fail fast), em vez de quebrar no meio de uma requisição.
import { z } from 'zod';

const isDevLike = () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa de pelo menos 16 caracteres'),
    // E-mail transacional (verificação de e-mail e "esqueci minha senha"). "fake" só em development/test.
    EMAIL_PROVIDER: z.enum(['resend', 'fake']).default('fake'),
    RESEND_API_KEY: z.string().default(''),
    // Remetente com domínio verificado no Resend. Ex.: Tostão <nao-responda@seudominio.com.br>
    EMAIL_FROM: z.string().default(''),
    PORT: z.coerce.number().default(3333),
    // Só a própria máquina fala com a API (o site chama por localhost). Use HOST=0.0.0.0 se precisar abrir.
    HOST: z.string().default('127.0.0.1'),
    // Origem(ns) do site, separadas por vírgula. Em produção: HTTPS e nunca "*" (o CORS usa credentials).
    WEB_ORIGIN: z.string().default('http://localhost:3000'),
    // Quais proxies são de confiança pra ler X-Forwarded-For (IP real nos limites de requisição). A web fica na mesma
    // máquina e repassa o IP do cliente: o padrão "loopback" confia só nela. Pode ser "false", "true" ou uma lista de
    // IPs/CIDRs separada por vírgula (ex.: 127.0.0.1,172.18.0.0/16). Nunca "true" com a API exposta direto na internet.
    TRUST_PROXY: z.string().default('loopback'),
    BANK_GATEWAY: z.enum(['fake', 'pluggy']).default('fake'),
    // Redis: state do login social (uso único) e limite de tentativas do WhatsApp. Ex.: redis://localhost:6379/0
    // Obrigatório fora de NODE_ENV=test. Dica: use um número de banco só do Tostão (…/5) se o Redis for compartilhado.
    REDIS_URL: z.string().default(''),
    PLUGGY_CLIENT_ID: z.string().default(''),
    PLUGGY_CLIENT_SECRET: z.string().default(''),
    // Conectores de teste no widget. Sem a variável: só fora de produção.
    PLUGGY_INCLUDE_SANDBOX: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['true', 'false']).optional()),
    // O Pluggy atualiza cada banco uma vez por dia, em horários diferentes: de 3 em 3 horas pega o mesmo dia.
    SYNC_CRON: z.string().default('0 6-23/3 * * *'),
    // Materialização de recorrências e de lançamentos agendados (T5.2). A cada hora: cada pessoa tem o meio-dia dela
    // num horário diferente e a rodada é idempotente (rodar toda hora é seguro). Validado aqui pra erro de digitação
    // aparecer na subida, não às 3 da manhã.
    RECURRING_CRON: z
      .string()
      .default('5 * * * *')
      .refine((v) => v.trim().split(/\s+/).length >= 5, 'RECURRING_CRON precisa de 5 campos (ex.: "5 * * * *")'),
    DEEPSEEK_API_KEY: z.string().default(''),
    DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
    CHAT_DAILY_LIMIT: z.coerce.number().int().positive().default(40),
    // WhatsApp Cloud API (Meta). Sem token, o WhatsApp fica desligado.
    // Avisos no celular (Web Push). Gere com: pnpm --filter @tostao/api vapid
    VAPID_PUBLIC_KEY: z.string().default(''),
    VAPID_PRIVATE_KEY: z.string().default(''),
    VAPID_SUBJECT: z
      .string()
      .refine((v) => !v || /^(mailto:|https:\/\/)/.test(v), 'VAPID_SUBJECT precisa começar com mailto: ou https://')
      .default(''),
    WHATSAPP_TOKEN: z.string().default(''),
    WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
    WHATSAPP_APP_SECRET: z.string().default(''),
    WHATSAPP_VERIFY_TOKEN: z.string().default(''),
    // Ou WhatsApp via n8n (API não oficial). O segredo vai no header X-Tostao-Secret nos dois sentidos.
    N8N_WHATSAPP_SECRET: z
      .string()
      .refine((v) => !v || v.length >= 16, 'N8N_WHATSAPP_SECRET precisa de pelo menos 16 caracteres')
      .default(''),
    N8N_WHATSAPP_SEND_URL: z
      .string()
      .refine((v) => !v || /^https?:\/\//.test(v), 'N8N_WHATSAPP_SEND_URL precisa ser uma URL http(s)')
      .default(''),
    // Porta extra só pro n8n no Docker (no servidor: N8N_LISTEN_HOST=172.18.0.1, gateway da homelab_default). Vazio = sem porta extra.
    N8N_LISTEN_HOST: z.string().default(''),
    N8N_LISTEN_PORT: z.coerce.number().int().default(3334),
    WHATSAPP_NUMBER: z
      .string()
      .regex(/^\d*$/, 'WHATSAPP_NUMBER só com dígitos, com DDI (ex.: 5511999999999)')
      .default(''),
    WHISPER_URL: z
      .string()
      .refine((v) => !v || /^https?:\/\//.test(v), 'WHISPER_URL precisa ser uma URL http(s)')
      .default('http://127.0.0.1:8000/v1/audio/transcriptions'),
    // Login social (Google e Apple). Vazio = provedor desligado.
    GOOGLE_CLIENT_ID: z.string().default(''),
    GOOGLE_CLIENT_SECRET: z.string().default(''),
    APPLE_CLIENT_ID: z.string().default(''),
    APPLE_TEAM_ID: z.string().default(''),
    APPLE_KEY_ID: z.string().default(''),
    APPLE_PRIVATE_KEY: z.string().default(''),
  })
  .refine(
    (e) => !e.WHATSAPP_TOKEN || (e.WHATSAPP_PHONE_NUMBER_ID && e.WHATSAPP_APP_SECRET && e.WHATSAPP_VERIFY_TOKEN),
    {
      message: 'Com WHATSAPP_TOKEN, preencha WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET e WHATSAPP_VERIFY_TOKEN',
    },
  )
  .refine((e) => !e.VAPID_PUBLIC_KEY || e.VAPID_SUBJECT, {
    message: 'Com VAPID_PUBLIC_KEY, preencha VAPID_SUBJECT (ex.: mailto:voce@exemplo.com)',
  })
  // Fora de development/test (qualquer outro NODE_ENV, inclusive vazio, conta como produção): segredo forte e e-mail de verdade.
  .refine((e) => isDevLike() || e.JWT_SECRET.length >= 32, {
    message: 'Em produção, JWT_SECRET precisa de pelo menos 32 caracteres (ex.: openssl rand -hex 32)',
  })
  .refine((e) => isDevLike() || !e.WEB_ORIGIN.split(',').some((o) => o.trim() === '*'), {
    message: 'Em produção, WEB_ORIGIN não pode ser "*" (o CORS usa credentials). Use a URL do site em HTTPS.',
  })
  .refine(
    (e) =>
      e.WEB_ORIGIN.split(',')
        .map((o) => o.trim())
        .filter(Boolean)
        .every((o) => o === '*' || /^https?:\/\/[^/\s]+$/.test(o)),
    { message: 'WEB_ORIGIN precisa ser uma ou mais origens (https://site.com), separadas por vírgula, sem caminho' },
  )
  .refine((e) => isDevLike() || e.EMAIL_PROVIDER === 'resend', {
    message: 'Em produção, use EMAIL_PROVIDER=resend (o gateway "fake" imprime links com token e não envia nada)',
  })
  .refine((e) => e.EMAIL_PROVIDER !== 'resend' || (e.RESEND_API_KEY && e.EMAIL_FROM), {
    message: 'Com EMAIL_PROVIDER=resend, preencha RESEND_API_KEY e EMAIL_FROM',
  })
  .refine((e) => process.env.NODE_ENV === 'test' || /^rediss?:\/\//.test(e.REDIS_URL), {
    message: 'REDIS_URL é obrigatório (ex.: redis://localhost:6379/0). Veja o .env.example.',
  })
  .refine((e) => e.BANK_GATEWAY !== 'pluggy' || (e.PLUGGY_CLIENT_ID && e.PLUGGY_CLIENT_SECRET), {
    message: 'Com BANK_GATEWAY=pluggy, preencha PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET',
  })
  .refine(
    (e) => (!e.GOOGLE_CLIENT_ID && !e.GOOGLE_CLIENT_SECRET) || Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET),
    {
      message: 'Para ativar login com Google, preencha GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET',
    },
  )
  .refine(
    (e) =>
      (!e.APPLE_CLIENT_ID && !e.APPLE_TEAM_ID && !e.APPLE_KEY_ID && !e.APPLE_PRIVATE_KEY) ||
      Boolean(e.APPLE_CLIENT_ID && e.APPLE_TEAM_ID && e.APPLE_KEY_ID && e.APPLE_PRIVATE_KEY),
    {
      message: 'Para ativar login com Apple, preencha APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID e APPLE_PRIVATE_KEY',
    },
  );

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:\n', z.prettifyError(parsed.error));
  process.exit(1);
}
export const env = parsed.data;
