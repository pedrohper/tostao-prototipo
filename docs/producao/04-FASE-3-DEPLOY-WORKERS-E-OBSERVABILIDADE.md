# Fase 3 (P3) — Build de Produção, Docker, Workers (BullMQ), Observabilidade e CI/CD

> **Prioridade:** OBRIGATÓRIA ANTES DO GO-LIVE — Desacopla o app do homelab/PM2 artesanal e entrega operação 24/7 com zero-downtime, workers distribuídos, backups cifrados offsite e monitoramento real.
> **Pré-requisito:** Fases 0, 1 e 2 concluídas.

---

## T3.1 — Compilação Real da API, Remoção de `tsx` em Produção e Docker Multi-Stage Agnóstico

- [ ] Concluída

### Problema atual

1. `apps/api/package.json:8` executa `"start": "tsx --env-file=.env src/server.ts"` em produção (compila TS em runtime, maior consumo de RAM/startup e depende de `devDependencies`).
2. `package.json:14` raiz só compila `@tostao/web` (`"build": "pnpm --filter @tostao/web build"`).
3. Não existem `Dockerfile`s nem build `standalone` do Next.js; o deploy atual ([`/home/optiplex/homelab/scripts/deploy-tostao.sh`](/home/optiplex/homelab/scripts/deploy-tostao.sh)) sobrescreve `.next` ao vivo causando chunk mismatch e usa PM2 `fork` via wrapper `bash -c`.
4. `artefato-tostao-claude.html` (3,8 MB) está versionado na raiz do repositório.
5. `env.ts:13` tem default `BANK_GATEWAY="fake"` e `server.ts:26` faz fallback silencioso para `FakeAiGateway`.

### Correção técnica

1. **Build de produção do monorepo:**
   - Adicionar `build` em `packages/contracts/package.json` (`tsc -p tsconfig.json`) e em `apps/api/package.json` (`tsup` ou `tsc` gerando `dist/server.js`, `dist/worker.js` e `dist/jobs/*.js`).
   - Alterar `apps/api/package.json`: `"start": "node dist/server.js"` e `"start:worker": "node dist/worker.js"`.
   - Atualizar `package.json` raiz: `"build": "pnpm --filter @tostao/contracts build && pnpm --filter @tostao/api build && pnpm --filter @tostao/web build"`.
   - Habilitar `output: 'standalone'` em `apps/web/next.config.ts`.
2. **Guardrails de produção em `apps/api/src/env.ts`:**
   - Quando `NODE_ENV === 'production'`:
     - Falhar no boot (`process.exit(1)`) se `BANK_GATEWAY !== 'pluggy'` (a menos que `ALLOW_FAKE_BANK=true` explícito em staging).
     - Exigir `JWT_SECRET.length >= 32`, `REDIS_URL`, `WEB_ORIGIN` HTTPS (nunca `localhost` nem `*`), `DATABASE_URL` com SSL recomendado, e logar aviso explícito (ou falhar) se `DEEPSEEK_API_KEY` ou `RESEND_API_KEY` estiverem vazias.
3. **Dockerfiles multi-stage agnósticos (usuário não-root `node`):**
   - Criar `docker/api.Dockerfile` (imagem final enxuta com `node:22-alpine`, `prisma` engine, `dist/` compilado, `HEALTHCHECK` apontando para `/health/live`, sem `devDependencies`).
   - Criar `docker/web.Dockerfile` (Next.js `standalone` + `.next/static` + `public/`, `HEALTHCHECK`).
   - Criar `docker/worker.Dockerfile` (reaproveita build da API rodando `node dist/worker.js`).
   - Criar `docker-compose.prod.yml` de referência agnóstico (serviços `api`, `web`, `worker`, `postgres:16-alpine`, `redis:7-alpine`, rede isolada, `restart: unless-stopped`, `mem_limit`, sem credenciais hardcoded, rodando `prisma migrate deploy` como init/pre-deploy step).
   - Criar `.dockerignore` otimizado.
4. **Limpeza do repositório:**
   - Remover `artefato-tostao-claude.html` (3,8 MB) do repositório (mover para fora do git se quiser guardar como arquivo histórico).

### Critérios de aceite & testes

- `docker compose -f docker-compose.prod.yml build` conclui limpo para `api`, `web` e `worker`.
- Containers sobem como usuário não-root, sem `tsx`, e respondem `200` nos healthchecks.

---

## T3.2 — Healthchecks Profundos, Connection Pooling e Graceful Shutdown

- [ ] Concluída

### Problema atual

1. `/health` (`apps/api/src/app.ts`) retorna apenas `{ status: 'ok' }` sem testar conectividade com Postgres nem Redis.
2. `apps/api/src/server.ts` não trata `SIGTERM`/`SIGINT` (derruba requisições em voo, não fecha conexões do Prisma/Redis e deixa timers/crons ativos).
3. `apps/api/src/lib/prisma.ts` não configura logging de slow queries nem parâmetros de pool; scripts CLI (`seed.ts`, `run-sync-once.ts`, `fix-bank-dates.ts`, `recompute-internal-transfers.ts`) desconectam fora de `try/finally`.

### Correção técnica

1. **Healthchecks (`apps/api/src/app.ts`):**
   - `GET /health/live`: responde `200 { status: 'ok' }` (liveness probe — sem I/O externo).
   - `GET /health/ready`: executa `SELECT 1` no Postgres (timeout 2s) e `PING` no Redis (timeout 2s); retorna `200` se saudáveis ou `503` se qualquer dependência falhar (readiness probe para zero-downtime / load balancer). Manter `GET /health` como alias de `/health/ready` (ou `/health/live` documentado).
2. **Graceful shutdown (`apps/api/src/server.ts` e `apps/api/src/worker.ts`):**
   - Registrar handlers para `SIGTERM` e `SIGINT`:
     1. Para de aceitar novas conexões (`await app.close()`).
     2. Fecha workers/filas BullMQ aguardando jobs em voo (timeout máx. 25s).
     3. Fecha `redis.quit()` e `prisma.$disconnect()`.
     4. Encerra com `process.exit(0)` (ou `1` se exceder timeout).
3. **Prisma pool & scripts:**
   - Configurar `PrismaClient` em `apps/api/src/lib/prisma.ts` com log estruturado para `error` e `warn` (+ detecção de queries > 500ms em produção via `$extends` ou eventos).
   - Documentar em `.env.example` parâmetros de pool na `DATABASE_URL` (`?connection_limit=20&pool_timeout=10&sslmode=require`) e suporte a PgBouncer (`?pgbouncer=true`).
   - Envolver todos os scripts CLI em `try { ... } finally { await prisma.$disconnect(); }` e remover `console.log` de descrições/valores bancários de usuários em `apps/api/src/jobs/recompute-internal-transfers.ts:21,31`.

### Critérios de aceite & testes

- Teste de `/health/ready` retornando `503` quando banco/Redis indisponíveis e `200` quando saudáveis.
- Teste manual com `kill -TERM <pid>`: API finaliza requisições em voo e fecha Prisma/Redis com código `0`.

---

## T3.3 — Worker Dedicado com BullMQ + Redis (Crons, Sync, Notificações e Outbox)

- [ ] Concluída

### Problema atual

1. Todos os crons (`daily-sync.ts`, `tostao-checks.ts`, `notifications.ts`) rodam dentro do processo HTTP (`server.ts:78-101`) sem lock distribuído — escalar para 2 réplicas duplica syncs, gastos de LLM e notificações.
2. `jobs/notifications.ts:113-121` usa `setInterval` sem proteção de sobreposição e sem cancelamento no shutdown.
3. `claimNotification` (`notifications.ts:31,43`, `tostao-checks.ts:40,56`) grava `sent_notifications` **antes** do envio — qualquer falha transitória de Push/WhatsApp causa perda definitiva do aviso.
4. `categorizeLater`, `checkLater` e processamento de webhooks WhatsApp rodam em `void (async () => ...)` fire-and-forget sem fila, sem debounce (10 cliques disparam 10 `RunTostaoChecksUseCase` paralelos), sem retry e perdidos em restart.
5. `AutoCategorizeUseCase.running` (`Set`), `HandleWhatsAppMessageUseCase.seen` (`Set` de 500 itens) e `InstitutionLogosUseCase.cache` são voláteis em memória.

### Correção técnica

1. **Arquitetura de Filas (`bullmq` sobre Redis) em `apps/api/src/queues/` e entrypoint `apps/api/src/worker.ts`:**
   - **Fila `bank-sync`:**
     - Job agendado (`SYNC_CRON`, ex.: `0 6 * * *` America/Sao_Paulo) enfileira 1 job por `connectionId` ativo (com `jobId` deduplicado + concorrência controlada, ex.: `5` conexões paralelas, retries `3` com backoff exponencial).
     - Lock distribuído por `connectionId` impedindo corrida entre sync manual e cron.
   - **Fila `tostao-checks`:**
     - Job agendado horário enfileira por `userId` em lotes; `checkLater` nos controllers passa a enfileirar com `jobId: check:${userId}` e `delay: 5000` (debounce automático — 10 categorizações viram 1 execução!).
   - **Fila `auto-categorize`:**
     - Substitui `categorizeLater` fire-and-forget e o `Set` em memória; deduplicação por `jobId: cat:${userId}`.
   - **Fila `notifications`:**
     - Entrega idempotente: criar registro com status `PENDING` → enviar Push/WhatsApp → atualizar para `SENT` só após sucesso (em falha transitória, BullMQ faz retry com backoff até DLQ; em 410/404 de Push, remove a subscription).
     - Em `tostao-checks`: notificar todos os insights `urgent` pendentes (não só `urgent[0]`).
   - **Fila `webhooks`:**
     - Recebe eventos de WhatsApp e Pluggy rapidamente (HTTP `200` imediato) e processa assincronamente com deduplicação persistida no Redis (`SET NX EX 86400` por `messageId`/`eventId`, substituindo o `Set` de 500 itens).
   - **Fila `maintenance` (cron diário 03:00):**
     - Expurgo de `RefreshToken` expirados, `PasswordReset` > 7d, `EmailVerificationToken` > 7d, `SentNotification` > 90d, `TostaoInsight` expirados e processamento da tabela `OutboxJob` (ex.: retries de `pluggy.deleteItem` de contas deletadas).
2. **Cache distribuído no Redis:**
   - Compartilhar cache de `PluggyBankGateway.getApiKey()` (TTL 1h50m com lock single-flight), `InstitutionLogosUseCase` (TTL 24h) e `BcbRatesGateway` (TTL 12h + negative cache de 5 min em erro) no Redis.
   - Adicionar `AbortSignal.timeout(15_000)` em **todas** as chamadas HTTP externas (Pluggy, OAuth, Resend, DeepSeek, Meta) + teto máximo de 50 páginas no cursor `fetchTransactions` do Pluggy (`pluggy-bank-gateway.ts:265-290`) + limite de concorrência (5 por vez) nos 56 `/connectors/{id}` (`L187-189`) + retry automático em 401 (renovando API key) e 429/503 com backoff exponencial.

### Critérios de aceite & testes

- Processo `api` não inicia nenhum cron/intervalo em produção (`ENABLE_IN_PROCESS_WORKERS=false`); apenas o processo `worker` consome filas.
- 2 instâncias de `api` + 2 instâncias de `worker` rodando simultaneamente não duplicam sync nem notificações.

---

## T3.4 — Webhooks do Pluggy & WhatsApp Meta Cloud API Oficial (Templates)

- [ ] Concluída

### Problema atual

1. Não existe endpoint para webhooks do Pluggy (`item/updated`, `item/error`, `item/waiting_user_input`, `item/deleted`) — o app depende apenas de polling diário às 6h.
2. Notificações proativas do WhatsApp (`jobs/notifications.ts:77,103`, `jobs/tostao-checks.ts:58`) enviam `type: 'text'` livre pela Cloud API da Meta, que é rejeitado fora da janela de 24h de conversa.
3. Workflow `/home/optiplex/homelab/n8n-workflows/tostao-weekly-summary.json` ainda usa Evolution API não-oficial com API key hardcoded e número pessoal.

### Correção técnica

1. **Webhook Pluggy (`POST /webhooks/pluggy`):**
   - Criar controller dedicado em `apps/api/src/http/controllers/pluggy-webhook.ts` validando assinatura/segredo (`PLUGGY_WEBHOOK_SECRET` via HMAC/header configurado na Application Pluggy) e payload Zod.
   - Enfileirar evento na fila `webhooks` (BullMQ):
     - `item/updated` / `transactions/created` → enfileira sync imediato daquela `connectionId`.
     - `item/error` / `item/login_error` / `item/waiting_user_input` → atualiza status da conexão (`ERROR` / `WAITING_USER_INPUT`) e dispara aviso ao usuário no app/Push.
     - `item/deleted` → marca conexão como desconectada.
2. **WhatsApp Meta Cloud API com Templates Oficiais:**
   - Estender `MetaWhatsAppGateway` (`apps/api/src/gateways/whatsapp-gateway.ts`) com `sendTemplate(to, templateName, lang, components)`.
   - Usar `sendTemplate` para todos os avisos proativos disparados por jobs (`fatura_vencendo`, `limite_categoria`, `alerta_tostao_auto`, `resumo_semanal`), reservando `sendText` apenas para respostas dentro da janela de 24h de uma mensagem recebida do usuário.
   - Documentar em `docs/producao/WHATSAPP_TEMPLATES.md` os nomes e variáveis dos templates a aprovar no Meta Business Manager.
   - Adicionar cota por usuário e limite de tamanho (10 MB) para transcrição de áudio (`WHISPER_URL` + opção de API gerenciada com auth header `WHISPER_API_KEY`).

### Critérios de aceite & testes

- Testes unitários de `POST /webhooks/pluggy` (assinatura inválida → `401`, evento `item/updated` → enfileira sync, replay do mesmo `eventId` → ignorado).
- Teste de `MetaWhatsAppGateway.sendTemplate` validando payload oficial da Graph API.

---

## T3.5 — Backups Cifrados Offsite, Observabilidade (Sentry + Logs + Métricas) e CI/CD

- [ ] Concluída

### Problema atual

1. `scripts/backup-db.sh:15-32` grava `.sql.gz` em texto claro no disco local antes de cifrar (`age` nem estava ativo nos dumps em `~/tostao-backups/`), sem envio offsite (S3/R2) e sem crontab ativo.
2. Zero error tracking (Sentry), zero métricas de negócio/infra e zero testes de integração contra PostgreSQL real ou E2E no `.github/workflows/ci.yml`.

### Correção técnica

1. **Backup seguro em stream + offsite (`scripts/backup-db.sh`):**
   - Cifrar em stream (`pg_dump ... | gzip | age -R "$RECIPIENTS" > "$FILE.sql.gz.age"`) sem jamais gravar plaintext em disco; falhar se chave `age` não estiver configurada em produção.
   - Adicionar upload automático para storage S3/Cloudflare R2 (`BACKUP_S3_URI`) com retenção e recomendação de Object Lock + PITR (WAL archiving) no banco gerenciado.
   - Criar script `scripts/verify-backup.sh` para testar restore automático mensal em banco temporário.
2. **Observabilidade (`@sentry/node` + `@sentry/nextjs` + métricas):**
   - Integrar Sentry (ativado quando `SENTRY_DSN` estiver presente) em `apps/api/src/server.ts`, `apps/api/src/worker.ts` e `apps/web` (`instrumentation.ts`, `global-error.tsx`), com `beforeSend` aplicando `scrubFinancialText` e removendo cookies/headers/tokens.
   - Propagar `X-Request-Id` entre `apps/web` (`lib/api.ts`) e `apps/api` (Fastify `genReqId`) para correlação ponta a ponta nos logs JSON.
   - Expor endpoint `/metrics` protegido (token interno ou porta privada) com métricas Prometheus/OpenTelemetry: latência HTTP por rota, taxa de erros 4xx/5xx, contagem/latência de sync Pluggy, tokens/custo estimado DeepSeek, profundidade e falhas das filas BullMQ.
3. **CI/CD Comercial (`.github/workflows/ci.yml`):**
   - Adicionar `services: postgres:16-alpine` e `redis:7-alpine` no job de CI.
   - Etapas obrigatórias no CI:
     1. `pnpm install --frozen-lockfile`
     2. `pnpm --filter @tostao/api exec prisma generate`
     3. `pnpm --filter @tostao/api exec prisma migrate deploy` + `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`
     4. `pnpm format:check && pnpm typecheck && pnpm lint`
     5. `pnpm test` (unitários) + `pnpm test:integration` (nova suíte contra Postgres + Redis reais cobrindo `delete-account` com categorias customizadas, `$transaction`, `sync`, `refresh-token`, `rate-limit`, `export-user-data`)
     6. `pnpm build` (contracts + api + web)
     7. `pnpm audit --audit-level=high` + secret scanning (`gitleaks/gitleaks-action`)
     8. Smoke E2E com Playwright em `apps/web` (landing → criar conta → login → anotar gasto → carteira → importar extrato → excluir conta) + build de verificação dos `Dockerfile`s.

### Critérios de aceite & testes

- Workflow `.github/workflows/ci.yml` verde com Postgres + Redis reais, testes de integração, build da API/Web e verificação de migration drift.
- `scripts/backup-db.sh` nunca grava arquivo `.sql.gz` sem cifra em disco quando `BACKUP_REQUIRE_ENCRYPTION=true`.
