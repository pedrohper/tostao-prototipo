# Plano Técnico de Produção Comercial — Projeto Tostão

> **Objetivo:** Transformar o protótipo atual (`tostao-prototipo`) em uma aplicação **segura, confiável, rápida, aderente à LGPD e pronta para operação comercial multi-usuário**.
> **Público-alvo destes documentos:** Execução faseada por agente de engenharia (Claude Sonnet) com revisão humana / code review entre fases.

---

## 1. Decisões Arquiteturais Fechadas (Não Perguntar de Novo)

1. **Infraestrutura de Deploy:** Agnóstica baseada em **Docker multi-stage** (`api`, `web` e `worker`) + **PostgreSQL 16** + **Redis 7** (rate limit, filas BullMQ, locks distribuídos, estado OAuth e sessões). Compatível com VPS (Coolify/Dokploy/Compose), PaaS (Fly.io/Railway/Render) ou Cloud (AWS/GCP).
2. **E-mail Transacional:** Criar interface limpa `EmailGateway` em `apps/api/src/gateways/email-gateway.ts` com implementação padrão para **Resend** (`ResendEmailGateway`) + `FakeEmailGateway` para testes/dev local.
3. **IA (LLM) & LGPD:** Manter **DeepSeek** (`DEEPSEEK_API_KEY`), mas **obrigatório** implementar pipeline de **PII scrubbing** antes de qualquer chamada + **consentimento explícito versionado** do usuário + confirmação obrigatória para ferramentas de escrita (`registrar_transacao`).
4. **Idiomas no Lançamento:** Focar lançamento comercial em **PT-BR**. Ocultar o seletor de idiomas (`en`/`es`) da UI e eliminar o carregamento dos 3 dicionários completos (231 KB) no bundle do cliente, mantendo a arquitetura pronta para reativar i18n completo no futuro.
5. **WhatsApp:** Preparar e endurecer a integração para **Meta Cloud API oficial** (incluindo templates aprovados para avisos proativos fora da janela de 24h), desacoplando da Evolution API/n8n pessoal do homelab.
6. **Monetização / Billing:** **Fora deste escopo.** Não implementar Stripe/Asaas/planos pagos ainda — foco 100% em segurança, confiabilidade financeira, performance, UX comercial e deploy profissional.

---

## 2. Mapa das Fases e Ordem Obrigatória de Execução

Execute **uma fase por vez** (ou em blocos de 2–4 tarefas por PR/branch), validando todos os critérios de aceite antes de avançar.

| Arquivo                                                                                                | Fase               | Foco Principal                                                                                                                                                                                                                                                                                                     | Risco Mitigado                                                                  |
| :----------------------------------------------------------------------------------------------------- | :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| [`01-FASE-0-SEGURANCA-E-BLOQUEADORES.md`](./01-FASE-0-SEGURANCA-E-BLOQUEADORES.md)                     | **Fase 0 (P0)**    | Segurança crítica (BOLA Pluggy, SSRF Push, OAuth Pre-Takeover, WhatsApp 6 dígitos, PII/Prompt Injection, Open Redirect/Path Traversal Web), cascata `User.delete` LGPD, bug `parseMoney` 100x e upload >1 MB                                                                                                       | Exploração ativa, vazamento cross-tenant, perda/corrupção imediata de dados     |
| [`02-FASE-1-CONFIABILIDADE-FINANCEIRA-E-SESSAO.md`](./02-FASE-1-CONFIABILIDADE-FINANCEIRA-E-SESSAO.md) | **Fase 1 (P1)**    | Sessão comercial (Access + Refresh revogável), e-mail transacional (verificação + reset self-service), Rate Limit Redis + Helmet + CSP, `$transaction` e `errorHandler`, evolução do Schema (`BigInt`, `TIMESTAMPTZ`, `timezone`, enums, tabelas LGPD/Audit) e todos os bugs financeiros                           | Inconsistência de saldos/faturas/extratos, sessão irrevogável, race conditions  |
| [`03-FASE-2-PERFORMANCE-UX-E-ACABAMENTO.md`](./03-FASE-2-PERFORMANCE-UX-E-ACABAMENTO.md)               | **Fase 2 (P2)**    | Índices PostgreSQL, eliminação de N+1 (`Forecast`, `Chat`, `Sync`, `People`), busca/paginação SQL, otimização Next.js (bundle i18n, `React.cache()`, `<Suspense>`, `existsSync`, DOM duplicado, imagens), Error Boundaries, a11y, textos legais comerciais e exportação LGPD                                       | Lentidão sob escala, telas quebradas sem fallback, UX de protótipo              |
| [`04-FASE-3-DEPLOY-WORKERS-E-OBSERVABILIDADE.md`](./04-FASE-3-DEPLOY-WORKERS-E-OBSERVABILIDADE.md)     | **Fase 3 (P3)**    | Build compilado da API (sem `tsx`), Docker multi-stage + zero-downtime + healthchecks + graceful shutdown, Worker dedicado BullMQ + Redis (crons, sync, notificações idempotentes, webhooks Pluggy & Meta Cloud API), backup cifrado offsite + PITR, Sentry/logs/métricas, CI com Postgres real e E2E              | Downtime em deploy, jobs duplicados/travados, perda de dados em desastre        |
| [`05-FASE-4-POLIMENTO-INTERFACE-COMERCIAL.md`](./05-FASE-4-POLIMENTO-INTERFACE-COMERCIAL.md)           | **Fase 4 (P2/UI)** | Toast global + "Desfazer", PWA install prompt, onboarding focado sem fricção, Home enxuta + gráficos interativos, Anotar em 3 toques + logos de 25–30 marcas (Assinaturas/Extrato), Chat IA com streaming (SSE) + cards ricos, lições conectadas ao extrato real + galeria de simuladores e Landing Page comercial | Percepção de protótipo, baixa conversão/ativação e falta de "efeito uau" visual |

---

## 3. Regras Gerais de Execução para o Agente (Claude Sonnet)

1. **Ler `CLAUDE.md` e `AGENT_SYNC.md` antes de começar** qualquer entrega e registrar a execução ao final conforme o padrão do repositório.
2. **Não quebrar compatibilidade sem migration segura:** toda mudança em `apps/api/prisma/schema.prisma` deve gerar migration versionada em `apps/api/prisma/migrations/` e passar em `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`.
3. **Sem segredos no git:** nunca commitar `.env`, chaves privadas ou dados pessoais; sempre documentar novas env vars em `.env.example` e `apps/web/.env.example` e validá-las em `apps/api/src/env.ts`.
4. **Checklist obrigatório ao final de cada bloco/PR:**
   ```bash
   pnpm format:check
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm build
   ```
   _(A partir da Fase 3, incluir também testes de integração com Postgres real e `pnpm --filter @tostao/api build`.)_
5. **Testes para cada correção:** toda vulnerabilidade ou bug corrigido deve ganhar teste automatizado cobrindo o cenário de ataque/regressão.

---

## 4. Prompt Base Sugerido para Repassar ao Claude Sonnet

Use este template ao iniciar cada fase (ou subconjunto de tarefas, ex.: `T0.1` a `T0.5`):

> Leia `CLAUDE.md`, `AGENT_SYNC.md`, `docs/producao/00-INDICE.md` e `docs/producao/<ARQUIVO_DA_FASE>.md`.
> Execute as tarefas `<T_INICIO>` até `<T_FIM>` seguindo exatamente as especificações técnicas, caminhos de arquivos e critérios de aceite descritos no documento.
> Antes de editar, apresente um breve plano de arquivos e migrations que serão tocados. Para cada tarefa, escreva os testes de regressão correspondentes, rode `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm build`, atualize os checkboxes no `.md` da fase e registre a entrega em `AGENT_SYNC.md`.
