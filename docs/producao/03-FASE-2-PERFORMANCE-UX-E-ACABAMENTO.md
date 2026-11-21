# Fase 2 (P2) — Performance, Escalabilidade de Queries, UX Comercial, a11y e LGPD

> **Prioridade:** ALTA (pré-lançamento aberto) — Elimina gargalos de banco e bundle, fecha todas as lacunas de UX/acessibilidade e remove todo vestígio de protótipo/homelab.
> **Pré-requisito:** Fases 0 e 1 concluídas.

---

## T2.1 — Índices PostgreSQL e Eliminação de N+1 / Explosão de Queries

- [x] Concluída

### Problema atual

1. Faltam índices críticos em FKs e colunas de filtro em `apps/api/prisma/schema.prisma`, gerando full table scans frequentes.
2. `ForecastUseCase` (`apps/api/src/use-cases/financial-plan.ts:470-481`) dispara **~30 queries SQL** por chamada (invocando `GetMonthSummaryUseCase` 7 vezes, recarregando `categories`, `accounts` e `afterTxs` repetidamente).
3. `AskTostaoUseCase.snapshot` (`apps/api/src/use-cases/ask-tostao.ts:116-129`) dispara **~40+ queries SQL** por mensagem de chat.
4. `SyncBankConnectionUseCase` (`sync-bank-connection.ts:60-123,156-170`) e `ImportStatementUseCase` (`import-statement.ts:67-101`) fazem 2N queries sequenciais por transação + N+1 em `belongsToOlderConnection`.
5. N+1 em `ListPeopleUseCase` (`people.ts:31-34`), `EngagementUseCase.friends` (`engagement.ts:137-151`), `ListInvitesUseCase` (`invites.ts:35-45`), `AutoCategorizeUseCase` (`auto-categorize.ts:99-104`) e full scan em `runNotifications` (`jobs/notifications.ts:53-55`).

### Correção técnica

1. **Migration de índices (`apps/api/prisma/schema.prisma` + SQL migration para parciais/GIN):**
   - `bank_connections`: `@@index([status])`
   - `categories`: `@@index([userId])`
   - `accounts`: `@@index([connectionId])`
   - `transactions`:
     - `@@index([accountId])`
     - `@@index([categoryId])`
     - `@@index([userId, accountId, occurredAt])`
     - `@@index([userId, personId, occurredAt])`
     - `@@index([userId, seriesId, occurredAt])`
     - Índices parciais SQL: `(user_id, occurred_at) WHERE category_id IS NULL AND is_internal_transfer = false` e `(user_id, occurred_at) WHERE external_id IS NULL`.
     - Extensão `pg_trgm` + índice GIN em `transactions (description gin_trgm_ops)` para busca textual rápida.
   - `category_rules`: `@@index([categoryId])`
   - `category_budgets`: `@@index([categoryId])`
   - `password_resets`: `@@index([userId])`, `@@index([expiresAt])`
   - `friendships`: `@@index([friendId])`
   - `chat_messages`: `@@index([userId, role, createdAt])`
   - `sent_notifications`: `@@index([sentAt])`
   - `tostao_insights`: `@@index([expiresAt])`
2. **Refatorar `ForecastUseCase` e `AskTostaoUseCase.snapshot`:**
   - Criar helper de agregação mensal em lote (`summarizeMonths(userId, months[], preloadedData)`) que carrega `accounts`, `categories` e todas as transações do range `[minMonthStart, now]` em **apenas 3 queries**, reduzindo `ForecastUseCase` de ~30 para **≤ 6 queries** e `AskTostaoUseCase` de ~40+ para **≤ 8 queries**.
3. **Batch operations em Sync, Import, People, Friends, Invites e Notifications:**
   - `SyncBankConnectionUseCase` e `ImportStatementUseCase`: buscar existentes com `findMany({ where: { userId, externalId: { in: ids } } })`, inserir novos com `createMany({ skipDuplicates: true })`, atualizar transferências internas com `updateMany({ where: { id: { in: [...] } } })` e pré-carregar conexões/contas fora do loop.
   - `ListPeopleUseCase`: usar `prisma.transaction.groupBy({ by: ['personId'], where: { userId, personId: { not: null } }, _sum: { amountInCents: true }, _count: true })`.
   - `EngagementUseCase.friends` e `ListInvitesUseCase`: usar `users.findManyByIds(ids)` + query única de `user_activities` para todos os `friendIds`.
   - `runNotifications`: substituir `listAllIds()` por query paginada filtrando somente usuários elegíveis (Push ou WhatsApp + `notifyWhatsapp = true`).

### Critérios de aceite & testes

- Medir contagem de queries SQL (via log Prisma em dev/test): `GET /forecast` ≤ 6 queries; `POST /chat` ≤ 10 queries; `GET /people` ≤ 3 queries.

---

## T2.2 — Paginação Real no Banco e Busca SQL (`SearchTransactionsUseCase` e Repositórios)

- [x] Concluída

### Problema atual

1. `SearchTransactionsUseCase` (`apps/api/src/use-cases/search-transactions.ts:31-62`) com `period='tudo'` consulta `findManyInRange(userId, new Date(0), now)` sem `take`, carregando **100% do histórico do usuário em RAM** para filtrar por `.includes()` em JavaScript e só depois fazer `.slice(0, 200)`.
2. `PrismaTostaoAutoRepository.listByUser` (`apps/api/src/repositories/prisma/index.ts:573-576`) não aplica `take`, `status` nem `expiresAt`, carregando todo o histórico vitalício de insights.
3. `findManualByUser`, `findByPerson`, `findUncategorized`, `listByCreator` não têm paginação nem limite superior.

### Correção técnica

1. Implementar método `search(...)` em `TransactionsRepository` / `PrismaTransactionsRepository` aplicando no PostgreSQL:
   - `userId`, range de datas, `accountId`, `categoryId`, `isInternalTransfer: false` (quando `excludeTransfers`), filtro de contas `hidden: false`, `description: { contains: q, mode: 'insensitive' }` (acelerado por `pg_trgm`), `orderBy: { occurredAt: 'desc' }`, `take: limit + 1` + `cursor` (`nextCursor`).
2. Atualizar contrato `searchQuery` / `searchResponse` (`packages/contracts/src/index.ts`) e UI `/carteira/busca` com botão "Carregar mais" (paginação por cursor).
3. Filtrar `TostaoInsight` no SQL (`WHERE (expires_at IS NULL OR expires_at > NOW())`) com `take: 50` e adicionar job de expurgo periódico (Fase 3) para `PasswordReset`, `SentNotification`, `TostaoInsight` expirados e `RefreshToken` expirados.

### Critérios de aceite & testes

- Teste garantindo que `SearchTransactionsUseCase` delega filtragem/paginação ao repositório e respeita `limit` + `nextCursor`.

---

## T2.3 — Otimização Next.js: Bundle Client, Fanout SSR, I/O Síncrono e Assets

- [x] Concluída

### Problema atual

1. **231 KB de i18n no bundle JS do cliente:** `apps/web/lib/i18n.ts:1-3` importa estaticamente `pt-br.ts`, `en.ts` e `es.ts`, puxados para o client bundle por `components/nav.tsx:5` e outros Client Components em todas as rotas autenticadas.
2. **15 chamadas HTTP bloqueantes no `/inicio`:** `app/(app)/layout.tsx:13-18` + `app/(app)/inicio/page.tsx:82-110` duplicam `/progress`, `/missions`, `/tostao/auto` sem `React.cache()` nem `<Suspense>`. `aprender/page.tsx:25-29` busca `/summary` e descarta o resultado! `conectar/page.tsx:21` dispara `POST /connections/connect-token` durante o `GET` da página!
3. **~150 syscalls `existsSync` síncronos por request:** `apps/web/lib/art-assets.ts:7-22` bloqueia o event loop do Node em toda visita ao `/aprender`.
4. **Payload RSC e DOM duplicados:** `inicio/page.tsx:983-1081` e `carteira/page.tsx:591-702` renderizam árvores mobile + desktop simultaneamente no HTML; `aprender/page.tsx:135` envia todos os 80 KB de `modules.json` ao Client Component `BookCarousel`.
5. **Logos de banco sem cache & `revalidatePath('/', 'layout')` abusivo:** `components/banco.tsx:35-41` busca `/institutions/logos` com `no-store` em toda navegação; quase toda mutação invalida o layout inteiro.
6. **Imagens cruas sem `width`/`height` (CLS):** `app/(site)/landing.tsx:85-287`, `components/mascote.tsx:47-54`, `components/banco.tsx:299-308` (sem `referrerPolicy="no-referrer"`).
7. **Ícones PWA desatualizados:** `apps/web/public/icones/icon-{192,512,maskable-512}.png` são de Nov 12 (anteriores à troca do favicon em Nov 20).

### Correção técnica

1. **Enxugar i18n + foco PT-BR no lançamento:**
   - Separar módulos server-only de tradução; como o lançamento comercial será em **PT-BR**, ocultar o `<LanguageSwitcher />` da UI (feature flag `NEXT_PUBLIC_ENABLE_I18N=false`), carregar somente `pt-br` por padrão e passar apenas o subconjunto mínimo de strings via props aos Client Components (`Nav`, `StreakDialog`, `TostaoFindingsBoard`, `ChatClient`, `BookCarousel`, `Player`).
2. **Deduplicar e acelerar SSR:**
   - Criar wrappers com `React.cache()` em `apps/web/lib/api-queries.ts` para `getMe()`, `getProgress()`, `getMissions()`, `getTostaoAuto()` e `getBankLogos()` (este com `next: { revalidate: 3600 }`).
   - Quebrar seções abaixo da dobra em `apps/web/app/(app)/inicio/page.tsx` com `<Suspense fallback={<SectionSkeleton />}>` (orçamentos, metas, insights, cartões) e considerar endpoint agregado `GET /dashboard?month=` na API.
   - Remover a chamada descartada de `/summary` em `apps/web/app/(app)/aprender/page.tsx:25-29` e remover `generateStaticParams()` morto em `apps/web/app/(app)/aprender/[licao]/page.tsx:11-20`.
   - Em `apps/web/app/(app)/conectar/page.tsx:21`: substituir o `POST /connections/connect-token` no render por flag `pluggyEnabled` vinda de `GET /me` (só gerar connect-token no clique do usuário).
3. **Eliminar `existsSync` em runtime:**
   - Estender `scripts/sync-art-manifest.mjs` para gerar `apps/web/lib/art-manifest.json` em tempo de build, e fazer `apps/web/lib/art-assets.ts` ler exclusivamente o JSON estático em memória.
4. **Reduzir payload e DOM:**
   - Em `apps/web/app/(app)/aprender/page.tsx:135`: mapear `modules` para um array enxuto de metadados (`id`, `number`, `title`, `lessons: [{ id, number, title, cover }]`) antes de passar a `BookCarousel`.
   - Unificar/responsivizar os cards de `inicio/page.tsx` e `carteira/page.tsx` (CSS Grid/Flex responsivo ou renderização condicional sem duplicar componentes stateful com efeitos) e substituir `revalidatePath('/', 'layout')` por paths específicos (`/inicio`, `/carteira`, etc.).
5. **Imagens & PWA icons:**
   - Adicionar `width`, `height`, `loading="lazy"` (ou `next/image` com `images.remotePatterns` para `cdn.pluggy.ai`) em `landing.tsx`, `mascote.tsx` e `banco.tsx` (+ `referrerPolicy="no-referrer"`).
   - Regenerar `apps/web/public/icones/icon-192.png`, `icon-512.png` e `icon-maskable-512.png` a partir do novo ícone do mascote (`apps/web/app/icon.png` / `apple-icon.png`).

### Critérios de aceite & testes

- `pnpm build` sem warnings de bundle excessivo; tamanho de First Load JS reduzido em >150 KB; zero chamadas `existsSync` em `apps/web/lib/art-assets.ts`; `/conectar` faz 0 chamadas `POST` no SSR.

---

## T2.4 — Error Boundaries, Skeletons, Bugs de UI e Acessibilidade (WCAG AA)

- [ ] Concluída

### Problema atual

1. Não existem `error.tsx`, `global-error.tsx`, `not-found.tsx` nem `loading.tsx` em `apps/web/app/` — qualquer erro de rede derruba o app com tela crua do Next.js.
2. Usuários já logados conseguem abrir `/entrar` e `/criar-conta` sem redirecionar para `/inicio`.
3. `components/icone.tsx:478-492` tem `onError` sem `'use client'` (risco de crash SSR e loop infinito de 404).
4. `components/sheet-swipe.tsx:27` lê `window.matchMedia` durante o render (hydration mismatch).
5. `app/(app)/mais/alertas/page.tsx:77-83` gera `id="avisos"` duplicado no DOM (`TostaoAutoConfigPanel` e `PushNotificationCard`).
6. Ações destrutivas sem confirmação (apagar lançamento/série, apagar meta, desvincular WhatsApp) ou usando `window.confirm` (`conectar/forms.tsx:132`); erros silenciosos em `tostao-auto-card.tsx:77-117`, `avisos.tsx:58-80`, `copy-link.tsx:12`, `player.tsx:105`.
7. Acessibilidade: `StreakDialog` (`streak-modal.tsx:41-174`) e `SwipeSheet` (`sheet-swipe.tsx:94-137`) sem focus trap/scroll-lock/`aria-labelledby`; `<button>` de `6px` dentro de `role="img"` em `book-carousel.tsx:171-191`; `role="img"` sem `aria-label` e `alt="done"`/`aria-label="todo"` hardcoded em inglês.

### Correção técnica

1. **Fallbacks globais e de app:**
   - Criar `apps/web/app/global-error.tsx`, `apps/web/app/error.tsx`, `apps/web/app/not-found.tsx`, `apps/web/app/(app)/error.tsx` (com botão "Tentar novamente" e design da marca Tostão) e `apps/web/app/(app)/loading.tsx` (skeleton coerente).
   - Redirecionar usuários autenticados em `apps/web/app/(auth)/entrar/page.tsx` e `criar-conta/page.tsx` para `/inicio`.
2. **Corrigir bugs de componentes:**
   - Corrigir `components/icone.tsx:478-492` (remover handler `onError` de Server Component ou extrair `<ClientImgWithFallback>` com flag `didFallback` para impedir loop de 404).
   - Mover `window.matchMedia` em `components/sheet-swipe.tsx:27` para `useEffect` (zero hydration mismatch).
   - Corrigir IDs duplicados em `mais/alertas/page.tsx` (`id="tostao-auto"` e `id="notificacoes-push"`).
   - Sincronizar estado de `TostaoFindingsBoard` (`tostao-auto-card.tsx:50`) com `initial` via `useEffect`/key e adicionar `try/catch` com toast/banner de erro em `tostao-auto-card.tsx`, `avisos.tsx`, `copy-link.tsx` e `player.tsx`.
   - Criar `<ConfirmDialog>` acessível e aplicar em apagar lançamento/série, apagar meta, desvincular WhatsApp e desconectar banco.
3. **Acessibilidade (a11y):**
   - Implementar focus trap, foco inicial no título/fechar, retorno de foco no fechamento, bloqueio de scroll do `body` e `aria-labelledby` em `StreakDialog`, `SwipeSheet` e `<ConfirmDialog>`.
   - Corrigir `book-carousel.tsx:171-191`: remover `role="img"` do container que possui `<button>` filhos e dar área clicável mínima de `44×44px` aos indicadores (mantendo barra visual de `6px` dentro do botão).
   - Corrigir `aria-label` em todos os `role="img"` e traduzir `alt="done"` / `aria-label="todo"` para PT-BR (`"Concluído"`, `"Pendente"`).
4. **PWA Offline seguro (`apps/web/public/sw.js`):**
   - Adicionar página estática `/offline` pré-cacheada para falhas de navegação offline, **nunca** cacheando respostas de API nem HTML de rotas autenticadas (`(app)/*`).

### Critérios de aceite & testes

- Simular API offline → app exibe `app/(app)/error.tsx` amigável sem expor comando `pnpm dev`.
- Zero warnings de hidratação no console do navegador; navegação por teclado (`Tab` / `Escape`) funcional em todos os modais.

---

## T2.5 — Remoção de Vestígios de Protótipo, Textos Comerciais e Portabilidade LGPD

- [ ] Concluída

### Problema atual

1. Banners e mensagens de protótipo/dev: `apps/web/lib/api.ts:35` (`pnpm dev na raiz`), `conectar/page.tsx:226` (`BANK_GATEWAY=fake`), `mais/page.tsx:102` e `mais/sobre/page.tsx:43` (`prototypeBanner`), `pt-br.ts:225,341,352`.
2. Textos legais de pessoa física/homelab: `apps/web/app/(site)/legal.tsx:9` (Gmail pessoal), `privacidade/page.tsx:34,162,178,192-197` ("Tailscale", "servidor próprio", omite cookies `tostao-tema`/`tostao-inicio`/`tostao_oauth`), `termos/page.tsx:21,92`.
3. Landing diz "9 módulos" (`landing.tsx:145`) mas lista 8 (`L9-18`).
4. Desafio semanal de lições (`aprender/[licao]/player.tsx:112-126`) salva só em `localStorage` prometendo acompanhamento real; copy WIP em `pt-br.ts:1445`.
5. Sem recurso de **exportação de dados pessoais (LGPD art. 18, V)**.

### Correção técnica

1. **Limpeza comercial de copy & env vars:**
   - Substituir todas as mensagens prototipais/dev por copy profissional de suporte; mover e-mail DPO/suporte e dados da empresa (Razão Social, CNPJ, endereço, canal de contato) para variáveis configuráveis (`NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_DPO_EMAIL`, `NEXT_PUBLIC_LEGAL_ENTITY`, `NEXT_PUBLIC_LEGAL_CNPJ`) em `legal.tsx`, `privacidade/page.tsx` e `termos/page.tsx`.
   - Atualizar Política de Privacidade listando **todos** os cookies usados, os suboperadores reais (Pluggy Open Finance, DeepSeek com mascaramento PII, Resend, Meta WhatsApp Cloud API, infraestrutura cloud/Sentry) e os direitos do titular.
   - Corrigir a lista de módulos em `landing.tsx:9-18` para exibir todos os **9 módulos** (alinhado com `content/curriculo.md`).
   - Persistir desafios semanais aceitos em tabela `WeeklyChallenge` no banco (ou ajustar copy/fluxo honestamente até ativar auditoria automática no extrato) e revisar todas as lições para garantir que nenhuma exiba a mensagem `simulatorWip`.
2. **Exportação de dados LGPD (`GET /me/export`):**
   - Criar `ExportUserDataUseCase` em `apps/api/src/use-cases/export-user-data.ts` retornando JSON estruturado (download `tostao-meus-dados-YYYY-MM-DD.json`) com perfil, consentimentos, contas, transações, categorias, regras, orçamentos, plano financeiro, pessoas, metas, progresso de lições e histórico de chat (com rate limit de 2/dia por usuário e registro no `AuditLog`).
   - Adicionar botão **"Baixar meus dados (JSON)"** na tela `/perfil` (`apps/web/app/(app)/perfil/page.tsx`).

### Critérios de aceite & testes

- Grep em `apps/web` e `apps/api` retorna zero ocorrências de `"Fala com o Pedro"`, `"Tailscale"`, `"pnpm dev"`, `"protótipo"`, `"pedrohper.business@gmail.com"`.
- Teste unitário/integração de `GET /me/export` validando que exporta apenas dados do usuário autenticado e gera entrada no `AuditLog`.
