# Fase 0 (P0) — Bloqueadores Críticos de Segurança, LGPD e Dados

> **Prioridade:** MÁXIMA — Nenhum usuário comercial pode entrar em produção com qualquer item desta fase aberto.
> **Referência:** Consulte [`00-INDICE.md`](./00-INDICE.md) para decisões arquiteturais e comandos de validação.

---

## T0.1 — Fechar BOLA / Sequestro de Conexões Pluggy e Path Injection

- [x] Concluída

### Problema atual

1. `BankConnection` usa `@@unique([userId, itemId])` (`apps/api/prisma/schema.prisma:81`), permitindo que dois usuários vinculem o mesmo `itemId` da Pluggy.
2. `ConnectBankUseCase.execute` (`apps/api/src/use-cases/connect-bank.ts:16-24`) não valida se o `itemId` já pertence a outro usuário nem se `item.clientUserId === userId` na Pluggy. Um usuário mal-intencionado que conheça o `itemId` de outro cliente importa todo o extrato dele e pode apagar o Item na Pluggy via `DELETE /connections/:id`.
3. `PluggyBankGateway.fetchItem` (`apps/api/src/gateways/pluggy-bank-gateway.ts:220-223`) concatena `'/items/' + itemId` **sem `encodeURIComponent`**, e `connectBankBody` (`packages/contracts/src/index.ts:91-98`) aceita qualquer string com `>= 8` chars (fallback `?? v`), permitindo path injection (`../`) com o `X-API-KEY` da aplicação.
4. `GET /me` (`apps/api/src/http/controllers/auth.ts:134`) expõe o `itemId` bruto do provedor ao cliente.
5. `createConnectToken` (`apps/api/src/gateways/pluggy-bank-gateway.ts:210`) não desativa conectores sandbox em produção.

### Correção técnica

1. **Schema & Migration (`apps/api/prisma/schema.prisma`):**
   - Criar índice único parcial no PostgreSQL garantindo unicidade global para itens de Open Finance (ex.: `CREATE UNIQUE INDEX bank_connections_pluggy_item_id_key ON bank_connections (item_id) WHERE item_id NOT LIKE 'import:%' AND item_id NOT LIKE 'manual:%';`).
2. **Contrato (`packages/contracts/src/index.ts:91-98`):**
   - Rejeitar strings que comecem com `import:` ou `manual:` ou contenham `/`, `..`, `?`, `#`. Quando `BANK_GATEWAY === 'pluggy'`, exigir UUID v4 válido no `ConnectBankUseCase` / gateway.
3. **Gateway (`apps/api/src/gateways/pluggy-bank-gateway.ts`):**
   - Usar `encodeURIComponent(itemId)` em `fetchItem` (`L221`).
   - Fazer `fetchItem` retornar `{ institution, clientUserId, isSandbox }` (extraindo `data.clientUserId` e `data.connector?.isSandbox`).
   - Em `createConnectToken` (`L210`), enviar `includeSandbox: process.env.NODE_ENV !== 'production'` (ou via flag explícita de env `PLUGGY_INCLUDE_SANDBOX=false` em prod).
   - Remover a mensagem prototipal `"O trial do dashboard ainda tá ativo?"` (`L214`).
4. **Use case (`apps/api/src/use-cases/connect-bank.ts`):**
   - Checar no repositório `findByItemId(itemId)` (global): se já existir para outro `userId`, lançar erro `ForbiddenError` / `ConflictError` sem revelar o dono.
   - Em modo Pluggy, exigir que `item.clientUserId === userId` (e rejeitar `item.isSandbox === true` quando em produção).
5. **Controller (`apps/api/src/http/controllers/auth.ts:134`):**
   - Remover `itemId` do payload de `GET /me` (retornar apenas `id`, `institution`, `status`, `lastSyncedAt`, `isManual`/`isImport` derivado). Atualizar tipo `meResponse` em `packages/contracts/src/index.ts` e consumidores em `apps/web`.

### Critérios de aceite & testes

- Teste unitário em `apps/api/src/use-cases/connect-bank.spec.ts`: usuário B tentando conectar `itemId` de usuário A falha (tanto por banco quanto por `clientUserId` divergente); `itemId` com `../` é rejeitado.
- Teste em `apps/api/src/gateways/pluggy-bank-gateway.spec.ts`: valida `encodeURIComponent`, leitura de `clientUserId` e `includeSandbox: false` em produção.
- `GET /me` não retorna `itemId`.

---

## T0.2 — Fechar SSRF e Sequestro de Inscrição em Web Push

- [x] Concluída

### Problema atual

1. `pushSubscriptionBody` (`packages/contracts/src/index.ts:656-659`) aceita qualquer `z.string().url()`, inclusive `http://127.0.0.1:3334/...` ou IPs internos da rede Docker (`172.18.0.x`), permitindo SSRF quando `WebPushGateway.send` (`apps/api/src/gateways/push-gateway.ts:40-54`) dispara `webpush.sendNotification` (que ainda não possui `timeout`).
2. `PrismaEngagementRepository.savePush` (`apps/api/src/repositories/prisma/index.ts:491-497`) faz `upsert` por `endpoint` sobrescrevendo `userId: sub.userId`, permitindo que um usuário roube a inscrição Push de outro.

### Correção técnica

1. **Validação de endpoint (`packages/contracts/src/index.ts` + helper `apps/api/src/lib/push-endpoint.ts`):**
   - Exigir protocolo `https:` (sem porta customizada, sem credenciais na URL).
   - Validar host contra allowlist estrita de serviços Web Push oficiais:
     - `fcm.googleapis.com`
     - `updates.push.services.mozilla.com`
     - `web.push.apple.com` e `*.push.apple.com`
     - `*.notify.windows.com`
     - `*.push.services.mozilla.com`
   - Validar `keys.p256dh` e `keys.auth` como base64url com tamanho mínimo/máximo adequado.
2. **Ownership (`apps/api/src/repositories/prisma/index.ts:491-497` e `apps/api/src/http/controllers/engagement.ts:90-94`):**
   - Antes de atualizar um `endpoint` existente, verificar se pertence ao mesmo `userId`. Se pertencer a outro usuário, lançar `ForbiddenError` (403) ou usar chave composta `(userId, endpoint)` / rejeitar sobrescrita cross-tenant.
3. **Timeout no gateway (`apps/api/src/gateways/push-gateway.ts:45`):**
   - Passar `{ timeout: 10_000, TTL: 3600 }` em `webpush.sendNotification(...)` e evitar mutar estado global (`setVapidDetails`) dentro do construtor usando opções `vapidDetails` por envio.

### Critérios de aceite & testes

- Testes bloqueando `http://127.0.0.1:3334`, `http://169.254.169.254`, `https://evil.com/push` e aceitando URLs válidas de FCM/Mozilla/Apple/WNS.
- Teste garantindo que usuário B não consegue sobrescrever `endpoint` registrado pelo usuário A.

---

## T0.3 — Corrigir Vulnerabilidades Críticas de OAuth (Pre-Account Takeover, `redirectUri`, `state`/`PKCE`)

- [x] Concluída

### Problema atual

1. **Pre-Account Takeover:** `RegisterUserUseCase` (`apps/api/src/use-cases/register-user.ts:15-32`) não verifica e-mail. Se um atacante pré-criar `vitima@gmail.com` com senha conhecida, `AuthenticateOAuthUseCase` (`apps/api/src/use-cases/authenticate-oauth.ts:64-76`) vincula silenciosamente o login Google da vítima àquela conta **mantendo a senha do atacante ativa**.
2. **Claim incorreta:** `oauth-gateway.ts:192` faz `isTruthyFlag(payload.email_verified) || isTruthyFlag(payload.is_private_email)` — `is_private_email` não garante `email_verified`.
3. **Bypass de `redirectUri`:** `assertAllowedRedirectUri` (`apps/api/src/http/controllers/auth.ts:22-42`) sempre libera `localhost`, `127.0.0.1` e `webOrigin === '*'`, mesmo em produção. No frontend, `resolvePublicOrigin` (`apps/web/lib/oauth.ts:29-44`) confia cegamente em `x-forwarded-host` (Host Header Injection).
4. **Sem validação server-side de `state`/`nonce`/`PKCE`:** `POST /auth/oauth/callback` (`auth.ts:84-90`) recebe `expectedNonce` e `codeVerifier` do body do cliente sem vínculo server-side; PKCE é opcional no Google e ausente na Apple; cookie `tostao_oauth` (`apps/web/app/api/auth/[provider]/start/route.ts:62`) não é assinado com HMAC; `callback/route.ts:54` não aplica `sanitizeFrom` no `cookie.from` e aceita GET/POST indistintamente para qualquer provedor (`L120, L131`).
5. **Claims OIDC incompletas (`apps/api/src/gateways/oauth-gateway.ts:168-195`):** faltam validações de `nbf`, `iat`, `azp` (quando `aud` é array) e `AbortSignal.timeout` em todos os `fetch` (`L285, L325, L363`).

### Correção técnica

1. **Verificação de e-mail & regra segura de auto-linking:**
   - Adicionar `emailVerifiedAt DateTime? @map("email_verified_at")` em `User` (`apps/api/prisma/schema.prisma:14-20`). Contas criadas via OAuth com `email_verified === true` já nascem com `emailVerifiedAt = now`.
   - Em `AuthenticateOAuthUseCase`: só permitir auto-linking por e-mail se **`existingUser.emailVerifiedAt !== null`** (ou se `existingUser.passwordHash === null` — conta já exclusivamente social). Caso exista conta com senha e `emailVerifiedAt === null`, **não vincular silenciosamente**: rejeitar com erro amigável instruindo a confirmar o e-mail ou entrar com senha primeiro (ou exigir reautenticação).
2. **OIDC & Gateway (`apps/api/src/gateways/oauth-gateway.ts`):**
   - Validar estritamente `isTruthyFlag(payload.email_verified)` (`L192`).
   - Validar `nbf` (com skew de 60s), `azp` quando `Array.isArray(payload.aud)`, e adicionar `AbortSignal.timeout(10_000)` em todos os `fetch` (`L285, L325, L363`).
   - Adicionar cooldown de cache-miss (ex.: 60s) para `kid` desconhecido no JWKS (`L355-372`) para evitar amplificação de requests.
   - Usar comparação constant-time via hash SHA-256 em `safeEqualString` (`L83-88`) sem leak de tamanho.
   - Tornar PKCE (S256) obrigatório no Google e suportado/exigido onde aplicável.
3. **Binding server-side de `state` / `nonce` / `codeVerifier`:**
   - Em `POST /auth/oauth/start`: gerar e armazenar `{ provider, nonce, codeVerifier, redirectUri, inviteCode, from }` no Redis (ou tabela temporária `oauth_states` com TTL 5 min se Redis ainda estiver sendo plugado na Fase 1, preferencialmente já via Redis) indexado por `state` de 256 bits (`randomBytes(32).toString('base64url')`).
   - Em `POST /auth/oauth/callback`: exigir `state` + `code` (sem aceitar `expectedNonce`/`codeVerifier` arbitrários do body), consumir o registro de forma **single-use** (`GETDEL` no Redis ou `DELETE ... RETURNING`) e validar `provider` e `redirectUri` salvos.
4. **Allowlist estrita de `redirectUri` e Origem Pública:**
   - Em `apps/api/src/http/controllers/auth.ts:22-42`: remover `webOrigin === '*'` e só permitir `localhost`/`127.0.0.1` quando `NODE_ENV === 'development' || NODE_ENV === 'test'`. Em produção, validar correspondência exata contra `${WEB_ORIGIN}/api/auth/${provider}/callback` (HTTPS obrigatório).
   - Em `apps/web/lib/oauth.ts:29-44`: usar `APP_PUBLIC_URL` (env server-side fixa) em produção em vez de confiar em `x-forwarded-host`.
   - Em `apps/web/app/api/auth/[provider]/callback/route.ts`: restringir Google a `GET` e Apple a `POST`; aplicar `sanitizeFrom(cookie?.from)`; deletar cookie `tostao_oauth` com os mesmos atributos (`sameSite: 'none', secure: true` no Apple); limitar tamanho de `inviteCode` (`<= 32` chars).

### Critérios de aceite & testes

- Teste em `authenticate-oauth.spec.ts`: atacante cadastra `vitima@gmail.com` sem verificar e-mail → vítima tenta OAuth Google → **não** vincula à conta do atacante.
- Teste: replay do mesmo `state` ou `code` falha; `redirectUri` com `localhost` falha quando `NODE_ENV=production`; `is_private_email: true` com `email_verified: false` é rejeitado.

---

## T0.4 — Corrigir Sequestro de Conta no Vínculo WhatsApp

- [x] Concluída

### Problema atual

1. `WhatsAppLinkUseCase.createCode` (`apps/api/src/use-cases/whatsapp.ts:45-55`) gera código numérico de apenas 6 dígitos, salvo em **texto claro** (`schema.prisma:279`), válido por 15 min, sem retry real em colisão e sem rate-limit.
2. `HandleWhatsAppMessageUseCase.execute` (`apps/api/src/use-cases/whatsapp.ts:96-107`) aplica `/\b(\d{6})\b/` em **qualquer mensagem** (antes mesmo de checar se o telefone já está vinculado!). Qualquer colisão/brute-force chama `repos.whatsapp.link(link.userId, from, now)` (`repositories/prisma/index.ts:425-434`), desvinculando silenciosamente a conta original e dando acesso total aos dados financeiros da vítima.

### Correção técnica

1. **Entropia e hash (`apps/api/prisma/schema.prisma:276-286` + `apps/api/src/use-cases/whatsapp.ts`):**
   - Trocar código de 6 dígitos por código alfanumérico de alta entropia (ex.: `TOST-` + 12 caracteres base32/hex = ≥60 bits) e armazenar apenas `codeHash` (SHA-256) no banco (nunca o código em texto claro).
   - Reduzir TTL para **5 minutos** (`codeExpiresAt`) e invalidar código anterior ao gerar um novo.
   - No app web (`apps/web/app/(app)/whatsapp/code-card.tsx`), facilitar com botão "Abrir no WhatsApp" (`https://wa.me/${number}?text=VINCULAR%20${code}`) + botão copiar.
2. **Parsing seguro e proteção contra re-vínculo (`apps/api/src/use-cases/whatsapp.ts:96-107`):**
   - Só tentar vinculação quando a mensagem começar explicitamente com `VINCULAR <CODIGO>` (case-insensitive, trim).
   - Se o número `from` **já estiver vinculado** a outro usuário, **não desvincular automaticamente** — responder orientando desvincular primeiro pelo app.
   - Aplicar rate limit estrito por número `from` (máximo 5 tentativas falhas em 15 minutos) antes de consultar o banco.
3. **Segurança dos webhooks (`apps/api/src/http/controllers/whatsapp.ts` + `whatsapp-gateway.ts`):**
   - Substituir `===` em `GET /whatsapp/webhook` (`whatsapp.ts:79`) por comparação constant-time baseada em SHA-256 (corrigir também `sameSecret` em `whatsapp-gateway.ts:158-163` para não vazar `length`).
   - Validar payloads de `GET /whatsapp/webhook`, `POST /whatsapp/webhook` e `POST /whatsapp/n8n` com schemas Zod (limitando tamanho de `text` e `hub.challenge`).
   - Em `downloadMedia` (`whatsapp-gateway.ts:99-116`), validar que `meta.url` é `https:` de host oficial da Meta (`*.fbsbx.com`, `graph.facebook.com`) e impor limite máximo de tamanho (ex.: 10 MB via stream/content-length) antes de carregar em memória.
   - Remover montagem duplicada de `POST /whatsapp/n8n` no `app` principal (`whatsapp.ts:109`) — manter apenas na bridge isolada (quando `N8N_LISTEN_HOST` estiver configurado).

### Critérios de aceite & testes

- Testes em `apps/api/src/use-cases/whatsapp.spec.ts`: mensagem comum contendo 6 dígitos não vincula conta; número já vinculado não é sequestrado/trocado por `VINCULAR`; código errado >5x sofre bloqueio; código armazenado apenas como hash; `downloadMedia` rejeita URL não-Meta ou >10 MB.

---

## T0.5 — PII Scrubbing, Consentimento LGPD e Defesa contra Prompt Injection na IA

- [x] Concluída

### Problema atual

1. `AskTostaoUseCase` (`apps/api/src/use-cases/ask-tostao.ts:70,144-211`) e `AutoCategorizeUseCase` (`apps/api/src/use-cases/auto-categorize.ts:70-85`) enviam nome completo, saldos, salário e descrições cruas de Pix/extrato (com CPFs, nomes de terceiros, clínicas, farmácias) para `https://api.deepseek.com` sem mascaramento nem consentimento explícito.
2. Descrições de transações externas entram direto no `role: 'system'` (`ask-tostao.ts:208`) e a tool `registrar_transacao` (`apps/api/src/use-cases/tostao-tools.ts:208-256`) grava diretamente no banco sem confirmação do usuário e sem limites em `valor_reais`/`descricao`/`data`.
3. `POST /transactions/auto-categorize` (`apps/api/src/http/controllers/transactions.ts:153-157`) não tem cota diária nem rate-limit (permite DoS financeiro na API DeepSeek), e `auto-categorize.ts:90-92` engole erros com `catch { continue; }` sem logar.
4. `AskTostaoUseCase` (`ask-tostao.ts:56-109`) tem race condition na cota diária (`dailyLimit`), permite até 6 chamadas sequenciais (270s de timeout acumulado) e não filtra contas `hidden` (`L195-211`).

### Correção técnica

1. **Pipeline de PII Scrubbing (`apps/api/src/services/pii-scrubber.ts`):**
   - Criar função pura `scrubFinancialText(text: string)` que mascara antes de enviar ao LLM:
     - CPF (`\d{3}\.?\d{3}\.?\d{3}-?\d{2}`) → `[CPF]`
     - CNPJ (`\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}`) → `[CNPJ]`
     - E-mails, telefones BR, chaves aleatórias UUID, números de conta/agência/cartão (`\d{6,}`) → `[ID]`
     - Nomes próprios após prefixos de transferência (`PIX ENVIADO`, `PIX RECEBIDO`, `TED`, `DOC`, `TRANSF`) → manter apenas o tipo (`PIX ENVIADO [PESSOA]`).
   - Em `AskTostaoUseCase`: enviar apenas o **primeiro nome** (nunca nome completo), filtrar `account.hidden === false`, e passar todas as descrições por `scrubFinancialText`.
   - Em `AutoCategorizeUseCase`: pular descrições puramente pessoais de Pix/TED (ou aplicar `scrubFinancialText`) antes de enviar ao DeepSeek.
2. **Consentimento LGPD explícito para IA:**
   - Adicionar `aiConsentAt DateTime? @map("ai_consent_at")` em `User` (ou via tabela `UserConsent` na Fase 1) e endpoint `PATCH /me/consents`.
   - Bloquear `POST /chat`, `POST /transactions/auto-categorize` e chamadas IA do WhatsApp com `403` (`AI_CONSENT_REQUIRED`) enquanto o usuário não aceitar o aviso claro de uso de IA (com link para Política de Privacidade). Exibir card/modal de consentimento no `/tostao` e no botão "Categorizar pra mim".
3. **Defesa contra Prompt Injection e confirmação em `registrar_transacao`:**
   - Separar dados financeiros do usuário das instruções de sistema (colocar o snapshot financeiro delimitado em bloco explícito de dados não-executáveis, com instrução expressa de ignorar comandos dentro de descrições de extrato).
   - **Alterar `registrar_transacao` (`tostao-tools.ts:208-256`):** validar estritamente `valor_reais` (`0.01` a `1_000_000`), `descricao` (`<= 140` chars), `data` válida (calendário real, nunca `Invalid Date`), `resolveMonth` (`01..12`), compatibilidade de `cat.kind` com `tipo`, e match exato/seguro em `findCategory`.
   - Exigir **confirmação do usuário** antes de persistir mutações via IA: a tool retorna uma proposta estruturada (`pendingAction`) que a UI (ou WhatsApp: "Responda SIM para confirmar") confirma via endpoint dedicado antes de gravar no banco.
4. **Controle de custos & logs:**
   - Adicionar cota diária por usuário em `AutoCategorizeUseCase` (ex.: máx. 3 execuções / dia por usuário) + log estruturado de erros da API DeepSeek (remover `catch { continue; }` silencioso em `auto-categorize.ts:90`).
   - Reduzir `MAX_TOOL_ROUNDS` de `5` para `3` e timeout total por turno para `35s`; reservar cota de chat **antes** da chamada LLM (com estorno apenas se falhar antes de enviar à DeepSeek).

### Critérios de aceite & testes

- Testes em `apps/api/src/services/pii-scrubber.spec.ts` cobrindo CPF, CNPJ, telefone, e-mail, PIX com nome completo e número de cartão.
- Testes em `ask-tostao.spec.ts`: usuário sem consentimento recebe 403; prompt injection dentro de descrição de Pix não consegue executar gravação direta; `valor_reais` gigante / data `"2026-99-99"` / mês `"2026-13"` não geram 500; contas ocultas não aparecem no contexto.

---

## T0.6 — Fechar Open Redirect, Path Traversal, Eco de Senha e Reflected Alert no Web

- [x] Concluída

### Problema atual

1. **Open Redirect:**
   - `categorize` (`apps/web/app/(app)/carteira/actions.ts:29`) redireciona para `form.get('back')` sem nenhuma validação.
   - `CategorizarPage` (`apps/web/app/(app)/carteira/[id]/page.tsx:22`) e `carteira/actions.ts:105,120,141,148,161` aceitam `//evil.com`.
   - `resolveBackHref` (`apps/web/lib/format.ts:100-106`), `safeBack` (`apps/web/app/(app)/acertos/actions.ts:8-9`) e `createManual` (`carteira/actions.ts:54`) aceitam `/\evil.com` e `/sair`.
   - `apps/web/public/sw.js:19` abre URL absoluta externa se vier em `data.url`.
2. **Path Traversal em chamadas à API interna:**
   - IDs de `FormData`/params são interpolados sem validação nem `encodeURIComponent` em: `apps/web/app/(app)/conectar/actions.ts:43,53`, `apps/web/lib/tostao-auto-actions.ts:21,30`, `apps/web/app/(app)/carteira/actions.ts:24`, `apps/web/app/(app)/carteira/[id]/page.tsx:24`, `apps/web/app/(app)/carteira/conta/[id]/page.tsx:27`.
3. **Senha em texto plano devolvida no response HTTP:**
   - `apps/web/app/(auth)/actions.ts:11,13,22,28,30,35` retorna `fields: Object.fromEntries(form)` incluindo `password` em erros de login/cadastro.
4. **Reflected Alert Spoofing:**
   - `apps/web/app/(app)/acertos/page.tsx:16,94-98` e `apps/web/app/(app)/carteira/[id]/page.tsx:20,50,110` exibem query string `?erro=` arbitrária diretamente em `role="alert"`.

### Correção técnica

1. Criar helper central `safeInternalPath(raw: string | null | undefined, fallback: string): string` em `apps/web/lib/safe-redirect.ts`:
   - Rejeitar strings vazias, com `\`, `//`, caracteres de controle, ou que não comecem com `/`.
   - Parsear com `new URL(raw, 'https://tostao.local')`, validar `url.origin === 'https://tostao.local'` e bloquear rotas sensíveis (`/sair`, `/api/`).
   - Substituir **todas** as ocorrências acima por `safeInternalPath(...)`.
2. No `apps/web/public/sw.js:19`: validar `const parsed = new URL(raw, self.location.origin); const url = parsed.origin === self.location.origin ? parsed.href : new URL('/inicio', self.location.origin).href;`.
3. Criar helper `safePathSegment(id: unknown): string` validando formato UUID/slug (`/^[a-zA-Z0-9_-]{1,64}$/`) + `encodeURIComponent` e aplicar em todos os Server Actions e pages listados.
4. Em `apps/web/app/(auth)/actions.ts`: construir `safeFields` explicitamente apenas com `{ name, email, inviteCode }` — **nunca** incluir `password` nem `confirmPassword`.
5. Substituir `?erro=<texto livre>` por códigos enumerados (ex.: `?erro=nao_encontrado`, `?erro=falha_salvar`) mapeados para strings fixas no servidor.

### Critérios de aceite & testes

- Testes unitários para `safeInternalPath` (`https://evil.com`, `//evil.com`, `/\evil.com`, `/sair`, `/carteira?mes=2026-11`) e `safePathSegment` (`../me/delete`, `abc?x=1`).
- Verificação manual/teste garantindo que `login`/`register` com erro nunca incluem `password` no objeto retornado.

---

## T0.7 — Corrigir Cascata de Exclusão de Conta (LGPD), `parseMoney` 100x e Upload > 1 MB

- [x] Concluída

### Problema atual

1. **Exclusão de conta quebra com erro 500 (`23503`) no Postgres:** em `apps/api/prisma/schema.prisma:133,191`, `CategoryRule.category` e `CategoryBudget.category` usam `ON DELETE RESTRICT`. Deletar um usuário com categoria customizada referenciada por regra ou orçamento falha na cascata `User -> Category`. Além disso, `apps/api/src/http/controllers/account.ts:8-12` retorna `204` silenciando `providerFailures` de `DeleteAccountUseCase`.
2. **Bug `parseMoney` multiplica por 100x:** `apps/web/lib/format.ts:11-18` faz `.replace(/\./g, '').replace(',', '.')`. Digitar `"12.50"` vira `1250` (`R$ 1.250,00`) silenciosamente!
3. **Upload de extratos > 1 MB quebra antes da Action rodar:** `apps/web/app/(app)/importar/actions.ts:23-25` promete até 12 arquivos × 4 MB, mas `apps/web/next.config.ts` não aumenta `experimental.serverActions.bodySizeLimit` (padrão 1 MB).
4. **Checkbox de Termos no cadastro ignorado no servidor:** `apps/web/app/(auth)/auth-form.tsx:115` não tem `name` e `apps/web/app/(auth)/actions.ts:27-38` não envia aceite ao backend.

### Correção técnica

1. **Migration Prisma (`apps/api/prisma/schema.prisma:133,191`):**
   - Alterar `CategoryRule.category` e `CategoryBudget.category` para `onDelete: Cascade`.
   - Em `apps/api/src/http/controllers/account.ts`: retornar `200` com `{ deleted: true, providerFailures }` (ou enfileirar revogação pendente na Fase 1/3) e exibir aviso na UI se alguma desconexão Pluggy falhou, orientando revogar no Open Finance se necessário.
   - Em `apps/api/src/use-cases/delete-account.ts:27-31`: para contas OAuth-only, exigir confirmação reforçada (re-login recente ou confirmação explícita validada no backend — documentar integração com reautenticação na Fase 1).
2. **Corrigir `parseMoney` (`apps/web/lib/format.ts:11-18`):**
   - Limpar espaços e `R$`.
   - Se contiver `,` e `.`: o último separador define o decimal (ex.: `1.234,56` → decimal `,`; `1,234.56` → decimal `.`).
   - Se contiver apenas `.`: se houver um único ponto seguido de 1 ou 2 dígitos no final (`/^\d+\.\d{1,2}$/`), tratar como decimal (`12.50` → `12.5`); se seguido de 3 dígitos (`1.500`), tratar como milhar (`1500`).
   - Adicionar suíte de testes unitários abrangente cobrindo `"12,50"`, `"12.50"`, `"1.250,50"`, `"1.500"`, `"1,500.50"`, `"0,99"`, `"-50"`, `"abc"`.
3. **Corrigir upload de extratos:**
   - Configurar `experimental: { serverActions: { bodySizeLimit: '10mb' } }` em `apps/web/next.config.ts` (ou criar Route Handler `POST /api/importar` com validação explícita de tamanho/MIME e limite máximo por arquivo de 4 MB / total 10 MB).
4. **Persistir aceite de Termos/Privacidade:**
   - Adicionar `name="acceptedTerms"` no checkbox em `apps/web/app/(auth)/auth-form.tsx:115`, validar `acceptedTerms: z.literal(true)` em `registerBody` (`packages/contracts/src/index.ts`), e gravar `termsAcceptedAt` / `termsVersion` no `User` (expandido para `UserConsent` na Fase 1).

### Critérios de aceite & testes

- Teste real contra Postgres (ou script verificável) criando usuário + categoria customizada + regra + orçamento na categoria customizada e executando `DeleteAccountUseCase` com sucesso sem erro `23503`.
- Testes unitários de `parseMoney` passando para todos os formatos BR e US.
- Upload de extrato de 2 MB funcionando de ponta a ponta sem erro `413` / body limit.
- Cadastro sem `acceptedTerms: true` rejeitado pela API com `400`.
