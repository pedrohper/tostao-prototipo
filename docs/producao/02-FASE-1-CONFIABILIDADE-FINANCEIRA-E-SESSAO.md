# Fase 1 (P1) — Sessão Comercial, E-mail, Atomicidade de Banco e Bugs Financeiros

> **Prioridade:** ALTA — Garante autenticação revogável, envio real de e-mails, proteção contra abuso via Redis, integridade transacional no PostgreSQL e correção de todos os bugs de cálculo/extrato.
> **Pré-requisito:** Fase 0 (`01-FASE-0-SEGURANCA-E-BLOQUEADORES.md`) concluída.

---

## T1.1 — Sessão Comercial: Access Token Curto + Refresh Token Rotativo Revogável

- [x] Concluída

### Problema atual

1. `apps/api/src/app.ts:60` emite JWT de `7d`, e `POST /sessions/refresh` (`apps/api/src/http/controllers/auth.ts:93-96`) renova indefinidamente sem checar se o usuário ainda existe, trocou senha ou saiu.
2. `verifyJwt` (`apps/api/src/http/middlewares/verify-jwt.ts:5-11`) não checa revogação; não existe logout real na API; `GET /sair` (`apps/web/app/sair/route.ts:5-9`) é vulnerável a Logout CSRF, apenas apaga o cookie local e usa `new URL('/entrar', request.url)` (pode redirecionar para `127.0.0.1` atrás de reverse proxy).
3. `apps/api/src/env.ts:8` aceita `JWT_SECRET` com apenas 16 chars; não fixa `algorithms: ['HS256']`.
4. `apps/web/proxy.ts:9-43` decodifica JWT sem validar assinatura (um cookie com `iat: 0` força `POST /sessions/refresh` em toda requisição), não tem timeout no `fetch`, não valida se `fresh` é não-vazio e não exclui `sw.js` no `matcher`.
5. `apps/web/lib/api.ts:38-41` redireciona 401 mesmo com `skipAuthRedirect: true` quando existe cookie expirado, e ~25 blocos `catch` em Server Actions e `app/(app)/layout.tsx:14-16` engolem `NEXT_REDIRECT`.

### Correção técnica

1. **Schema Prisma (`apps/api/prisma/schema.prisma`):**
   - Criar model `RefreshToken` (`id`, `userId`, `tokenHash @unique`, `familyId`, `expiresAt`, `revokedAt`, `replacedById`, `userAgent`, `ipAddress`, `createdAt`, `@@index([userId])`, `@@index([familyId])`, `@@index([expiresAt])`).
2. **Backend (`apps/api/src/app.ts`, `env.ts`, `http/controllers/auth.ts`, `use-cases/sessions.ts`):**
   - Exigir `JWT_SECRET` com `.min(32)` em `env.ts` (em `NODE_ENV=production`) e configurar `sign: { expiresIn: '15m', algorithm: 'HS256', iss: 'tostao-api', aud: 'tostao-web' }` + `verify: { algorithms: ['HS256'], allowedIss: 'tostao-api', allowedAud: 'tostao-web' }`.
   - Login (`POST /sessions`), cadastro (`POST /users`) e OAuth (`POST /auth/oauth/callback`) passam a retornar `{ accessToken, refreshToken }` (refresh token opaco `randomBytes(32).toString('base64url')`, salvo como SHA-256 em `refresh_tokens`, TTL 30 dias).
   - `POST /sessions/refresh`: aceita `{ refreshToken }` (sem exigir JWT ativo), valida no banco dentro de `$transaction`, **rotaciona** emitindo novo par e marcando o anterior como revogado. **Detecção de reuso:** se um refresh token já revogado for reapresentado, revogar toda a `familyId` imediatamente.
   - `POST /sessions/logout` (revoga o refresh token atual) e `POST /sessions/logout-all` (revoga todos do `userId`).
   - Ao redefinir senha (`ResetPasswordUseCase`) ou deletar conta (`DeleteAccountUseCase`), revogar todos os `RefreshToken` do usuário.
3. **Frontend (`apps/web/lib/session.ts`, `proxy.ts`, `lib/api.ts`, `app/sair/`):**
   - Armazenar `tostao_token` (`maxAge: 15m`) e `tostao_refresh` (`maxAge: 30d`), ambos `httpOnly: true`, `sameSite: 'lax'`, `secure: NODE_ENV === 'production'`.
   - Transformar saída em Server Action / `POST /api/auth/logout` (CSRF-safe) que chama `POST /sessions/logout` na API, limpa ambos os cookies e redireciona para `APP_PUBLIC_URL + '/entrar'`.
   - Corrigir `apps/web/proxy.ts`: adicionar `AbortSignal.timeout(5000)`, excluir `sw.js` do `matcher`, só disparar refresh quando `tostao_refresh` existir e o access token estiver expirado/próximo de expirar (<= 2 min), evitando amplificação por cookie forjado.
   - Corrigir `apps/web/lib/api.ts:38-41`: respeitar `if (init.skipAuthRedirect) throw new ApiError(...)` **antes** de checar `token`, e criar helper `rethrowIfRedirect(err)` usando `isRedirectError` (`next/dist/client/components/redirect-error` ou `unstable_rethrow`) aplicado em **todos** os `catch` de Server Actions e `app/(app)/layout.tsx`.

### Critérios de aceite & testes

- Testes de rotação de refresh token, detecção de reuso (revoga família inteira), logout e revogação após reset de senha.
- Teste de `api()` garantindo que `skipAuthRedirect: true` no login com cookie vencido não engole `NEXT_REDIRECT`.

---

## T1.2 — E-mail Transacional (Resend), Verificação de E-mail e Reset de Senha Self-Service

- [x] Concluída

### Problema atual

1. Não existe fluxo self-service de redefinição de senha (`apps/api/src/jobs/reset-link.ts:14` exige CLI manual no servidor e imprime token vivo no stdout).
2. `ResetPasswordUseCase.execute` (`apps/api/src/use-cases/password-reset.ts:45-50`) tem TOCTOU (lê, faz `bcrypt.hash`, depois chama `markUsed` fora de transação) e não invalida resets anteriores.
3. Cadastro por senha (`register-user.ts`) não verifica propriedade do e-mail (base do Pre-Account Takeover).
4. `AuthenticateUseCase` (`authenticate.ts:8-14`) sofre timing enumeration quando `!user || !user.passwordHash` e usa `bcryptjs` custo 10 sem limite de 72 bytes.

### Correção técnica

1. **Gateway de E-mail (`apps/api/src/gateways/email-gateway.ts`):**
   - Definir interface `EmailGateway` (`sendPasswordReset`, `sendEmailVerification`, `sendSecurityAlert`).
   - Implementar `ResendEmailGateway` (via `fetch` para `https://api.resend.com/emails` com `AbortSignal.timeout(10_000)` + env vars `EMAIL_PROVIDER=resend|fake`, `RESEND_API_KEY`, `EMAIL_FROM`).
   - Implementar `FakeEmailGateway` para `dev`/`test`.
2. **Verificação de E-mail:**
   - Adicionar model `EmailVerificationToken` (`id`, `userId`, `tokenHash @unique`, `expiresAt`, `usedAt`, `createdAt`, `@@index([userId])`).
   - Criar rotas `POST /auth/verify-email` e `POST /auth/resend-verification` (com rate limit) + telas `/verificar-email` em `apps/web`.
   - No `RegisterUserUseCase`, gerar token de 256 bits (TTL 24h) e disparar `emailGateway.sendEmailVerification`.
3. **Reset de Senha Self-Service:**
   - Criar `POST /password-resets` (recebe `{ email }`, responde sempre `202 Accepted` com mensagem neutra anti-enumeração, revoga tokens pendentes anteriores do usuário, gera token 256 bits TTL 1h e envia via `emailGateway.sendPasswordReset`).
   - Em `ResetPasswordUseCase` (`apps/api/src/use-cases/password-reset.ts`): executar resgate de forma **atômica** dentro de `prisma.$transaction`: `updateMany({ where: { tokenHash, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })`, verificando `count === 1` antes de atualizar `passwordHash` e revogar todos os `RefreshToken` do usuário.
   - Criar página `/esqueci-senha` em `apps/web/app/(auth)/esqueci-senha/page.tsx` e ligar o botão "Esqueci minha senha" de `apps/web/app/(auth)/auth-form.tsx:104-111` (removendo definitivamente _"Fala com o Pedro"_).
4. **Hardening de Senha (`apps/api/src/lib/password.ts`):**
   - Centralizar hash/verify (subir custo bcrypt para `12` ou migrar para `@node-rs/argon2` com suporte transparente de verificação de hashes `$2a$`/`$2b$` antigos + rehash no login).
   - Em `AuthenticateUseCase`: sempre rodar comparação contra hash dummy quando `!user || !user.passwordHash` para tempo constante.
   - Adicionar `.max(72)` (ou `.max(128)` se Argon2id) nos schemas `registerBody`, `loginBody` e `resetPasswordBody` (`packages/contracts/src/index.ts`).

### Critérios de aceite & testes

- Testes de concorrência em `password-reset.spec.ts`: 2 resgates simultâneos do mesmo token → apenas 1 sucede.
- Teste garantindo resposta idêntica de `POST /password-resets` para e-mail existente vs inexistente.
- Fluxo completo `/esqueci-senha` → `/redefinir-senha?token=...` funcionando com `FakeEmailGateway`.

---

## T1.3 — Rate Limiting Distribuído (Redis), Helmet, Headers HTTP e Error Handler

- [x] Concluída

### Problema atual

1. `LoginLimiter` (`apps/api/src/http/login-limiter.ts:1-33`) guarda estado em `Map` local (OOM por e-mails aleatórios, lockout DoS por e-mail da vítima, zera em restart, não escala) e protege apenas `POST /sessions`.
2. Ausência total de `@fastify/helmet`, `Cache-Control: no-store`, `trustProxy`, `bodyLimit` reduzido e redação de segredos no Pino (`apps/api/src/app.ts:58`, `server.ts:73`).
3. `apps/web/next.config.ts` não configura nenhum header de segurança (CSP, HSTS, X-Frame-Options, `poweredByHeader: false`).
4. `apps/api/src/http/error-handler.ts:6-17` converte erros 4xx do Fastify (JSON inválido, `413` body too large) e erros do Prisma (`P2002`, `P2025`, `P2003`) em `500`.

### Correção técnica

1. **Redis cliente compartilhado (`apps/api/src/lib/redis.ts` + `env.ts`):**
   - Adicionar `REDIS_URL` em `env.ts` e `.env.example` (com fallback em memória apenas para `NODE_ENV === 'test'`).
2. **Rate limiting (`@fastify/rate-limit` com Redis):**
   - Remover `apps/api/src/http/login-limiter.ts`.
   - Configurar limite global padrão (ex.: 120 req/min por IP/userId) e limites rígidos por rota:
     - `POST /sessions`: 10/15min por `IP + email` (evita lockout puro por e-mail) e 30/15min por IP.
     - `POST /users`, `POST /password-resets`, `POST /password-resets/redeem`, `POST /auth/resend-verification`: 5/15min por IP.
     - `POST /me/delete`: 5/15min por `userId`.
     - `POST /friends`: 10/15min por `userId`.
     - `POST /transactions/auto-categorize`: 5/dia por `userId`.
     - `POST /imports`, `POST /connections/:id/sync`, `POST /tostao/auto/check`: 10/15min por `userId`.
     - `POST /whatsapp/webhook`: 60/min por IP (além de rate-limit por remetente `from` no vínculo).
3. **Hardening Fastify (`apps/api/src/app.ts`, `server.ts`):**
   - Registrar `@fastify/helmet` e hook adicionando `Cache-Control: no-store, private` em rotas autenticadas.
   - Configurar `trustProxy: true` (ou lista configurável via `TRUST_PROXY`), `bodyLimit: 256 * 1024` global (mantendo override de 5 MiB somente em `POST /imports`), `requestTimeout: 30_000`, `connectionTimeout: 10_000`.
   - Configurar CORS explícito (`origin` permitindo lista de origens de `WEB_ORIGIN`, `methods`, `allowedHeaders`, `credentials: true`).
   - Configurar Pino `redact: ['req.headers.authorization', 'req.headers["x-tostao-secret"]', 'req.headers.cookie', '*.password', '*.token', '*.refreshToken', '*.apiKey']`.
4. **Security Headers Next.js (`apps/web/next.config.ts`):**
   - `poweredByHeader: false`.
   - Adicionar `headers()` com `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security` (em prod) e `Content-Security-Policy` compatível com Next.js + Pluggy Connect SDK (`cdn.pluggy.ai`, `connect.pluggy.ai`).
   - Garantir `secure: process.env.NODE_ENV === 'production'` no cookie `tostao-tema` (`apps/web/lib/theme-actions.ts:8-12`).
5. **Error Handler (`apps/api/src/http/error-handler.ts`):**
   - Tratar `error.statusCode` de erros nativos Fastify (`400`, `413`, `415`, `429`).
   - Tratar `Prisma.PrismaClientKnownRequestError`: `P2002` → `409 Conflict`, `P2025` → `404 Not Found`, `P2003` → `400 Bad Request`, `22003` → `400 Bad Request`.

### Critérios de aceite & testes

- Testes em `apps/api/src/app.spec.ts` validando headers Helmet, `Cache-Control: no-store`, JSON malformado retornando `400` (não `500`), payload grande retornando `413` e rate-limit retornando `429`.

---

## T1.4 — Evolução do Schema PostgreSQL, Atomicidade (`$transaction`) e Tabelas LGPD/Audit

- [x] Concluída

### Problema atual

1. Valores monetários em `Int` (32-bit, teto R$ 21,4M), sem coluna `currency` e sem `.max()` em vários contratos Zod (`manualTransactionBody`, `updateTransactionBody`, `createManualAccountBody`).
2. `DateTime` sem `TIMESTAMPTZ`, `User` sem `timezone`, `UserActivity.day` como `String`.
3. Strings livres sem `enum` PostgreSQL e `FinancialPlan.data` sem `schemaVersion`.
4. Apenas 1 `$transaction` no repositório inteiro: `RegisterUser`, `AuthenticateOAuth`, `CreateManualTransaction`, `reconcileManualEntries`, `DeleteCategory`, `DeletePerson`, `SetGoal`/`GoalDeposit`, `toggleUrubuStep`, `PrismaTostaoAutoRepository.upsertPending`, `PrismaCategoryRulesRepository.upsert`, `seed.ts` estão todos sujeitos a estados corrompidos e lost updates.
5. `Account -> Transaction` (`schema.prisma:158`) usa `onDelete: Cascade`, apagando transações manuais ligadas a uma conta ao desconectar o banco.
6. `Invite.usedBy` (`schema.prisma:229`) usa `SetNull` e use cases checam `!invite.usedById` em vez de `!invite.usedAt`, reabrindo convites já usados quando o convidado deleta a conta.
7. Sem tabelas `UserConsent`, `AuditLog`, `OutboxJob` (para retry de revogação Pluggy pós-delete de conta), sem `createdAt`/`updatedAt` padronizados e sem `CHECK` constraints / unicidade case-insensitive.
8. `apps/api/package.json:41-43` usa `package.json#prisma` (deprecated para Prisma 7).

### Correção técnica

1. **Migrations Prisma estruturadas (em passos seguros sem perda de dados):**
   - Migrar colunas monetárias (`balance_in_cents`, `credit_limit_in_cents`, `amount_in_cents`, `limit_in_cents`) para `BigInt` (com serialização JSON segura para `number` nos contratos dentro de `Number.MAX_SAFE_INTEGER` e teto Zod `.max(10_000_000_000)` = R$ 100 milhões). Adicionar `currency String @default("BRL")` em `Account` e `Transaction`.
   - Migrar colunas `DateTime` para `@db.Timestamptz(3)`, `UserActivity.day` para `@db.Date` e adicionar `User.timezone String @default("America/Sao_Paulo")`.
   - Criar `enum` PostgreSQL para `OAuthProvider`, `ConnectionStatus`, `AccountType`, `CategoryKind`, `ChatRole`, `ChatChannel`, `BattleKind`, `BattleStatus`, `InsightSeverity`, `InsightStatus`.
   - Adicionar `CHECK` constraints via SQL migration: `category_budgets.limit_in_cents > 0`, `transactions.amount_in_cents <> 0`, `friendships.user_id <> friendships.friend_id`, `tribunal_votes.choice >= 0`.
   - Garantir unicidade case-insensitive via índices únicos funcionais: `LOWER(email)` em `users`, `(user_id, LOWER(name))` em `people`, `(COALESCE(user_id, ''), LOWER(name))` em `categories`, e `UNIQUE NULLS NOT DISTINCT (user_id, pattern)` em `category_rules`.
   - Alterar `Transaction.account` (`schema.prisma:158`) para `onDelete: SetNull`, garantindo em `DisconnectBankUseCase` a exclusão explícita apenas das transações bancárias (`externalId: { not: null }`) enquanto transações manuais ficam preservadas com `accountId: null`.
   - Corrigir reuso de convites: checar `!invite.usedAt && !invite.usedById` em `register-user.ts:23`, `authenticate-oauth.ts:94`, `invites.ts:25`, com `updateMany({ where: { code, usedAt: null }, ... })` atômico; mudar `Invite.createdBy` para `onDelete: SetNull` (com `createdById String?`).
   - Adicionar `UserConsent`, `AuditLog` e `OutboxJob` (usado para enfileirar `pluggy.deleteItem` em caso de falha transitória durante `DeleteAccountUseCase`).
   - Adicionar `version Int @default(1)` em `FinancialPlan` e `Battle` para lock otimista contra lost updates.
   - Migrar configuração `seed` para `apps/api/prisma.config.ts` e envolver `apps/api/prisma/seed.ts:11-12` em `prisma.$transaction`.
2. **Atomicidade (`$transaction`) nos Use Cases e Repositórios:**
   - Aplicar `$transaction` em: `RegisterUserUseCase`, `AuthenticateOAuthUseCase`, `CreateManualTransactionUseCase` (usando `createMany`), `reconcileManualEntries`, `DeleteCategoryUseCase` (também adicionando `userId` em `clearCategory`/`deleteByCategory`), `DeletePersonUseCase`, `DisconnectBankUseCase`, `PrismaTostaoAutoRepository.upsertPending` (trocar check-then-insert por `upsert` atômico), `PrismaCategoryRulesRepository.upsert`.
   - Validar `monthQuery` e `goalBody.deadline` (`packages/contracts/src/index.ts:111,440`) com regex `/^\d{4}-(0[1-9]|1[0-2])$/` (bloqueando mês `00` e `13..99`). Adicionar `.max()` em todas as strings/números sem teto (`description`, `name`, `amountInCents`, `balanceInCents`, `advance <= salary`, `tribunalVoteBody.choice` `0..1`, UUID em params `:id`).

### Critérios de aceite & testes

- `prisma migrate deploy` e `prisma migrate diff` passando limpos.
- Testes de regressão provando: desconectar banco mantém transações manuais; deletar convidado não reabre convite; `month="2026-13"` e `amountInCents=999999999999` retornam `400` (não `500`).

---

## T1.5 — Corrigir Bugs Críticos de Lógica Financeira (Sync, Saldo, Transferências, Fuso, CSV/OFX, Juros)

- [x] Concluída

### Lista de bugs comprovados a corrigir (com arquivos exatos)

1. **Sync antes das 12h BRT descarta transações date-only do dia atual:**
   - **Arquivos:** `apps/api/src/gateways/pluggy-bank-gateway.ts:51-57` (`pluggyDate`), `apps/api/src/use-cases/sync-bank-connection.ts:78,189`.
   - **Correção:** Comparar transações date-only contra o **fim do dia civil** (`endOfDay(now, userTimezone)`) em vez de `<= now` em timestamp absoluto; aplicar o mesmo em `openBill` (Nubank).

2. **Sync e importação revertem transferências internas manuais e quebram pares na borda da janela:**
   - **Arquivos:** `apps/api/prisma/schema.prisma:148`, `apps/api/src/use-cases/sync-bank-connection.ts:113-123`, `apps/api/src/use-cases/import-statement.ts:91-101`, `apps/api/src/services/internal-transfers.ts:5-19,34-71`, `apps/api/src/use-cases/tostao-auto.ts:25,457-465`, `apps/api/src/use-cases/update-transaction.ts:25`.
   - **Correção:**
     - Adicionar `internalTransferManual Boolean? @map("internal_transfer_manual")` em `Transaction` (`true` = usuário marcou; `false` = usuário desmarcou; `null` = automático).
     - `detectInternalTransfers` nunca sobrescreve transações com `internalTransferManual !== null`.
     - Alinhar `KEYWORDS` em `internal-transfers.ts` com `INTERNAL_HINT` (`MESMA TITULARIDADE`, `PGTO FATURA`).
     - Ampliar janela de pareamento entre contas para `3 * ONE_DAY` (compensação de boleto/TED) e ampliar `window` do sync para incluir `CARD_BACK_DAYS` + margem de 3 dias extras na borda inferior (sem desmarcar lados cujo par ficou fora da janela).

3. **Saldo histórico distorcido por lançamentos manuais + saldo de contas manuais nunca atualizado:**
   - **Arquivos:** `apps/api/src/use-cases/get-month-summary.ts:48-65`, `apps/api/src/use-cases/create-manual-transaction.ts:40-71`, `apps/api/src/use-cases/update-transaction.ts`, `apps/api/src/use-cases/delete-transaction.ts`.
   - **Correção:**
     - Em `GetMonthSummaryUseCase` (`balanceAtMonthEnd`): para contas conectadas (Pluggy/Import), desfazer apenas movimentações bancárias (`externalId !== null`); para contas manuais (`connection.itemId.startsWith('manual:')`), atualizar `account.balanceInCents` atomicamente dentro de `$transaction` ao criar/editar/excluir lançamentos manuais associados (quando `occurredAt <= now`).

4. **Conciliação de lançamentos manuais apagando gastos reais:**
   - **Arquivos:** `apps/api/src/services/reconcile-manual.ts:39-57`.
   - **Correção:** Exigir compatibilidade de conta (nunca conciliar se o manual tem `accountId !== null` diferente da transação bancária, e não apagar automaticamente dinheiro vivo `accountId === null` sem correspondência forte de descrição ≥ 2 tokens ou > 5 chars não-genéricos); filtrar `!t.isInternalTransfer` em `isBankEntry`; bloquear tokens genéricos isolados (`mercado`, `casa`, `loja`, `pago`, `pix`).

5. **Bugs de fuso horário (`America/Sao_Paulo` vs UTC) e relógio injetado ignorado:**
   - **Arquivos:** `apps/api/src/lib/month.ts`, `apps/api/src/use-cases/get-month-summary.ts:90-101`, `apps/api/src/use-cases/financial-plan.ts:442,467,599,623,626`, `apps/api/src/use-cases/engagement.ts:190-203`, `apps/api/src/services/subscriptions.ts:24,69,74,84-96,117-124`, `apps/api/src/use-cases/ask-tostao.ts:115`.
   - **Correção:**
     - Substituir aritmética hardcoded `-3 * 3600_000` por helpers usando `Intl.DateTimeFormat` com `timeZone` do usuário (default `America/Sao_Paulo`).
     - Corrigir `nextDueDate` (`get-month-summary.ts:90-101`) para usar a data civil no fuso do usuário (não `getUTCDate`).
     - Corrigir leitura de `a.dueDate` em `ForecastUseCase` (`L599`, usando a data calendário UTC em que Pluggy armazena `YYYY-MM-DD`, sem subtrair 3h) e fazer `EngagementUseCase.reminders` (`L190-203`) usar `nextDueDate`.
     - Propagar `() => now` ao instanciar `GetMonthSummaryUseCase` dentro de `ForecastUseCase` (`L467`) e `AskTostaoUseCase` (`L115`).
     - Em `ForecastUseCase`: corrigir `fixedLeft` para dia 31 em meses mais curtos (`Math.min(f.day, daysInMonth) > today`), checar `x.installmentsLeft !== 0` em `subsLeft`, incluir `plan.salary.advance`, corrigir `pendingInstallments` (`L354`) quando `9/10` e `10/10` caem no mesmo mês e validar `n >= i.n` em `installmentsInMonth` (`L378`).
     - Em `subscriptions.ts`: usar fuso do usuário ao calcular mês inicial, adicionar flag `/i` em `INSTALLMENT`, diferenciar datas `DD/12` de parcelas `x/12`, e incluir faixa de valor na `key` quando `splitByAmount` dividir planos distintos do mesmo lojista (evitando falso positivo de duplicata e colisão em `IgnoredSubscription`/`dedupeKey`).

6. **Contas ocultas vazando & `personId` perdendo `isInternalTransfer`:**
   - **Arquivos:** `apps/api/src/use-cases/list-subscriptions.ts:10-27`, `apps/api/src/use-cases/financial-plan.ts:518`, `apps/api/src/use-cases/categorize-transaction.ts:24-25`, `apps/api/src/use-cases/financial-plan.ts:110-116`, `apps/api/src/use-cases/create-manual-transaction.ts:51-52`.
   - **Correção:** Filtrar `account.hidden === false` em `ListSubscriptionsUseCase` e `ForecastUseCase`; ao sair da categoria `nao-conta`, preservar `isInternalTransfer = true` se `tx.personId !== null`; em `create-manual-transaction.ts`, impedir parcelamento que produza parcelas com `0` centavos (`Math.abs(amountInCents) < times`).

7. **Importação OFX/CSV (`apps/api/src/services/statement-parser.ts` & `import-statement.ts`):**
   - **Correção:**
     - `parseCsv` (`L196`): não inverter sinal cegamente quando `isCard: true` se o arquivo já usa colunas separadas Crédito/Débito ou já possui maioria de compras negativas (detectar convenção de sinal ou expor opção explícita).
     - `parseAmount` (`L40-46`): tratar separador de milhar BR sem decimais (`"1.500"` → `150000` centavos; `"1.200.000"` → `120000000` centavos).
     - `parseDate` (`L23-24,50-61`): validar calendário real e `Number.isNaN(d.getTime())` (rejeitar `"99/99/2026"`).
     - Corrigir detecção de coluna `"Valor Débito/Crédito"` (`L163-165`) para não casar simultaneamente em `iCredit` e `iDebit`.
     - Desambiguar `FITID` duplicado no OFX (ex.: BB/Caixa com `FITID=0`) combinando com data+valor+índice.
     - Normalizar sinal de `BALAMT` em `<CCSTMTRS>` (cartão) e validar `parsed.transactions.length > 0` **antes** de criar `BankConnection`/`Account` em `import-statement.ts:50-87`.

8. **Matemática financeira (`packages/contracts/src/juros.ts:90-129`):**
   - Em `compararCompra`: calcular alíquota regressiva de IR **por parcela/mês de resgate** (não aplicar a alíquota do prazo final a todos os meses) e validar `parcelas >= 1`.
   - Em `mesesParaJuntar`: suportar `porMesInCents === 0` quando `jaTemInCents > 0` cresce por juros compostos, e calcular IR pelo prazo real encontrado. Criar suíte de testes dedicada `packages/contracts/src/juros.spec.ts`.

---

## T1.6 — Corrigir Bugs em `daily-sync`, WhatsApp Parser, Tostão Auto e Gamificação

- [x] Concluída

### Correções pontuais

1. **`apps/api/src/jobs/daily-sync.ts:8,43`:** filtrar `!c.itemId.startsWith('import:') && !c.itemId.startsWith('manual:')` em `syncAllConnections` e `isSyncStale` (corrige sync global disparado a cada restart). Implementar política de retry/backoff controlado para conexões em `ERROR` (ex.: tentar novamente após 24h por até 3 ciclos antes de marcar como `RECONNECT_REQUIRED`).
2. **`apps/api/src/services/parse-expense.ts:11-45`:** ignorar mensagens que terminem com `?` ou contenham interrogativos (`tá muito`, `quanto`, `será`, `posso`, `compensa`) para evitar gravar despesas falsas em perguntas no WhatsApp.
3. **`apps/api/src/use-cases/tostao-auto.ts:204-208,365-377` e `repositories/prisma/index.ts:605-627`:** permitir reabertura de insights mensais (`month_shortfall`, `next_month_tight`, `budget_alert`, `goal_off_track`) quando o usuário voltar a ultrapassar o limite; não reabrir `uncategorized_batch` quando apenas a transação mais recente for categorizada sem novas pendentes; iterar sobre **todas** as metas em `forecast.goals` (não só `forecast.goal`).
4. **Gamificação (`apps/api/src/use-cases/games.ts`, `engagement.ts`, `http/controllers/engagement.ts`):**
   - `startTigrinho` (`games.ts:115-127`): não sobrescrever batalha `vencida`; usar início do dia civil na detecção de apostas do Dia 1; parar contador `day` quando `status === 'perdida'`; unificar `isBet` com `BET_HINT`.
   - `TribunalVote` (`schema.prisma:297`, `games.ts`): incluir `weekKey` na PK (`@@id([userId, caseId, weekKey])`) e impedir alterar voto após já votado (`ConflictError`).
   - `EngagementUseCase`: unificar cálculo de `streakDays` com `ListLessonProgressUseCase`; bloquear farm de XP em `POST /activity` (só aceitar tipos elegíveis para missões reais do dia ou derivar automaticamente no backend); implementar pedido/aceite de amizade em vez de amizade unilateral imediata por código `TOST-XXXXX`.

### Critérios de aceite & testes

- Specs dedicadas criadas para `sync-bank-connection.spec.ts`, `get-month-summary.spec.ts`, `reconcile-manual.spec.ts`, `statement-parser.spec.ts`, `juros.spec.ts`, `daily-sync.spec.ts` e `tostao-tools.spec.ts`, todas passando.
