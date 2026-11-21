# Fase 4 (P2/Comercial) — Polimento Visual, UX de App Nativo e Conversão

> **Objetivo:** Elevar a interface do Tostão do nível "funcional" para o nível **produto comercial vendável** (Nubank / Duolingo / Mobills), eliminando fricções de onboarding, trazendo gráficos e streaming de IA em tempo real, logos de marcas, lições conectadas ao extrato real e uma landing page que converte.
> **Pré-requisito:** Fases 0, 1 e 2 concluídas (a Fase 4 estende o acabamento de `T2.4` e `T2.5` sem duplicá-los).

---

## T4.1 — Toast Global com "Desfazer", Prompt de Instalação PWA, Nav & Dark Mode

- [ ] Concluída

### Problema atual

1. Só existe feedback visual para conclusão de missão (`components/sons.tsx:31-77`). Mutações do dia a dia (anotar gasto, categorizar, apagar, salvar meta/limite, copiar link) não dão toast consistente nem opção de "Desfazer".
2. Existe `public/manifest.webmanifest` e `public/sw.js`, mas nenhum banner/prompt orientando a instalação como app (`beforeinstallprompt` no Android/Desktop + tutorial visual iOS Safari "Adicionar à Tela de Início").
3. `components/nav.tsx:27-63` não inclui `/anotar` em `isRouteActive`, aplica `dark:invert` só no ícone inativo da tab bar (`L132`), e há redundância de entradas entre `/mais`, `/perfil`, `/carteira/editar` e `/conectar`.
4. `apps/web/app/globals.css:47-87` mantém cores vibrantes com a mesma luminosidade no modo escuro, reduzindo conforto visual noturno.

### Correção técnica

1. **Sistema global de Toast (`apps/web/components/toast.tsx` + `app/(app)/layout.tsx`):**
   - Criar `ToastProvider` + hook `useToast()` com suporte a variantes (`success`, `error`, `info`) e botão opcional de ação (`Desfazer`, ex.: restaurar transação ou desfazer categorização), respeitando `prefers-reduced-motion` e `aria-live="polite"`.
   - Integrar nas principais ações de `carteira`, `anotar`, `meta`, `limites`, `convites` e `tostao-auto-card`.
2. **Prompt de Instalação PWA (`apps/web/components/pwa-install-banner.tsx`):**
   - Capturar `beforeinstallprompt` no Chrome/Android/Edge para oferecer card dispensável ("Instalar Tostão no celular") em `/inicio` ou `/mais`.
   - Detectar iOS Safari (`!standalone`) e exibir mini-guia visual com ícone de Compartilhar + "Adicionar à Tela de Início" (dispensável e salvo em preferência local).
3. **Navegação & Tokens Dark Mode:**
   - Incluir `/anotar` no estado ativo de `/carteira` em `apps/web/components/nav.tsx:29-42`.
   - Revisar contraste e saturação dos tokens em `:root[data-theme='dark']` (`apps/web/app/globals.css:47-87`) e harmonizar ícones inativos no escuro sem inversão brusca de cores quentes.
   - Consolidar fluxos redundantes de gestão de contas bancárias em `/mais` e `/perfil` apontando claramente para `/conectar` (conexões Open Finance / importar) e `/carteira?aba=contas` (editar/ocultar contas).

### Critérios de aceite & testes

- Salvar, categorizar ou excluir transação exibe toast imediato; banner PWA aparece em navegador elegível e desaparece ao dispensar ou rodar em modo `standalone`.

---

## T4.2 — Onboarding Guiado sem Fricção & Empty State Motivador ("Aha Moment" em 60s)

- [ ] Concluída

### Problema atual

1. Após criar conta (`app/(auth)/actions.ts:52` → `/conectar?novo=1`), o usuário já cai dentro do `app/(app)/layout.tsx:24-42` com todas as 5 abas expostas, dispersando o foco do fluxo de ativação.
2. `/conectar?novo=1` (`app/(app)/conectar/page.tsx:108-312`, `forms.tsx:98-101`) é denso e expõe detalhes técnicos/internos (`Item ID` UUID, instruções longas de `MeuPluggy`) com botões de avanço só no fim da página.
3. `/renda?novo=1` (`app/(app)/renda/renda-form.tsx:475`) bloqueia o botão "Continuar" com `disabled={!salaryCents}`, travando autônomos, estudantes e quem tem renda variável.
4. `/meta` vazio (`app/(app)/meta/page.tsx:53-71`) mostra só um formulário seco sem presets nem simulação em tempo real.
5. **Empty State punitivo na Home:** `app/(app)/inicio/page.tsx:133,646-660,999-1014` oculta **toda** a Home (inclusive a renda e a meta que o usuário acabou de configurar!) e mostra apenas o Tostão dormindo ("Nada por aqui ainda").

### Correção técnica

1. **Modo Onboarding Focado (`app/(app)/layout.tsx` + `/conectar` + `/renda`):**
   - Criar `OnboardingShell` (barra de progresso 1 → 2 → 3 e botão "Fazer depois", ocultando a `Nav` completa enquanto estiver nos passos `?novo=1`).
   - Simplificar `/conectar?novo=1`: apresentar 3 cartões limpos de escolha imediata (**Conectar banco via Open Finance**, **Importar extrato OFX/CSV**, **Anotar manualmente**), movendo `"Já tenho um Item ID"` e notas técnicas apenas para um bloco recolhido de suporte/avançado (e mantendo `BANK_GATEWAY=fake` oculto em produção conforme T2.5).
   - Em `/renda?novo=1` (`renda-form.tsx:475`): permitir avançar selecionando **"Minha renda varia / prefiro preencher depois"** ou preenchendo qualquer fonte em "Outras entradas", sem exigir salário fixo.
2. **Presets e Simulador na Meta (`apps/web/app/(app)/meta/page.tsx` + `forms.tsx`):**
   - Adicionar presets clicáveis no estado vazio ("Reserva de 3 meses", "Quitar cartão", "Viagem", "Notebook/Equipamento") + barra ao vivo mostrando _"Guardando R$ X/mês você chega lá em MMM/AAAA"_.
3. **Home de Primeiros Passos (`apps/web/app/(app)/inicio/page.tsx:133,646-660`):**
   - Substituir o `emptyStateCard` solitário por um **Checklist Interativo de Ativação** (Conectar ou importar banco, Anotar 1º gasto, Definir meta, Fazer 1ª lição de 2 min), **preservando visíveis** os cards do plano financeiro/meta/aula já preenchidos e oferecendo botão direto de **"Testar com 1º gasto agora"** ou **"Explorar 1ª lição"**.

### Critérios de aceite & testes

- Usuário recém-criado consegue concluir ou pular o onboarding em ≤ 3 toques mesmo sem salário fixo, e quem configurou Renda/Meta vê seu plano imediatamente na Home.

---

## T4.3 — Home Enxuta, Paridade Mobile/Desktop e Gráficos Interativos

- [ ] Concluída

### Problema atual

1. `lib/inicio-prefs.ts:8-20` ativa **11 seções por padrão** no mobile, e `inicio/page.tsx:299-351,1003-1009` duplica alertas entre `TostaoFindingsBoard` e a seção `avisos`.
2. **Bug visual no Desktop (`inicio/page.tsx:49,723-755`):** a barra empilhada usa cores fixas por índice (`BAR_SEGMENT_CLASSES`), não correspondendo às cores reais das categorias (`cat.color`) listadas logo abaixo.
3. **Mobile empobrecido:** `AskTostaoCard` (`inicio/ask-card.tsx`), badge _"Mês no azul / no aperto"_ e desafio semanal só aparecem no Desktop (`inicio/page.tsx:846-924,1028-1064`); `pt-br.ts:44` define `greeting(name)` mas não é usada no header mobile; falta botão rápido `+ Anotar gasto` na Home mobile e o 1º atalho laranja (`planejar-atalhos.tsx:23-29`) aponta para `/anotacoes` em vez de `/anotar`.
4. `MobileBalanceCard` (`balance-card.tsx:174-227`) não mostra variação vs mês anterior nem resumo de faturas abertas; sem banco conectado exibe só texto cinza de 13px sem CTA.
5. `components/graficos.tsx` possui apenas 3 barras CSS estáticas sem tooltips interativos, sem clique pra filtrar e sem evolução mensal na Home.

### Correção técnica

1. **Hierarquia enxuta da Home (`lib/inicio-prefs.ts`, `inicio/page.tsx`):**
   - Reduzir seções ligadas por padrão para **5–6 blocos essenciais** (Saldo + Fluxo do mês, Achados/Alertas unificados top 2, Pra onde foi + Limites, Meta/Previsão, Aula da semana), removendo duplicação entre `avisos` e `TostaoFindingsBoard` (deixar os demais ativáveis em `/inicio/personalizar`).
   - Corrigir `inicio/page.tsx:49,723-755` para usar `cat.color` real em cada segmento da barra empilhada.
2. **Paridade Mobile & Atalhos:**
   - Adicionar saudação personalizada + badge do mês no topo mobile (`inicio/page.tsx:985-995`), `AskTostaoCard` compacto no mobile e FAB/botão `+ Anotar gasto` acessível na Home.
   - Corrigir o 1º atalho de `apps/web/app/(app)/inicio/planejar-atalhos.tsx:23-29` para apontar diretamente para `/anotar`.
   - Enriquecer `MobileBalanceCard` / `DesktopBalanceRow` (`balance-card.tsx`) com variação percentual vs mês anterior, total de faturas abertas e CTA direto para `/conectar` quando não houver contas conectadas.
3. **Gráficos Interativos (`apps/web/components/graficos.tsx`):**
   - Evoluir `MonthlyBars`, `CategoryBars` e adicionar `CashflowLineChart` (SVG responsivo leve, sem pesar o bundle) com:
     - Tooltip interativo ao tocar/passar o mouse mostrando valores exatos (`tabular-nums`) e % da renda/gasto.
     - Clique nas barras mensais navegando para o mês correspondente (`?mes=YYYY-MM`).
     - Clique nas categorias levando diretamente para `/carteira?categoria=...&mes=...`, exibindo `<Icon>` da categoria.

### Critérios de aceite & testes

- Cores da barra empilhada no desktop batem 1:1 com a legenda de categorias.
- Tooltips funcionam por toque (mobile) e mouse/teclado (desktop) sem causar hydration mismatch.

---

## T4.4 — Carteira Nativa, Anotar em 3 Toques e Logos de Marcas Populares

- [ ] Concluída

### Problema atual

1. `/anotar` (`anotar/page.tsx`, `anotar-form.tsx:106-203`) abre página SSR inteira, sem máscara de moeda automática, sem chips "Hoje/Ontem", categorias sem ícones, sem autocomplete de descrições recentes, sem opção "Salvar e anotar outro".
2. Na Carteira (`carteira/page.tsx:283-313`, `transaction-row.tsx:27-59,348-388`):
   - Busca (`transaction-row.tsx:27-59`) força Enter e joga para `/carteira/busca`, perdendo o contexto do extrato.
   - Filtro por conta/cartão está preso em `hidden lg:flex` (`carteira/page.tsx:283-313`), indisponível no mobile.
   - Categorizar vários lançamentos pendentes exige abrir e voltar página por página.
3. **Sem logos de marcas:** `assinaturas/page.tsx:137-158` é 100% texto e `transaction-row.tsx:348-371` mostra apenas o ícone genérico de categoria mesmo para Netflix, Spotify, iFood, Uber, Amazon, Mercado Livre etc.
4. Detalhe da transação (`carteira/[id]/page.tsx:95-188`) fragmenta 6 formulários separados e não permite dar nome amigável a transações importadas com descrição bancária críptica.

### Correção técnica

1. **Pacote local de logos de marcas (`apps/web/lib/brand-logos.ts` + `apps/web/components/brand-logo.tsx`):**
   - Criar mapa enxuto de **25–30 marcas recorrentes brasileiras** (iFood, Uber, 99, Netflix, Spotify, YouTube, Amazon/Prime, Mercado Livre, Shopee, Shein, Apple, Google, Steam, PlayStation, Xbox, Smart Fit, Wellhub/Gympass, Vivo, Claro, Tim, Renner, Magalu, Drogasil, Raia, Rappi, Airbnb) usando SVGs leves locais + matcher por `merchantName`/`description`, com fallback automático para o `<Icon>` da categoria.
   - Aplicar `BrandLogo` em `apps/web/app/(app)/assinaturas/page.tsx:137-158` (transformando a lista textual em cards visuais ricos com calendário/próxima cobrança) e em `transaction-row.tsx:348-371`.
2. **Anotar gasto sem fricção (`apps/web/components/quick-add-sheet.tsx` + `anotar/anotar-form.tsx`):**
   - Adicionar máscara monetária automática em tempo real (digitando centavos ou decimal limpo), chips rápidos **"Hoje" / "Ontem"**, ícones nas pills de categoria, sugestões das últimas descrições usadas, nota colapsável (`+ Adicionar nota`) e botão **"Salvar e anotar outro"**.
   - Disponibilizar abertura rápida via bottom sheet na Carteira e na Home (mantendo `/anotar` acessível por URL direta).
3. **Carteira & Categorização em lote (`apps/web/app/(app)/carteira/page.tsx`, `transaction-row.tsx`, `carteira/[id]/page.tsx`):**
   - Expor filtro de conta/cartão no mobile (dentro do dropdown/barra de filtros mobile).
   - Adicionar busca instantânea com debounce inline na barra do extrato (atualizando URL/resultados sem perda de foco) mantendo `/carteira/busca` para busca global multi-mês.
   - Adicionar **modo "Categorizar pendentes"** (ou picker inline de 1 toque na aba Pendentes) permitindo categorizar múltiplas transações seguidas sem trocar de página.
   - No detalhe (`carteira/[id]/page.tsx`), permitir editar um apelido/descrição amigável (`customDescription` ou via PATCH) para transações bancárias mantendo a descrição original do banco no rodapé para conciliação, e organizar os 6 sub-formulários em seções limpas com ações claras.

### Critérios de aceite & testes

- Testes unitários de matching em `brand-logos.spec.ts` (sem falsos positivos entre nomes curtos).
- No mobile (`375px`), usuário consegue filtrar por conta/cartão, buscar e categorizar pendentes com ≤ 2 toques.

---

## T4.5 — Chat IA com Streaming & Cards Ricos + Lições com Dados Reais + Landing Page Comercial

- [ ] Concluída

### Problema atual

1. **Chat (`chat/actions.ts:14-25`, `chat-client.tsx:13-48,120-131,242-288`):** espera síncrona de 5–12s sem streaming; parser `Rich` só suporta negrito/bullets (sem cards visuais); chips de sugestão estáticos; card de confirmação (`proposal`) sem preview editável; altura rígida `calc(100dvh-12.5rem)` frágil com teclado mobile.
2. **Aprender desconectado da promessa (`aprender/[licao]/page.tsx:15-40`, `player.tsx:112-126,133-142,206-235`, `simulators*.tsx`):** lições não lêem os gastos reais do usuário (usam números hardcoded); falta botão "Voltar etapa" no player; Dilema repete "Opção A/B" no enunciado e nos botões; simuladores usam sliders `<input type="range">` crus e emojis nativos (`⚠️`, `🚨`, `🎯`); não há galeria direta de simuladores.
3. **Landing Page (`app/(site)/landing.tsx`, `chrome.tsx`):** zero screenshots/mockups reais do app, esconde Chat IA / Tostão WhatsApp / Tostão Automático / Previsão / Assinaturas / Acertos, não tem seção de Planos/Preços, não tem FAQ nem prova social, restringe público a "20 anos" (`L227`).

### Correção técnica

1. **Chat com Streaming (SSE) & Cards Ricos:**
   - Adicionar rota streaming `POST /chat/stream` na API (usando `stream: true` na DeepSeek após resolução de tools, enviando eventos `status` _"Consultando seu extrato..."_, `delta` de texto e `done` com `pendingAction` + `followUps`).
   - Atualizar `chat-client.tsx` (via Route Handler BFF `/api/chat/stream` autenticando com o cookie `httpOnly`) para exibir tokens chegando em tempo real, renderizar **cards estruturados inline** (resumo de categoria, meta, link direto para tela) e exibir o card de confirmação de transação com campos claros (**Valor, Descrição, Categoria, Data**) antes de confirmar.
   - Trocar altura fixa por layout flexível (`min-h-0 flex-1` com `dvh`) compatível com teclado virtual mobile e gerar 2–3 sugestões contextuais após cada resposta.
2. **Aprender conectado ao extrato real & Galeria de Simuladores:**
   - Em `apps/web/app/(app)/aprender/[licao]/page.tsx`: buscar resumo mensal + plano financeiro + assinaturas do usuário (com fallback elegante caso ainda não tenha dados) e passar `userContext` para personalizar o **Gancho ("Seu extrato")** com os números reais do usuário e pré-preencher os simuladores (`AjusteDasFatias`, `Juros`, `Assinaturas`, `Reserva` etc.).
   - Em `apps/web/app/(app)/aprender/[licao]/player.tsx`: adicionar botão **"Voltar"** entre passos; limpar duplicação "Opção A / Opção B" no card do Dilema.
   - Criar componente `<TostaoSlider>` estilizado no design system e substituir emojis nativos (`⚠️`, `🚨`, `🎯`) em `simulators*.tsx` por ícones/badges do Tostão.
   - Criar página `/aprender/simuladores` listando os principais simuladores práticos (Parcelado vs À Vista, Reserva de Emergência, Juros Compostos, Bola de Neve de Dívidas, Assinaturas no Ano etc.) acessíveis a qualquer momento sem precisar abrir uma lição.
3. **Landing Page de Alta Conversão (`apps/web/app/(site)/landing.tsx` + `site.module.css`):**
   - Criar vitrine visual interativa (com abas/mockups fiéis das telas reais: Início, Chat Tostão IA, Tostão no WhatsApp, Assinaturas e Simuladores).
   - Adicionar seção **"Tudo num lugar só"** destacando explicitamente: Open Finance + Planilha automática, Chat IA + WhatsApp, Tostão Automático (alertas proativos), Previsão de 3 meses, Acertos com amigos e 45 lições práticas.
   - Adicionar seção de **Planos transparente** (ex.: _Gratuito no Lançamento / Beta Aberto_ vs _Plano Completo — em breve_, explicando o compromisso de zero venda de dados) e **FAQ** respondendo às principais objeções de confiança (segurança do Open Finance, uso sem conectar banco, cancelamento/LGPD).
   - Ajustar copy em `landing.tsx:227` removendo a limitação etária ("todo mundo de 20 anos") para acolher jovens adultos e quem busca clareza financeira em qualquer fase.

### Critérios de aceite & testes

- Streaming de chat funciona de ponta a ponta (inclusive fallback gracioso se streaming cair ou em `FakeAiGateway`).
- Lição M1-L1/M1-L2 exibe valores reais quando o usuário possui extrato/renda e valores didáticos quando vazio.
- Landing page passa no `pnpm build`, responsivo mobile/desktop sem overflow horizontal.
