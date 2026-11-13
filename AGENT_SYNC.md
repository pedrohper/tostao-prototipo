# AGENT_SYNC

Quadro de passagem entre os agentes que mexem neste repo (Claude escreve o código, Gemini revisa o `git diff`).
Regra: **leia este arquivo antes de codar** e **registre o relatório ao terminar**. Entradas novas vão no topo de cada seção, com data, agente e branch/PR.

---

## Plano

O que está pra ser feito agora, por quem e em que branch. Tire daqui quando for pra Execução.

- [ ] **WhatsApp via n8n + Evolution API**: rota `POST /whatsapp/n8n` (header `X-Tostao-Secret`), etapa 1 = chat com o Tostão + anotar gasto por texto; etapa 2 = avisos ativos via `N8N_WHATSAPP_SEND_URL`. Claude, thread "Ligar WhatsApp do n8n no Tostão", branch `claude/project-thread-lss5y7`.
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
