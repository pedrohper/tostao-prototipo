# Fase 5 (Produto & Escala sem Open Finance) — Automação de Entrada, Backlog e Dívida Técnica

> **Objetivo:** Tornar o Tostão tão prático quanto apps com Open Finance pago — **sem depender de Open Finance caro no Dia 1** — combinando lançamentos recorrentes, WhatsApp multimodal (áudio, comprovante Pix, extrato), importação de PDF/Share Target/Atalho iOS, fechando os itens do backlog e corrigindo as pendências residuais das Fases 0–4.
> **Pré-requisito:** Fases 0, 1, 2, 3 e 4 concluídas (especialmente o Worker BullMQ da Fase 3 e o `QuickAddSheet` / Chat SSE da Fase 4).

---

## T5.1 — Limpeza de Dívida Técnica e Pendências das Fases 0–4

- [ ] Concluída

### Problema atual (registrado em `AGENT_SYNC.md`)

1. **Web / SSR (`T1.1`, `T2.3`, `T0.2`):**
   - ~35 páginas SSR ainda usam `.catch(() => fallback)` cru em vez de `orFallback` (`lib/rethrow.ts`), podendo engolir `NEXT_REDIRECT`.
   - `lib/refresh-session.ts` faz deduplicação de refresh apenas em memória do processo (quebra se houver 2+ réplicas Web atrás do load balancer na Fase 3).
   - Logout não apaga a `PushSubscription` do navegador atual (risco em aparelho compartilhado).
   - Meta de redução de bundle client `> 150 KB` na `T2.3` ficou em ~120 KB porque `pt-br.ts` (~63 KB) ainda vai inteiro ao navegador por causa das funções formatadoras no objeto do dicionário.
   - `/conectar` perdeu o aviso proativo de "Pluggy fora do ar" no GET (e chaves `downAlert*`/`downBox*` ficaram órfãs); `/carteira` e `/inicio` ainda mantêm partes de DOM duplicado desktop/mobile; ícone PWA `512×512` usa upscale de `app/icon.png` (`180×180`).
2. **Domínio, Fuso & Dados (`T0.3`, `T1.4`, `T1.5`, `T2.2`, `T4.1`):**
   - Lançamentos manuais (`POST /transactions`, `/people`, WhatsApp, `POST /chat/confirm`) ainda gravam `T12:00:00-03:00` fixo em Brasília em vez de `noonOfCivilDay(now, user.timezone)`, e `User.timezone` ainda não tem tela para troca em `/mais/preferencias`.
   - Cadastro social (Google/Apple) não registra aceite dos Termos (`user_consents` / `terms_accepted_at`).
   - "Desfazer" da `T4.1` não funciona quando a transação era pendente (API não aceita voltar `categoryId` para `null`) nem ao apagar lançamento/meta.
   - `findManualByUser`, `findByPerson`, `findUncategorized` e `listByCreator` seguem sem `take` / paginação segura; falta padronizar `createdAt`/`updatedAt`, registrar eventos de login/logout no `AuditLog` e unificar o termo **"Receitas / Despesas"** (que hoje só está no Início) em Carteira, Conta e Fechamento.

### Correção técnica

1. **Confiabilidade Web & Bundle (`apps/web`):**
   - Aplicar `orFallback` em todos os `.catch` de páginas SSR e adicionar regra no `server-actions-rethrow.spec.ts` (ou novo lint/spec) cobrindo `app/(app)/**/page.tsx`.
   - Mover o lock de single-flight do `refresh-session.ts` para chave curta no Redis (quando disponível no BFF) ou documentar/rotear refresh com lock distribuído entre réplicas Web.
   - Remover a `PushSubscription` atual do navegador ao executar `logoutAction`.
   - Separar as funções formatadoras de `apps/web/lib/i18n-locales/pt-br.ts` para módulos utilitários puros (`lib/format.ts`) e fatiar o dicionário por namespace (`home`, `wallet`, `learn`, `chat`, `settings`), derrubando o chunk client abaixo da meta original (`> 150 KB` de economia total vs baseline).
   - Cachear status leve de saúde do Pluggy no Redis (`pluggy:health`, TTL 5 min, alimentado por `createConnectToken` / sync) para restaurar o banner de indisponibilidade em `/conectar` sem disparar `POST` no GET.
   - Fornecer arte mestre de ícone `≥ 512×512` e rodar `pnpm assets:icons`; unificar as árvores restantes de `/carteira` e `/inicio` evitando montagem dupla no DOM.
2. **Domínio, Fuso, Undo & Auditoria (`apps/api` + `packages/contracts`):**
   - Usar `noonOfCivilDay(now, user.timezone)` em todos os pontos de criação manual (`CreateManualTransactionUseCase`, `people`, `whatsapp`, `chat/confirm`) e adicionar seletor de fuso horário IANA (com presets brasileiros + busca) em `/mais/preferencias` (`PATCH /me/preferences`).
   - No primeiro login OAuth (conta nova), exibir passo leve de aceite dos Termos de Uso + Privacidade antes de concluir ou registrar consentimento explícito em `user_consents`.
   - Permitir `categoryId: null` no `CategorizeTransactionUseCase` (reabrindo o "Desfazer" na `T4.1` mesmo para transações que estavam pendentes) e adicionar soft-delete curto (`deletedAt` ou janela de restauração de 10s / endpoint `POST /transactions/:id/restore`) para desfazer exclusão acidental.
   - Adicionar `take` máximo seguro / paginação explícita em `findManualByUser`, `findByPerson`, `findUncategorized` e `listByCreator`.
   - Padronizar `createdAt`/`updatedAt` faltantes, registrar `login_success`, `login_failed` e `logout` no `AuditLog`, e unificar labels **"Receitas / Despesas"** em Carteira, Conta e Fechamento.

### Critérios de aceite & testes

- Zero `.catch(() => ...)` sem `orFallback` em `apps/web/app/`.
- Bundle JS de `/inicio` reduzido em `> 150 KB` brutos frente ao baseline pré-T2.3.
- Testes cobrindo `noonOfCivilDay` com fuso `America/Manaus`, `categoryId: null` no undo e `restore` de transação.

---

## T5.2 — Recorrências Automáticas, Parcelamentos, Saldo Guiado e Vínculo de Transferência

- [x] Concluída

> **Nota de execução (2026-11-22):** como o Worker BullMQ da Fase 3 ainda não existe, o job diário roda no processo da API (`apps/api/src/jobs/recurring.ts`, croner, toda hora no minuto 5 via `RECURRING_CRON`; cada pessoa vence ao meio-dia do fuso dela) com lock distribuído no Redis + idempotência no Postgres. Quando a Fase 3 entrar, é só o worker chamar `materializeAll`. Detalhes e riscos em `AGENT_SYNC.md`.

### Problema atual

1. Sem Open Finance, o usuário precisa relançar todo mês salário, aluguel, internet, streaming e parcelas de compras no cartão.
2. Lançamentos futuros (`occurredAt > now`) em conta manual não atualizam o saldo quando a data chega porque não há job de materialização (`AGENT_SYNC.md:111`).
3. Pequenas diferenças de centavos/taxas entre o app do banco e o Tostão geram atrito para manter o saldo fiel sem Open Finance.
4. Pendência aberta no `AGENT_SYNC.md:14`: falta fluxo no detalhe do lançamento (`/carteira/[id]`) para marcar **"É pagamento de fatura"** ou **"Transferi pra outra conta minha"** ligando diretamente ao cartão ou à conta destino.

### Correção técnica

1. **Motor de Recorrências & Parcelamentos (`recurring_rules`):**
   - Nova tabela `recurring_rules` (`id`, `userId`, `accountId`, `categoryId`, `kind`, `description`, `amountInCents`, `frequency` `MONTHLY|WEEKLY|BIWEEKLY`, `dayOfMonth`, `totalInstallments`, `postedInstallments`, `autoPost`, `nextRunAt`, `active`, `createdAt`, `updatedAt`).
   - Endpoints `GET/POST/PATCH/DELETE /recurring-rules` + opção **"Repetir todo mês / Parcelar com geração automática"** dentro de `/anotar` e do `QuickAddSheet` (T4.4).
   - Novo job diário no Worker BullMQ (Fase 3):
     - Materializa recorrências vencidas na data civil do usuário (`externalId` determinístico `rec:<ruleId>:<YYYY-MM>` evitando duplicação) e ajusta saldo da conta manual em `$transaction`.
     - Materializa o efeito no saldo de **lançamentos futuros agendados** em contas manuais cuja `occurredAt` já entrou no passado/presente (resolvendo o risco da `T1.5` sem duplicar via flag `balanceAppliedAt` ou `externalId`).
   - Integração com `ForecastUseCase`: ler `recurring_rules` ativas para melhorar a precisão da previsão dos próximos meses.
2. **Saldo Guiado ("Ajustar saldo atual"):**
   - Endpoint `POST /accounts/:id/reconcile-balance` (`targetBalanceInCents`, `note?`) apenas para contas manuais/importadas: calcula `delta = target - current`, cria lançamento único de ajuste (`isBalanceAdjustment` ou descrição `"Ajuste de saldo"`) e atualiza o saldo atomicamente em `$transaction`.
   - Botão **"Conferir saldo"** na aba Contas da Carteira (`/carteira?aba=contas`) e no detalhe da conta.
3. **Vínculo explícito de Fatura e Transferência entre Contas (`AGENT_SYNC.md:14`):**
   - Em `apps/web/app/(app)/carteira/[id]/page.tsx` e API (`PATCH /transactions/:id/transfer-link`), adicionar ação assistida **"É pagamento de fatura"** (seleciona o cartão) e **"Transferi pra outra conta minha"** (seleciona a conta destino, marcando `internalTransferManual = true`, criando ou pareando a contrapartida em conta manual se aplicável para manter saldos coerentes).

### Critérios de aceite & testes

- Worker rodando duas vezes no mesmo dia não duplica lançamento recorrente nem aplica saldo duas vezes (idempotência testada contra Postgres).
- Ajuste de saldo em conta manual mantém `balance` igual ao informado pelo usuário; pagamento de fatura sai dos gastos do mês.

---

## T5.3 — Importação Universal (PDF de Fatura/Extrato + Share Target Android + Atalho iOS)

- [x] Concluída

> **Nota de execução (2026-11-22):** layouts de PDF validados só com fixtures sintéticas (sem fatura real); o fluxo de **imagem** compartilhada avisa que a leitura de comprovante é da T5.4; o link de instalação do Atalho pronto é opcional (`SHORTCUT_APPLE_PAY_URL` / `SHORTCUT_NOTIFICATION_URL`), sem ele a tela ensina a montar. Detalhes e riscos em `AGENT_SYNC.md`.

### Problema atual

1. Muitos bancos brasileiros (Nubank no app, PicPay, C6, Caixa) entregam muito mais fácil o **PDF da fatura/extrato** do que `.ofx`, forçando o usuário a abrir computador para converter arquivos.
2. No celular, baixar o extrato no app do banco, abrir o navegador, navegar até `/importar` e escolher arquivo tem 5–6 passos.
3. Usuários de iPhone não têm leitura automática de notificações em background na App Store, mas o app nativo **Atalhos (Shortcuts)** do iOS permite enviar compras do Apple Pay / notificações via webhook a custo zero.

### Correção técnica

1. **Importação de PDF de Fatura/Extrato (`apps/api/src/services/pdf-statement-parser.ts` + `ImportStatementUseCase`):**
   - Aceitar upload `.pdf` em `/importar` (mantendo limite de 10 MB e validação de magic bytes `%PDF-`).
   - Extrair texto localmente com biblioteca leve e timeout rígido; aplicar **parsers determinísticos** para os layouts mais comuns (Nubank fatura/conta, Itaú, Inter, Bradesco, Santander, C6) e fallback opcional estruturado com DeepSeek **sempre após `scrubFinancialText` e somente com `aiConsentAt` ativo**.
   - Entregar ao usuário uma **pré-visualização editável** (banco/cartão detectado + total + lista das primeiras linhas) antes de confirmar a gravação, reutilizando o mesmo `externalId` determinístico e `reconcileManualEntries` (zero duplicatas se reimportar).
   - Atualizar o guia colapsável em `apps/web/app/(app)/importar/page.tsx` com mini-passo a passo visual (3 passos curtos) por banco principal.
2. **PWA Share Target no Android (`apps/web/public/manifest.webmanifest` + `/compartilhar`):**
   - Configurar `share_target` (`POST` `multipart/form-data`) aceitando `.ofx`, `.csv`, `.pdf` e imagens (`image/*`) compartilhadas direto dos apps de banco para o Tostão.
   - Criar rota `/compartilhar` que recebe o arquivo compartilhado, autentica via sessão existente e encaminha para `/importar` (extrato) ou fluxo de comprovante (imagem).
3. **Integração Zero-App para iPhone — Atalhos iOS (`POST /webhooks/shortcuts` + `/mais/atalhos`):**
   - Nova tabela `automation_tokens` (`id`, `userId`, `label`, `tokenHash` SHA-256, `lastUsedAt`, `revokedAt`) com limite de até 3 tokens por usuário.
   - Endpoint `POST /webhooks/shortcuts` (autenticado por `Bearer tst_...`, rate limit por token/usuário, idempotência opcional via `eventId`): aceita `{ amount | text, merchant?, occurredAt?, accountId?, source: 'apple_pay' | 'ios_notification' | 'shortcut' }`, normaliza sinal, categoriza pelas regras e grava via `CreateManualTransactionUseCase`.
   - Nova tela `/mais/atalhos` onde o usuário gera/revoga seu token e segue guia visual de 3 passos (incluindo link de instalação do Atalho pronto no iPhone para **Apple Pay / Wallet** e gatilho de **Notificação** no iOS 27+).

### Critérios de aceite & testes

- Testes unitários do parser PDF (fixture sanitizada de fatura Nubank/Inter + rejeição de arquivo não-PDF/corrompido).
- Testes de `POST /webhooks/shortcuts` (token inválido `401`, revogado `401`, idempotência, criação de gasto no fuso correto).

---

## T5.4 — WhatsApp Multimodal (Áudio, Foto de Comprovante Pix, Extrato no Zap & Canal Isolado)

- [ ] Concluída

### Problema atual

1. Hoje o WhatsApp só registra por parser rápido frases unitárias simples (`"gastei 25 no ifood"`), caindo no chat para listas e não aceitando comprovantes em imagem nem arquivos `.ofx`/`.csv`/`.pdf` anexados na conversa.
2. Áudios recebidos precisam de suporte confiável fora do homelab (provider configurável Whisper local ou Groq Whisper API) com cota por usuário.
3. Item do backlog (`2026-11-14_Backlog-Tostao.md:17`): o número pessoal (`bot-pessoal`) e os workflows do Jarvis pessoal não devem dividir o mesmo aparelho/canal comercial dos usuários do Tostão.

### Correção técnica

1. **Multi-lançamento em texto (`apps/api/src/services/parse-expense.ts`):**
   - Evoluir o parser determinístico para aceitar múltiplos itens separados por vírgula, quebra de linha ou `"e"` (`"mercado 120, uber 18, padaria 14"`), criando em lote e respondendo com resumo claro (ou pedindo confirmação se algum item estiver ambíguo).
2. **Áudio configurável (`Whisper` / `Groq` / `OpenAI`) + Cota (`apps/api/src/gateways/audio-transcriber.ts`):**
   - Suportar `WHISPER_PROVIDER=local|groq|openai|fake` com `WHISPER_API_KEY`, limite de 10 MB e cota diária por usuário no Redis (ex.: 20 áudios/dia), reutilizando o fluxo de multi-lançamento ou chat após transcrever.
3. **Leitura de Comprovante Pix / Cupom Fiscal por Imagem (`POST /whatsapp/webhook`):**
   - Quando chegar mensagem `type: 'image'` de número vinculado (com consentimento de IA ativo), baixar via `downloadMedia` seguro (`T0.4`), validar MIME (`image/jpeg`, `image/png`, `image/webp`) e tamanho (`≤ 5 MB`), e enviar para extração estruturada (`amountInCents`, `description`, `occurredAt`, `kind`) — retornando prévia no WhatsApp (_"Li Pix de R$ 45,00 para Padaria Central hoje. Responda SIM pra anotar"_) via `PendingAction`.
4. **Receber Extrato (`.ofx`, `.csv`, `.pdf`) direto pelo WhatsApp:**
   - Quando chegar `type: 'document'` permitido, baixar com a mesma proteção SSRF/tamanho, rodar `ImportStatementUseCase` associando à conta padrão de importação (ou nome extraído do arquivo) e responder com o resumo (_"Importei 32 lançamentos e conciliei 4 anotações suas!"_).
5. **Isolamento Definitivo do Canal (`2026-11-14_Backlog-Tostao.md:17`):**
   - Separar totalmente as credenciais/variáveis e número do **Tostão Comercial (Meta Cloud API oficial)** do número/instância pessoal do **Jarvis**, documentando o checklist de migração e removendo dependências residuais de workflows pessoais do homelab no código/docs de produção.

### Critérios de aceite & testes

- Testes em `parse-expense.spec.ts` com 3 gastos na mesma mensagem e perguntas com `?` continuando no chat.
- Testes em `whatsapp.spec.ts` cobrindo imagem de comprovante gerando `PendingAction` (exige `"SIM"`), cota de áudio e documento `.ofx` importado sem duplicar.

---

## T5.5 — Backlog de Produto: Ajustar Meta por Chat, Favoritos 1-Toque, Auditoria de Compromissos e Jogos

- [ ] Concluída

### Problema atual (itens do backlog + `README.md` / `03-Status-e-Pendencias.md`)

1. **`2026-11-14_Backlog-Tostao.md:15`:** O chat do Tostão consulta gastos e registra transação (mediante confirmação), mas ainda não consegue **ajustar/recalcular metas** ou simular aportes extraordinários (PPR, 13º, férias) diretamente na conversa.
2. Falta atalho de **"Gastos de sempre"** (favoritos aprendidos do histórico) no `QuickAddSheet` (T4.4) e **Fechamento Semanal proativo** via WhatsApp/Push para manter o hábito sem Open Finance.
3. **`README.md:111` & `03-Status-e-Pendencias.md:32`:** O compromisso semanal aceito ao fim das lições não é auditado de verdade contra o extrato do usuário.
4. **`README.md:110,116` & `CLAUDE.md:52`:** Faltam simuladores dedicados para lições dos **Módulos 2 a 9** (hoje concentrados no Módulo 1 e juros em `2.3`) e concluir a experiência completa de **Tribunal** e **Batalha**.

### Correção técnica

1. **Ferramenta `propor_ajuste_meta` no Chat (`tostao-tools.ts`, `pending-actions.ts`):**
   - Permitir ao Tostão propor criação/edição de meta (alvo, prazo, aporte mensal ou aporte extra futuro como PPR/13º) usando exatamente o mesmo mecanismo de **`PendingAction` + confirmação explícita do usuário** (`POST /chat/confirm` ou `"SIM"` no WhatsApp).
   - No chat web (estendendo `T4.5`), renderizar card comparativo _"Antes → Depois"_ mostrando quantos meses o ajuste economiza/antecipa.
2. **Favoritos em 1 Toque & Fechamento Semanal:**
   - Endpoint leve `GET /transactions/frequent` (top 5 descrições/valores/categorias mais repetidos dos últimos 60 dias, excluindo transferências) exibido como chips clicáveis no `QuickAddSheet` (`T4.4`) e `/anotar`.
   - Job semanal opt-in (`notifyWeeklySummary`) enviando resumo da semana + 1 pergunta de revisão via template oficial WhatsApp / Push.
3. **Auditoria Real de Compromissos Semanais (`WeeklyChallenge`):**
   - Evoluir `WeeklyChallenge` (criada/planejada em `T2.5`) com `ruleType` (ex.: `no_category_spend`, `category_cap`, `categorize_all`, `save_deposit`, `check_subscriptions`) e job de auditoria semanal no BullMQ que verifica o extrato real da semana, marca `COMPLETED` ou `MISSED`, registra notificação gentil ("sem julgamento") e credita XP legítimo.
4. **Simuladores M2–M9 + Tribunal & Batalha Completos:**
   - Implementar os simuladores faltantes em `apps/web/app/(app)/aprender/[licao]/simulators*.tsx` com `<TostaoSlider>` e dados reais do `userContext` (`T4.5`), cobrindo pelo menos os temas centrais de cada módulo (Cartão/Rotativo, Dívidas/Bola de Neve, Reserva & Selic/CDI, Investimentos, Metas de Longo Prazo, Golpes/Urubu e Bets/Tigrinho) e conectá-los em `/aprender/simuladores`.
   - Concluir o fluxo interativo e polimento visual de `/batalha` (progresso visual, histórico e recompensas) e `/tribunal` (casos semanais, explicação pós-voto e comparação com a comunidade).

### Critérios de aceite & testes

- Teste em `ask-tostao.spec.ts` garantindo que `propor_ajuste_meta` exige confirmação e altera a meta atomicamente com lock otimista.
- Teste unitário/integração da auditoria de `WeeklyChallenge` marcando corretamente compromisso cumprido vs não cumprido sobre transações reais.
- `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 100% verdes.
