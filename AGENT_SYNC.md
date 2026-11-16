# AGENT_SYNC

Quadro de passagem entre os agentes que mexem neste repo (Claude escreve o código, Gemini revisa o `git diff`).
Regra: **leia este arquivo antes de codar** e **registre o relatório ao terminar**. Entradas novas vão no topo de cada seção, com data, agente e branch/PR.

---

## Plano

O que está pra ser feito agora, por quem e em que branch. Tire daqui quando for pra Execução.

- [ ] **"É pagamento de fatura" / "Transferi pra outra conta minha"** no detalhe do lançamento: liga ao cartão ou à conta, sai do gasto e aparece no lugar certo. Claude, thread "Deixar o Tostão pronto pros testadores". Aguardando o Pedro terminar a descrição da transferência entre bancos.

## Execução

Relatório do que foi feito. Modelo:

```
### AAAA-MM-DD · agente · PR #N (branch)
- O que mudou (arquivos/rotas/tabelas).
- Migration? Variável de ambiente nova?
- Como validei (testes, rota, tela).
- O que ficou de fora / riscos.
```

### 2026-11-16 · Antigravity · servidor (Separação Jarvis/Tostão + Lint/CI + Tokens + Padronização EN + i18n completo + Áudio Cloud API)
- **Separação Jarvis × Tostão (`apps/api/src/use-cases/ask-tostao.ts`, `tostao-tools.ts`, `ask-tostao.spec.ts`)**: removidas de vez `JARVIS_TOOLS` (`salvar_nota_obsidian`, `buscar_notas_obsidian`, `criar_flashcards_anki`), `PEDRO_USER_ID`/`PEDRO_EMAIL` e instruções de Segundo Cérebro do Tostão; `executeTostaoTool` reforça `allowedTools` e teste em `ask-tostao.spec.ts` garante que apenas `TOSTAO_TOOLS` são expostas. Número atual (`bot-pessoal`) fica dedicado ao Tostão.
- **Áudio na WhatsApp Cloud API (`apps/api/src/gateways/whatsapp-gateway.ts`, `http/controllers/whatsapp.ts`, `app.ts`, `env.ts`, `server.ts`, `use-cases/whatsapp.spec.ts`, `.env.example`)**: adicionados `AudioTranscriber`, `WhisperAudioTranscriber` (integrado ao Whisper local via `WHISPER_URL`) e `CloudApiWhatsAppGateway.downloadMedia` (Graph API `v21.0`). O webhook `POST /whatsapp/webhook` agora baixa mensagens `type: 'audio'` em segundo plano, transcreve e executa via `HandleWhatsAppMessageUseCase` (coberto por novo teste em `whatsapp.spec.ts`).
- **ESLint, Prettier e CI (`package.json`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.github/workflows/ci.yml`)**: configurados ESLint flat config (`@eslint/js`, `typescript-eslint`, `@next/eslint-plugin-next`, `eslint-plugin-react-hooks`, `eslint-config-prettier` com `@typescript-eslint/no-explicit-any: error` e `no-unused-vars`), Prettier e workflow de CI (`typecheck`, `lint`, `test`, `build`).
- **Tokens de Tema / Dark Mode (`apps/web/app/globals.css`, `components/*`, `app/**`)**: cores hex fixas substituídas por tokens CSS (`var(--color-*)` / classes Tailwind do `@theme`) e ajuste em `(site)/site.module.css` para tema claro/escuro consistente.
- **Padronização PT→EN & remoção de aliases legados (`apps/web/components/*`, `apps/web/lib/*`, `apps/web/app/**`)**: símbolos exportados padronizados em inglês (ex.: `SwipeSheet`, `Sheet`, `CardNetworkBadge`, `getCardNetworkName`, `readHomePrefs`, `resolveSectionOrder`, `HOME_SECTIONS`, `DismissibleCard`, `DailyMissions`, `RightRail`, etc.), preservando as rotas Next.js em português (`/inicio`, `/carteira`, `/tostao`, `/aprender`, `/mais`).
- **i18n completo (`apps/web/lib/i18n.ts`, `i18n-locales/{types,pt-br,en,es}.ts`, todas as rotas `(app)`, `(auth)` e `(site)` e componentes compartilhados)**: dicionários expandidos e conectados em todas as páginas e formulários client-side (`pt-BR`, `en`, `es`), incluindo `carteira`, `carteira/[id]`, `mais`, `perfil`, `aprender/*`, `inicio`, `acertos/*`, `amigos`, `convites`, `whatsapp`, `batalha`, `tribunal` e `Sheet`/`SwipeSheet`.
- **Migration / Env**: nenhuma migration; nova env opcional `WHISPER_URL` (padrão `http://127.0.0.1:8000/v1/audio/transcriptions`) e variáveis Meta Cloud API documentadas em `.env.example`.
- **Como validei**: `pnpm typecheck` (`@tostao/api`, `@tostao/web`, `packages/contracts`), `pnpm lint` (0 erros, 0 warnings), `pnpm test` (31 suítes / 171 testes passando), `pnpm build` (`next build`, 86 rotas), `pm2 restart tostao-api tostao-web --update-env` e smoke checks HTTP via `curl`.
- **O que ficou de fora / riscos**: para ativar os números oficiais na Meta Cloud API, basta preencher as credenciais Meta do Tostão no `apps/api/.env` e as do Atllas no workflow `atllas-whatsapp-meta.json` do n8n; `bot-pessoal` segue intacto para os workflows atuais do homelab.

### 2026-11-16 · Claude · servidor (segurança do chat e deploy, sem PR)
- `use-cases/tostao-tools.ts`: `executeTostaoTool` exige `allowedTools` e recusa ferramenta fora da lista (antes, se o modelo pedisse `buscar_notas_obsidian`/`salvar_nota_obsidian` pra qualquer usuário, executava). `criar_flashcards_anki` não engole mais erro: `ok`, `salvo_no_anki_studio` e `nota_obsidian` refletem o que de fato salvou.
- `use-cases/ask-tostao.ts`, `factories.ts`, `app.ts`, `server.ts`, `env.ts`: dono do modo Jarvis vem de `OWNER_USER_ID` (saiu o ID e o e-mail fixos do código, repo é público). `VAPID_SUBJECT` sem e-mail padrão; obrigatório se houver `VAPID_PUBLIC_KEY`.
- `~/homelab/scripts/deploy-tostao.sh`: tirado o `|| true` do `prisma migrate deploy` (migration falhando agora aborta o deploy antes do build/reload).
- Env nova: `OWNER_USER_ID` e `VAPID_SUBJECT` (já preenchidas no `apps/api/.env` do servidor; documentadas no `.env.example`). Sem migration.
- Validei: vitest 171/171 (2 testes novos em `ask-tostao.spec.ts`), `tsc` api limpo, `pm2 restart tostao-api` + `/health` ok.
- Fica de fora: separar o Jarvis do Tostão de vez (número de WhatsApp próprio e tirar as ferramentas do Jarvis da API do Tostão); ESLint/Prettier/CI; nomes PT/EN, i18n e cores fixas.

### 2026-11-16 · Antigravity · servidor (Novo Sitemap 5 Abas, Funções Automáticas do Tostão & Correções Desktop)
- **Onda 1 (Base API + Funções Automáticas sem jargão "Agentes")**:
  - `packages/contracts/src/index.ts`, `apps/api/prisma/schema.prisma`, `migration 20261116003000_add_tostao_auto`: adicionadas tabelas `tostao_insights` (`TostaoInsight`) e `tostao_auto_configs` (`TostaoAutoConfig`), contratos Zod/TS (`TostaoInsightDTO`, `TostaoAutoConfigDTO`, `TostaoAutoResponse`, `RunTostaoCheckResponse`, `ApplyTostaoInsightResponse`).
  - `apps/api/src/domain/entities.ts`, `repositories/types.ts`, `repositories/prisma/index.ts`, `repositories/in-memory/index.ts`: repositório `tostaoAuto` (Postgres + InMemory) e `users.listAllIds()`.
  - `apps/api/src/use-cases/tostao-auto.ts`, `tostao-auto.spec.ts`, `http/controllers/tostao-auto.ts`, `use-cases/factories.ts`, `app.ts`: 4 rotinas nativas (`caramelo_extrato`, `tostao_previsao`, `guardiao_limites`, `olheiro_acertos`) com deduplicação idempotente, limpeza automática de pendências resolvidas, ações em 1 clique (`POST /tostao/insights/:id/apply|dismiss`), checagem sob demanda (`POST /tostao/auto/check`), preferências reais (`PUT /tostao/auto/config`), e hooks não bloqueantes pós-sync/import/plano/lançamento manual.
  - **Fase 2 (`jobs/tostao-checks.ts`, `jobs/notifications.ts`, `server.ts`)**: cron horário rodando `runPeriodicTostaoChecks`, `syncEverything` disparando checagens pós-sync, e `runNotifications` respeitando `notifyPush`/`notifyWhatsapp`/`tostaoPrevisao` com entrega opcional via `WhatsAppGateway`.
- **Onda 2 (Shell 5 Abas, Teto 1440px & Breakpoint `lg:`)**:
  - `apps/web/components/nav.tsx`, `components/lateral.tsx`, `components/ui.tsx` (`PageFrame`), `components/engajamento.tsx`, `lib/format.ts` (`resolveBackHref`), `lib/i18n.ts`, `app/(app)/layout.tsx`: nova barra de 5 botões (`Início`, `Carteira`, `Tostão`, `Aprender`, `Mais`) com badge de achados no Tostão, `DesktopSplitShell` e `RightRail` ativos a partir de `lg:` (`1024px+`) com teto `max-w-[1440px]` e dicionários completos `pt-BR`/`en`/`es`.
  - `apps/web/lib/tostao-auto-actions.ts`, `components/tostao-auto-card.tsx`: board `"O que o Tostão achou"` (`TostaoFindingsBoard`) e painel persistente `"O que o Tostão acompanha"` (`TostaoAutoConfigPanel`).
- **Onda 3 (4 frentes paralelas)**:
  - **Início & Tostão (`inicio/page.tsx`, `inicio/ask-card.tsx`, `tostao/page.tsx`, `chat/page.tsx`, `chat/chat-client.tsx`)**: `/inicio` agora exibe `"O que o Tostão achou"` em 1 clique e `"Desafio da semana"` no rail direito (`lg+`); criada central `/tostao` (`Conversa | No automático`), mantido `/chat` como redirect de compatibilidade.
  - **Carteira & Planejar (`carteira/page.tsx`, `carteira/planner-hub.tsx`, `carteira/simulacao.tsx`)**: `/carteira` agora conta com abas `Extrato | Contas | Planejar` (`PlannerHub` reunindo Renda, Previsão, Limites, Assinaturas, Meta, Acertos, Categorias e Fechamento) + largura corrigida em `simulacao.tsx`.
  - **Aprender & Mais (`aprender/page.tsx`, `mais/page.tsx`, `perfil/page.tsx`)**: `/aprender` absorveu Calculadoras (`Compensa`, `Investir`) e Comunidade (`Amigos`, `Convites`); criada rota enxuta `/mais` com bancos conectados, WhatsApp, toggles reais de `"O que o Tostão acompanha"`, Push, Sons, Idioma, Personalizar Início e Conta; `/perfil` redireciona para `/mais`.
  - **Sub-rotas Desktop & Onboarding (`renda/*`, `limites`, `assinaturas`, `acertos/*`, `compensa`, `investir`, `previsao`, `meta`, `conectar/*`, `fechamento`, `categorias`, `importar`, `amigos`, `convites`, `whatsapp`, `tribunal`, `batalha`, `carteira/busca`, `inicio/personalizar`, `perfil/apagar-conta`, `aprender/[licao]/player.tsx`)**: enquadramento em `max-w-[1040px]` (2 colunas) e `max-w-[760px]`/`680px`, fim das telas esticadas em monitores grandes, `<BackLink>` padronizado com `?voltar=`, e Passo 3 de 3 coerente no onboarding de `/renda?novo=1`.
- **Migration / Env**: Migration `20261116003000_add_tostao_auto` aplicada com sucesso no Postgres local; nenhuma variável de ambiente nova.
- **Como validei**: `tsc --noEmit` limpo em `@tostao/api` e `@tostao/web`; Vitest `@tostao/api` 31/31 suítes e 169/169 testes passando (incluindo `tostao-auto.spec.ts`); `next build` compilou 86/86 rotas; `pm2 restart tostao-api tostao-web` online sem erros; `curl` confirmou `GET :3333/health` (`200`), `GET :3333/tostao/auto` sem JWT (`401`), `200` nas rotas públicas web e `307` em 21 rotas autenticadas/aliases.
- **O que ficou de fora / riscos**: conferência visual interativa no navegador em desktop (1440px/1024px) e celular (390px) fica para o Pedro validar via Tailscale (servidor Linux headless sem Chrome GUI/DevTools); envio proativo pelo WhatsApp só dispara quando `N8N_WHATSAPP_SEND_URL` estiver configurada no `.env` e o usuário habilitar o toggle em `/mais`.

### 2026-11-16 · Antigravity · servidor (Redesign Desktop & Web — artefato-tostao-claude.html + sub-rotas)
- **Wave 0 (Fundação & Shell)**:
  - `apps/web/app/(app)/layout.tsx`, `components/nav.tsx`, `components/lateral.tsx`: expandido `<main>` para layout fluido mantendo `md:px-8`, barra lateral em `248px` com 5 links (mantendo `/chat` no menu) e novo componente `DesktopSplitShell` (3 colunas em `xl:` com coluna direita de `320px` no Início e `340px` em Carteira/Aprender/Perfil).
  - `apps/web/lib/format.ts`, `apps/web/lib/i18n.ts`: adicionados `fullDateLabel`, `updatedTimeLabel` e chaves `pt-BR`/`en`/`es` para as novas telas desktop.
- **Wave 1 (5 frentes paralelas disjuntas)**:
  - **Frente 1 (Landing, Privacidade #49 & Auth Split)**: polimento em `(site)/site.module.css` (`overflow-x: clip`, breakpoint `960px`/mobile `360px`), atualização de `(site)/privacidade/page.tsx` (menção a Acertos e cookie `tostao-locale`), e split-screen desktop 2 colunas em `(auth)/layout.tsx`, `entrar`, `criar-conta`, `redefinir-senha` e `auth-form.tsx` mantendo 100% das Server Actions.
  - **Frente 2 (Tela 22 Início + Previsão + Meta)**: `inicio/page.tsx` com header data/sync/status, grid 3 cards KPI (saldo/entradas/saídas), `"Pra onde foi"` com barra segmentada + ícones + pendentes, card contextual rosa, novo client `inicio/ask-card.tsx` (`Pergunte ao Tostão` → `/chat?q=...`) e rail direito (módulo atual, missões, meta), mantendo `HOME_SECTIONS` e preferências no mobile; grids 2 colunas em `previsao/page.tsx` e `meta/page.tsx`.
  - **Frente 3 (Tela 32 Carteira + Conta + Categorizar + Anotar)**: `carteira/page.tsx` e `transaction-row.tsx` com suporte opcional a `?conta=`, `FilterDropdown` (mês/conta/categoria), tabela desktop completa, rail direito (`Suas contas`, `Por categoria`, insight real do Caramelo), preservando `Simulacao`, `AddAccountBox` quando vazio e lista mobile; `carteira/conta/[id]/page.tsx` em 2 colunas; `components/sheet-swipe.tsx` (dialog centralizado no desktop, drag-sheet no mobile); `anotar/page.tsx` e `anotar-form.tsx` em card elevado centralizado no desktop.
  - **Frente 4 (Tela 33 Aprender + Trilha + Chat)**: `aprender/page.tsx` com hero amarelo `professor`, card das 5 lições do módulo atual e rail direito (`Missões`, `Batalha ativa`, `Tribunal da semana`), `aprender/trilha` centralizada, e `chat/page.tsx` + `chat-client.tsx` aceitando `?q=...` com guarda de envio único (`replaceState`).
  - **Frente 5 (Tela 34 Perfil + Conectar)**: `perfil/page.tsx` com grid 2 colunas (identidade + status real Open Finance de `/me`; contas conectadas + bloco unificado de `PushNotificationCard`/`SoundToggleCard`/`LanguageSwitcher` em `avisos.tsx`, `sons.tsx`, `language-switcher.tsx`), grid para os 12 Atalhos ("Ferramentas"), e rail direito `Conquistas` com contagem real de vilões vencidos (`/battles`); `conectar/page.tsx` em 2 colunas no desktop.
- **Migration / Env**: Nenhuma migration, nenhuma variável de ambiente nova e nenhuma alteração de backend/contratos.
- **Como validei**: `tsc -p apps/web/tsconfig.json --noEmit` limpo; `tsc -p apps/api/tsconfig.json --noEmit` limpo; Vitest `@tostao/api` 30/30 suítes e 165/165 testes passando; `next build` (`@tostao/web`) compilando todas as 84 rotas; `pm2 restart tostao-web` online; `curl` confirmando HTTP 200 em `/`, `/entrar`, `/criar-conta`, `/redefinir-senha`, `/privacidade`, `/termos` e 307 em `/inicio`, `/carteira`, `/aprender`, `/perfil`, `/previsao`, `/meta`, `/conectar`, `/chat`, `/anotar`, além de marcações SSR esperadas em `/entrar` e `/privacidade`.
- **O que ficou de fora / riscos**: conferência visual em navegador headless/GUI não executada aqui (servidor Ubuntu headless sem Chrome DevTools ativo; e rotas autenticadas exigem sessão real sem criar usuários de teste no banco). Falta o Pedro conferir visualmente via Tailscale em desktop (1440px), celular (390px) e modo escuro, além de decidir commit + push (e limpeza ou movimentação de `artefato-tostao-claude.html` da raiz).

### 2026-11-15 · Claude · deploy PR #29 (servidor, conferência)
- Pedido: deploy do #29 (só web, sem migration). Não rodei nada: o `main` local já contém `origin/main` (#29 `9611ade` e #28 `0ebb364`), `git fetch` sem novidade, `.next/BUILD_ID` de 15/11 11:54 (depois do merge, 00:18), PM2 com `tostao-api`/`tostao-web` online e `GET :3333/health` → `{"ok":true}`.
- Sem backup, build, restart nem commit.
- Riscos: `main` local está 3 commits à frente do GitHub (`37cd7d6`, `eb38ae6`, `bc0cc7e`, não enviados) e há ~20 arquivos modificados + i18n novo (`lib/i18n*.ts`, `components/language-switcher.tsx`) sem commit. O build no ar inclui esse código. Falta commit + push (Pedro decide).

### 2026-11-15 · Claude · servidor (sem PR, código ainda fora do GitHub)
- Simuladores M1–M9 (`aprender/[licao]/simulators*.tsx`): textos `#065F46/#9F1239/#92400E/#D97706/#E11D48` viraram `text-verde-texto/vermelho-texto/laranja-texto` (têm variante dark). "Mês reequilibrado" e afins ficavam verde escuro sobre `menta-clara` escuro.
- Acertos: renomear pessoa/grupo. `PeopleRepository.rename`, `RenamePersonUseCase` (trim + espaços colapsados, 409 "Já tem ..." se outro tiver o nome), `PATCH /people/:id`, action `renomearPessoa` e `<details>` "Editar nome" em `acertos/[id]`; erro agora aparece logo abaixo do BackLink.
- Carteira: `AddAccountBox` só quando não há conta/cartão; no Perfil fica sempre, abaixo de "Contas conectadas".
- Player das lições: contêiner vai até o fim da tela no celular (`-mb-28 pb-28 min-h-dvh`), sem a faixa escura acima do menu.
- Card "Tudo certo por hoje": subtítulo só "Volte amanhã" (en/es em `lib/i18n.ts`; também em `aprender/page.tsx`).
- n8n TostaoWeekly01 (`~/homelab/n8n-workflows/tostao-weekly-summary.json` + ativo): prompt pede formato WhatsApp sem Markdown; Code limpa `**`/`#` e formata data 15/11/2026 e R$ 851,55. Workflow inativo `[TESTE] Fechamento Semanal sem WhatsApp (pode apagar)` ficou no n8n.
- Sem migration, sem env nova.
- Validei: vitest api 165/165 (novo teste de renomear em `people.spec.ts`), tsc api e web limpos, `pnpm --filter @tostao/web build` ok, `pm2 restart tostao-api tostao-web`, web 200 em `/` e 307 em `/inicio`, `PATCH /people/:id` responde 401 sem sessão; workflow de teste rodado até o Code (sem WhatsApp).

### 2026-11-15 · Antigravity · Base i18n (pt-BR, en, es) + Padronização do Código em Inglês
- `apps/web/lib/i18n.ts`, `i18n-server.ts`, `i18n-actions.ts` e `components/language-switcher.tsx`: sistema de internacionalização tipado (`pt-BR`, `en`, `es`) persistido no cookie `tostao-locale`, mantendo moeda em `R$` (`BRL`) e traduzindo interface, meses, datas relativas e atalhos; seletor de idioma em 1 clique adicionado em `/perfil`.
- Padronização de identificadores do código para inglês (mantendo exports legados como aliases para retrocompatibilidade):
  - `lib/inicio-prefs.ts` e `lib/inicio-actions.ts`: `readHomePrefs`, `resolveSectionOrder`, `HOME_SECTIONS`, `saveHomePrefs`, `restoreDismissedAlerts`, `dismissAlert`.
  - `components/fechavel.tsx`, `sons.tsx`, `avisos.tsx`, `lateral.tsx`, `engajamento.tsx`, `nav.tsx`: `DismissibleCard`, `DismissButton`, `TapSoundListener`, `MissionCompletionToast`, `SoundToggleCard`, `PushNotificationCard`, `SidebarFooter`, `RightRail`, `DailyMissions`, `CompletedMissionsCard`, `UpcomingReminders`, `WeeklySummaryCard`, `MonthLeftoverCard`.
  - `app/(app)/inicio/page.tsx`, `app/(app)/perfil/page.tsx`, `app/(app)/layout.tsx` e `app/layout.tsx`: refatorados para inglês e conectados ao dicionário i18n.
  - `apps/api/src/use-cases/ask-tostao.ts`: Tostão responde no idioma em que a pessoa conversar (`pt-BR`, `en` ou `es`).
- Sem migration. Validado com `tsc --noEmit` (`web` e `api`) e `vitest run` (30 suítes / 164 testes passando).

### 2026-11-14 · teamwork_worker · Frente 1-5 (UX, Mobile S24, Vetores SVG, Dilemas e Simuladores)
- **Frente 1 (Anotar & Contas)**:
  - `apps/web/app/(app)/anotar/anotar-form.tsx`: removido `max={today}` do input de data (permitindo agendamentos e lançamentos futuros); cabeçalho dinâmico adaptando título ("Anotar gasto" vs "Anotar entrada"), subtítulo ("O Caramelo fareja até o troco do pão." vs "Mais um trocado pingando na conta."), pose do Mascote (`caramelo-farejando` vs `caramelo-feliz`), legenda do seletor ("Pago com" vs "Recebido em") e nota de aviso de auto-sync baseados no estado `kind`.
  - `apps/web/app/(app)/anotar/page.tsx`: preservados `type` ('BANK' | 'CREDIT') e `institution` nas contas repassadas ao formulário.
  - No seletor de contas do `anotar-form.tsx`, adicionada diferenciação visual para contas e cartões da mesma instituição (ex.: Mercado Pago Conta vs Mercado Pago Cartão) com ícones (`BankIcon` / `CardIcon`) e badge pill ("Conta" / "Cartão").
  - `apps/api/src/use-cases/create-manual-transaction.spec.ts`: nova suíte de testes unitários cobrindo datas futuras para despesas (valores negativos), receitas (valores positivos), preservação de `accountId` e parcelamentos futuros via `addMonths`.
- **Frente 2 (Mobile Layout & Viewport S24)**:
  - `apps/web/components/ui.tsx`: atualizado o componente `Field` com `min-w-0` no `<label>` e `w-full min-w-0` no `<input>`, impedindo estouro horizontal de largura em cards mobile (como no grid de `/categorias`).
  - `apps/web/app/(app)/categorias/category-form.tsx`: adicionado `min-w-0` no grid de duas colunas (`grid-cols-[72px_1fr]`).
  - `apps/web/app/(app)/batalha/page.tsx`: ajustada arena dos mascotes (`h-[140px] sm:h-[180px] md:h-[210px]`, mascotes responsivos com `object-contain`), reduzido padding inferior excessivo (`pb-20 md:pb-8`) e espaçamentos verticais para ajuste completo no viewport mobile (Samsung S24 360x780 / 390x844) sem sobreposição da barra de navegação.
- **Frente 3 (Identidade Visual & Ícones Vetoriais)**:
  - Criados 56 ícones vetoriais SVG limpos em `apps/web/public/icones/**/*.svg` seguindo o design system "papel e tinta" (viewBox 0 0 24 24, stroke currentColor 1.75, pontas arredondadas e acentos da paleta).
  - `apps/web/components/icone.tsx`: implementado dicionário SVG inline `ICON_SVGS` cobrindo todas as categorias (`cat/*`), módulos da trilha (`modulo/*`), ações de UI (`ui/*`), conexões (`conectar/*`), metas (`meta/*`), jogos (`jogo/*`) e abas (`aba/*`), com renderização direta via `<svg>` e suporte automático ao dark mode via `currentColor`, mantendo fallback para busca estática e 100% de retrocompatibilidade com `<Icone />` e `<CatIcon />`.
  - Removidos os 56 arquivos PNG rasterizados obsoletos (mantidos apenas os PNGs obrigatórios da PWA em `apps/web/public/icones/icon-*.png`).
- **Frente 4 (Dilemas das Lições & Player)**:
  - `content/curriculo.md`: todos os 45 dilemas reestruturados no formato explícito `Opção A: ... vs. Opção B: ... Lado A: ... Lado B: ...`.
  - `scripts/build-lessons.mjs`: atualizado parser de dilemas para extrair `optionA` e `optionB` estruturados em `content/lessons/modules.json`.
  - Compilado com `pnpm content:build` gerando 9 módulos e 45 lições com campos tipados.
  - `apps/web/app/(app)/aprender/[licao]/player.tsx`: atualizado passo 3 do player com botões em cards empilhados de largura total destacando as descrições da Opção A e Opção B antes do voto.
- **Frente 5 (Simuladores Interativos do Módulo 1)**:
  - `apps/web/app/(app)/aprender/[licao]/simulators.tsx`: implementados e registrados os 4 simuladores interativos das lições do Módulo 1 (substituindo o fallback "em construção"):
    - `m1-l2` ("Ajuste das fatias"): simulador da regra 50/30/20 com sliders de renda, necessidades e desejos, barra empilhada e alertas pedagógicos.
    - `m1-l3` ("O bisturi no fixo"): lista interativa de assinaturas e custos fixos jovens com toggles de corte, cálculo em tempo real de alívio mensal e poupança anual.
    - `m1-l4` ("Remanejamento de emergência"): imprevisto urgente de R$ 200 com sliders de cortes em categorias flexíveis e medidor de reequilíbrio em tempo real.
    - `m1-l5` ("Detector de gatilhos"): chips de seleção de dias de cansaço/delivery com stepper de substituição por marmita caseira e projeção de economia anual.
- Sem migrations no banco e sem variáveis de ambiente novas.
- Como validei:
  - `pnpm content:build`: 9 módulos, 45 lições compilados.
  - `pnpm test`: 30 suítes de testes, 164 testes passando com sucesso no Vitest.
  - `pnpm --filter @tostao/api typecheck`: `tsc --noEmit` concluído com 0 erros.
  - `pnpm --filter @tostao/web typecheck`: `tsc --noEmit` concluído com 0 erros.
  - `pnpm build`: 84 rotas compiladas estática e dinamicamente sem falhas.

### 2026-11-14 · Antigravity · Unificação Tostão + Jarvis (Segundo Cérebro no WhatsApp/App)
- `apps/api/src/use-cases/tostao-tools.ts`: adicionadas as ferramentas `JARVIS_TOOLS` (`salvar_nota_obsidian`, `buscar_notas_obsidian`, `criar_flashcards_anki`) integradas ao cofre `/home/optiplex/obsidian_vault` e ao OptiPlex Hub 2.0 (`127.0.0.1:8088`).
- `apps/api/src/use-cases/ask-tostao.ts`: quando o usuário é o Pedro (`pereirahenrique0104@gmail.com` / `4ca4a890-737a-4ef2-aca0-945cae9d2feb`), ativa `[...TOSTAO_TOOLS, ...JARVIS_TOOLS]` e instruções de Segundo Cérebro no prompt de sistema, mantendo o histórico de 12 mensagens unificado.
- Fluxo n8n `TostaoWhatsApp01` (`Tostão & Jarvis - WhatsApp Unificado`): removida a bifurcação `É nota Obsidian?` e desativado o fluxo órfão `JcMHoyO6nNv8Qnl6`; agora 100% das mensagens de texto e áudio passam pelo cérebro único do `Tostão API` (`http://172.18.0.1:3334/whatsapp/n8n`).
- Sem migration. Validado com `pnpm --filter @tostao/api test` (161 testes passando) e `tsc --noEmit`.

### 2026-11-14 · Antigravity · Passo 1 (Function Calling do Tostão)
- `apps/api/src/gateways/ai-gateway.ts`: `ChatTurn`, `ToolDefinition`, `ToolCall`, `AiReply` e método `chat(messages, opts)` em `AiGateway`, `DeepSeekGateway` (suporte a `tools` e `tool_calls`) e `FakeAiGateway` (`queue` para testar loops).
- `apps/api/src/use-cases/tostao-tools.ts`: schemas e executor de `consultar_gastos_categoria`, `verificar_limite_categoria` e `registrar_transacao` (escopados por `userId`, respeitando `isInternalTransfer` e contas ocultas).
- `apps/api/src/use-cases/ask-tostao.ts`: loop agêntico com trava de `MAX_TOOL_ROUNDS = 5` (chamada final sem `tools` se atingir o limite) e lista de categorias disponíveis no contexto inicial.
- `apps/api/src/use-cases/ask-tostao.spec.ts` e `auto-categorize.spec.ts`: testes para o loop de `tool_calls`, criação de transação e limite de rodadas.
- Sem migration e sem env nova. Validado com `pnpm --filter @tostao/api test` (161 testes passando) e `tsc --noEmit`.
- Fora: streaming de resposta no front e ferramentas adicionais (ex.: `consultar_previsao`).
### 2026-11-15 · Claude · PR (claude/project-thread-ci76u5)
- Desktop igual ao artefato (telas 22, 32, 33, 34): menu lateral com item ativo escuro, ofensiva/XP e botão "Anotar gasto" no pé (`components/lateral.tsx`, `nav.tsx`); coluna da direita (xl) com "Aprender" e missões de hoje; `(app)/layout.tsx` busca /progress e /missions. Conteúdo central até 820px.
- Sem migration nem env. tsc web ok. Não validei no navegador (sem API/banco local); falta conferir lado a lado com o artefato.
- Fora: coluna da direita específica por tela (desafio da semana, batalha, contas na Carteira) e grid de 3 cards no topo do Início.
### 2026-11-15 · Claude · PR #29 (claude/project-thread-3oru9b)
- Missões: quando todas do dia estão feitas, o card encolhe pra "Tudo certo por hoje" (menta, uma linha). `components/engajamento.tsx` (`MissoesFeitas`, usado pelo `Missoes` no Início) e `app/(app)/aprender/page.tsx` (Tostão comemorando no lugar do professor).
- Sem migration nem env. `tsc` da web ok. Artefato: tela 12 (Aprender) espelha.

### 2026-11-13 · Claude · PR #27 (claude/project-thread-3oru9b)
- `use-cases/financial-plan.ts`: a previsão dizia "vai faltar R$ 528" em novembro por três motivos. (1) `spendingBase` usava agosto como base, mas o banco foi ligado em 14/08 (mês parcial); agora mês em que o primeiro dado cai depois do dia 5 fica de fora (`partial`). (2) O pote de dinheiro extra agora é da janela toda: acerto que entrou em outubro também cobre o excesso de setembro. (3) Resto do mês atual ia na base proporcional aos dias, repetindo contas grandes que já tinham caído (Pix de R$ 566 da casa); agora vai no ritmo do miúdo do mês (saídas abaixo de 15% da renda, mín. R$ 200, sem assinaturas) depois de 7 dias.
- Contrato: `ThisMonthForecast.dailyPaceInCents?` (opcional). Web: /previsao mostra "Dia a dia (17 dias × R$ 43,52)".
- Sem migration nem env. 159 testes (novo: ritmo do mês; base sem mês parcial). tsc api/web ok.
- Fora: Centauro (R$ 99,99) ainda é detectado como assinatura e Pix de empréstimo sem pessoa contam como gasto/renda: o Pedro marca "não é assinatura" e liga em Acertos.

### 2026-11-13 · Claude · PR #22 (claude/project-thread-lss5y7)
- WhatsApp via n8n + Evolution API. Rota `POST /whatsapp/n8n` (header `X-Tostao-Secret`, comparação em tempo constante) aceita `{ id, from, text, fromMe }` ou o webhook cru da Evolution (`messages.upsert`, `@lid` usa `remoteJidAlt`/`senderPn`) e devolve `{ replies: string[] }`. Grupo, `fromMe` e texto vazio são ignorados; id repetido não responde de novo.
- Anotar por texto: `services/parse-expense.ts` (sem IA) entende "gastei 25 no ifood", "paguei R$ 32,50 de uber ontem", "recebi 100 do pai" e cria via `CreateManualTransactionUseCase` (categoria por regra, senão `AutoCategorize`). Não conta no limite do chat. Resto vai pro `AskTostao`.
- `http/n8n-bridge.ts`: porta extra (`N8N_LISTEN_HOST`, `N8N_LISTEN_PORT`=3334) só com essa rota, repassando via `app.inject`; API segue no 127.0.0.1. Retenta a cada 30 s se o IP ainda não existir no boot.
- `N8nWhatsAppGateway.send()` posta `{ to, text }` em `N8N_WHATSAPP_SEND_URL` (etapa 2, avisos; nada dispara ainda).
- Sem migration. Env nova: `N8N_WHATSAPP_SECRET` (16+), `N8N_LISTEN_HOST` (no servidor `172.18.0.1`, gateway da `homelab_default`; o docker0 está DOWN), `N8N_LISTEN_PORT`, `N8N_WHATSAPP_SEND_URL`; reaproveita `WHATSAPP_NUMBER`.
- Validei com Vitest (144 passando, `whatsapp.spec.ts` + `parse-expense.spec.ts`) e `tsc`. Falta: deploy, .env no servidor e o fluxo no n8n; teste ponta a ponta com a Evolution.
- Riscos: parser é por regex (frase fora do padrão cai no chat); API não oficial pode ter o número banido (número dedicado).

### 2026-11-13 · Claude · PR #24 e #25 (claude/project-thread-3oru9b)
- `apps/api/src/jobs/daily-sync.ts`, `server.ts`, `env.ts`: o cron do sync não disparava (job sem referência). Agora guarda o job, loga início/fim/próximo, roda `0 6-23/3 * * *` e sincroniza no boot se a última tiver mais de 6 h. No servidor, a linha `SYNC_CRON` do `.env` foi comentada.
- `use-cases/financial-plan.ts` (`SuggestIncomeUseCase`, `recurringMonthly`): separa adiantamento, salário e acerto por faixa de valor (12%); faixa repete = 2+ entradas com 20+ dias entre a primeira e a última; sem repetição usa a mediana de uma entrada. Descrição de salário do banco (`SALARIO`, `C/SAL`, folha, proventos) aparece mesmo com 1 ocorrência.
- Sem migration. 134 testes passando. Deploy feito com backup.

### 2026-11-13 · Claude · PR #21 (claude/project-thread-3oru9b)
- Acertos: tabela `people` + `transactions.person_id` (migration `20261113230000_people`). Rotas `GET/POST /people`, `GET/DELETE /people/:id`, `POST /people/:id/entries`, `PUT /transactions/:id/person`. Telas `/acertos`, `/acertos/[id]`, bloco no detalhe do lançamento, card no Início, atalho no Perfil.
- Lançamento ligado a pessoa vira `isInternalTransfer` (sai de gasto e renda); `detectInternalTransfers` respeita `personId`, então o sync não desfaz.
- Validado com Vitest (`people.spec.ts`) e Playwright (marcar, anotar, saldo). Artefato v69, tela 55.

### 2026-11-13 · Claude · PR #20
- Previsão: dia a dia = mediana de 3 meses, sem o gasto pago com dinheiro extra (entrada > 1,3x a renda); `base` no `/forecast` com status ok/excecao/aperto. Plano anual parcelado não conta 2x. `duplicateOf` marca assinatura em dobro.

## Code Review

Achados do revisor (Gemini) sobre o `git diff` de cada entrega. Modelo:

```
### AAAA-MM-DD · revisor · PR #N
- [bloqueante|sugestão|nit] arquivo:linha: o problema e a correção proposta.
- Status: aberto | corrigido no commit X | descartado (motivo)
```

_(vazio)_
