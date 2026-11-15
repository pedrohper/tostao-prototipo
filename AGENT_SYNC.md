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
