# AGENT_SYNC

Quadro de passagem entre os agentes que mexem neste repo (Claude escreve o código, Gemini revisa o `git diff`).
Regra: **leia este arquivo antes de codar** e **registre o relatório ao terminar**. Entradas novas vão no topo de cada seção, com data, agente e branch/PR.

---

## Plano

O que está pra ser feito agora, por quem e em que branch. Tire daqui quando for pra Execução.

- [ ] **"É pagamento de fatura" / "Transferi pra outra conta minha"** no detalhe do lançamento: liga ao cartão ou à conta, sai do gasto e aparece no lugar certo. Claude, thread "Deixar o Tostão pronto pros testadores". Aguardando o Pedro terminar a descrição da transferência entre bancos.
- [ ] **"Vale a pena parcelar?" e "Escada do dinheiro"** (onde investir, só educativo). Claude, thread "Ensinar juros e onde investir".

## Execução

Relatório do que foi feito. Modelo:

```
### AAAA-MM-DD · agente · PR #N (branch)
- O que mudou (arquivos/rotas/tabelas).
- Migration? Variável de ambiente nova?
- Como validei (testes, rota, tela).
- O que ficou de fora / riscos.
```

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
