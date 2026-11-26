# AGENT_SYNC

Quadro de passagem entre os agentes que mexem neste repo (Claude escreve o código, Gemini revisa o `git diff`).
Regra: **leia este arquivo antes de codar** e **registre o relatório ao terminar**. Entradas novas vão no topo de cada seção, com data, agente e branch/PR.
Histórico: [até 2026-11-21](docs/historico/agent-sync-ate-2026-11-21.md) · [2026-11-22 a 2026-11-24](docs/historico/agent-sync-2026-11-22-a-24.md).

---

## Plano

O que está pra ser feito agora, por quem e em que branch. Tire daqui quando for pra Execução.

- [ ] **Revisar conteúdo dos simuladores** (achado na migração, nada alterado). m2-l3 e `/compensa`: o texto compara o desconto com o CDI bruto, mas o veredito usa o líquido, e pode afirmar "12,4%, mais que os 14,9%". Taxas de referência: `TAXAS_REFERENCIA` com Selic 15% e m7-l1/m7-l4 com 11,15%/11,25%, contra 13,75% no currículo. m8-l4: "em poucos anos superaria toda a economia" não vale no padrão (cerca de 39 anos). m8-l2: com 0,70% e metas redondas pede 1 cota a mais. m7-l4: "IPCA+ sempre ganha da inflação" só no vencimento. m7-l2: a frase do teto global omite o excesso por banco. m6-l2: o saldo ignora saques já feitos. m8-l1/m8-l3: cenários ilustrativos sem aviso. m5-l1: texto "renda é o motor" mesmo quando guardar cedo vence. m2-l5: "melhor janela" em qualquer dia após o fechamento. m1-l5: sem dia marcado ainda conta 1 troca. m5-l5: lazer zerado ainda manda separar R$ 0,00. m4-l5: saldo zero usa o exemplo didático com o aviso de "seus números". m3-l3: nos extremos a contraoferta vira centavos.
- [ ] **Operação no servidor.** Pedro. Preencher `ALERT_WEBHOOK_URL` em `apps/api/.env` e testar (`pm2 stop tostao-web`); trocar a senha do `sudo`; conferir que a chave que abre o backup da nuvem também está guardada fora do servidor. Reconectar o WhatsApp: em 25/11 as 2 instâncias da Evolution estavam desconectadas.
- [ ] **Amigos no Pluggy (T6.5).** Pedro. Testar com 1 amigo; confirmar com o suporte do Pluggy se o plano permite; avisar que os dados ficam no servidor dele.
- [ ] **Decisões de produto.** Pedro. (1) "Quanto sobra no mês" projeta o ritmo de gasto e pode mostrar sobra enquanto o "posso gastar hoje" mostra falta.
- [ ] **Conferir em aparelho e serviço reais.** Pedro. Pix copia e cola num app de banco; compartilhar a imagem do mês no iPhone e no Android; abrir o CSV no Excel; DeepSeek e WhatsApp reais; widget do Pluggy; `NEXT_PUBLIC_LEGAL_CNPJ` se aplicável; faturas PDF, Atalhos do iOS e Share Target.
- [ ] **Backlog.** Logos de marcas (resto da T4.4).

## Execução

Relatório do que foi feito. Modelo:

```
### AAAA-MM-DD · agente · PR #N (branch)
- O que mudou (arquivos/rotas/tabelas).
- Migration? Variável de ambiente nova?
- Como validei (testes, rota, tela).
- O que ficou de fora / riscos.
```

### 2026-11-26 · Claude · Tostão maior no login e no cadastro (`feat/porquinho-maior-no-login`; nada publicado)

- `app/(auth)/layout.tsx`: o mascote vai até 720 px (antes 520), limitado por `88dvh`; os enfeites ficaram menores e mais no canto pra não ficarem atrás dele.
- Migration? Não. Env nova? Não.
- Como validei: `build`, `format:check` e `lint`; fotos de `/entrar` em 1024x768, 1280x720, 1366x650, 1440x900, 1920x950 e 2560x1300 (sem sobrepor logo nem enfeites, sem rolagem lateral) e em 390 px (painel segue escondido).
- Fora: a imagem original tem 479 px; passar de 720 px pede um desenho maior.

### 2026-11-25 · Claude · produção (merge dos PRs #54 a #56 e deploy, a pedido do Pedro)

- Checagem do GitHub passou nos 3 PRs; entraram na `main` com merge commit, nessa ordem. As linhas "nada publicado" abaixo valiam até aqui.
- `bash scripts/deploy.sh` às 15:12, sem rollback; migration `20261129100000_safe_to_spend_push` aplicada; servidor na `main` (`6e92bec`). Sem `--seed` (conteúdo das lições não mudou).
- Conferido: `/health` 200, `/entrar` 200 local e no domínio público, Política de Privacidade nova no ar, 42 migrations, coluna `notify_safe_to_spend` criada, 5 usuários (1 com aceite de IA) e 558 lançamentos, sem erro no log desde o restart.
- Não testado: telas logadas em produção, push das 9h em aparelho real.

### 2026-11-25 · Claude · imposto de 2026 e versão do consentimento (`fix/imposto-2026-e-consentimento`, em cima da T6.15)

- m6-l1 e m6-l5: `_simuladores/inss-irrf-clt.ts` com INSS (Portaria MPS/MF nº 13/2026), tabela mensal do IRRF 2026, desconto simplificado de R$ 607,20 e redução da Lei 15.270/2025. Nos valores iniciais o holerite passa de R$ 3.127,75 pra R$ 3.191,40 e a vantagem anual do PJ cai de R$ 4.814,67 pra R$ 238,13.
- `AI_CONSENT_VERSION` e `TERMS_VERSION` em `2026-11-25` (a pedido do Pedro, que é o único que usou o app: sem novo aceite). A tela "Isso é golpe?" avisa que nomes de terceiros e links vão junto.
- Aviso das 9h continua mostrando o valor na tela de bloqueio (decisão do Pedro).
- Migration? Não. Env nova? Não.
- Como validei: 5 exemplos oficiais da Receita reproduzidos no teste, mais isenção até R$ 5.000, virada dos R$ 7.350 e líquido que nunca cai quando o salário sobe.
- Fora: dependentes, pensão e previdência privada; as tabelas precisam ser conferidas todo janeiro.

### 2026-11-25 · Claude (e 3 agentes Claude) · T6.15: todos os simuladores no SimuladorShell (`feat/fase6-simuladores`, em cima das sobras; nada publicado)

- Os 42 que faltavam viraram um arquivo cada em `aprender/[licao]/_simuladores/`, com a conta em função pura (centavos) e um mapa por módulo; `simulators.tsx` virou só o registro; `simulators-m2-m5.tsx` e `simulators-m6-m9.tsx` apagados. m2-l3 ganhou simulador próprio (`/compensa` continua igual).
- Shell: palpite opcional (o quiz m9-l1 abre direto), `aviso`, número grande que encolhe com o cartão; `components/simulador-campos.tsx` (opções, sim ou não, lista, quadros). Selos azuis visíveis no tema escuro.
- Mudanças de tela além do layout: m6-l2 trocou botões de anos por régua; m9-l1 mostra um caso por vez e alterna a posição da certa; frases explicativas novas onde não havia (m4-l1, m4-l5, m7-l3, m7-l5, m8-l2, m9-l2, m9-l4); correções de português ("refeiçãoões", "1 meses", "milhões" no singular); m2-l3 ganhou limites nos campos.
- Migration? Não. Env nova? Não.
- Como validei: contas antigas copiadas nas specs e comparadas com as novas (todas as posições das réguas, amostra onde são milhões); `typecheck`, `lint`, `format:check`, testes (API 1220/1220 com Postgres e Redis descartáveis, web 1092/1092, contracts 39/39) e `build`; os 45 abertos pela lição numa pilha descartável, em 390 claro e 320 escuro: sem erro de JavaScript, sem rolagem lateral nem alvo menor que 44 px.
- Fora: sem aparelho real; conteúdo e taxas não revisados (ver Plano).

### 2026-11-25 · Claude · sobras da Fase 6 (`feat/fase6-sobras`; nada publicado)

- `/mais`: período da planilha (tudo, este mês, mês passado, este ano) em `lib/periodo-csv.ts`; a API já aceitava `from`/`to`.
- Aviso de IA e Política de Privacidade citam a mensagem colada em "Isso é golpe?"; a Política tem data própria (`legal.privacyUpdatedDate`).
- Layout do app não espera mais `/progress`, `/missions` e `/tostao/auto`: o menu vem por `<Suspense>` (`components/menu-com-dados.tsx`).
- Aviso diário "quanto posso gastar hoje" por push, das 9h às 12h, uma vez por dia, desligado por padrão e com interruptor próprio em `/mais/alertas` (vale mesmo com os avisos urgentes desligados). Sem renda informada, não manda. O valor aparece na tela de bloqueio.
- Migration: `20261129100000_safe_to_spend_push` (aditiva, `tostao_auto_configs.notify_safe_to_spend`). Env nova? Não.
- Como validei: `typecheck`, `lint`, `format:check`; API 1220/1220 com Postgres e Redis descartáveis (na primeira rodada completa o teste de contagem de queries do resumo do mês falhou uma vez e passou nas repetições), web 865/865, contracts 39/39; `migrate diff` sem diferença.
- Telas conferidas numa pilha descartável (390, 320 escuro e 1440): baixar "Mês passado" gera o arquivo do período e o interruptor das 9h continua marcado depois de recarregar.
- Fora: push em aparelho real; abrir a planilha no Excel.

### 2026-11-25 · Claude · produção (merge dos PRs #47 a #52 e deploy, a pedido do Pedro)

- Checagem do GitHub passou no conjunto completo antes do merge; os 6 PRs entraram na `main` com merge commit (`3b6a9fb`).
- `bash scripts/deploy.sh` às 09:57, em 48 s, sem rollback; migrations `20261127100000_user_pix_key` e `20261128100000_user_home_prefs` aplicadas; servidor na `main`.
- Conferido: `/health` 200, `/entrar` 200 local e no domínio público, rotas novas pedindo login (401), 41 migrations, 5 usuários e 558 lançamentos, sem erro no log.
- Fora do repo: `stop_grace_period: 60s` no serviço `postgres` do `~/homelab/docker-compose.yml` (cópia do arquivo anterior ao lado) e `docker compose up -d --no-deps postgres`, com `pg_dumpall` antes. Falta confirmar no desligamento desta noite que o log mostra `database system was shut down`.
- Não testado: aparelho real, Pix no app do banco, DeepSeek, WhatsApp e Pluggy.

### 2026-11-25 · Claude · PR #52 (Início: saldo no topo e "posso gastar hoje" pequeno, a pedido do Pedro)

- O saldo é o primeiro cartão; avisos de conexão e de instalar o app vêm depois dele.
- "Posso gastar hoje" virou uma linha de 56 px abaixo do saldo; tocar abre uma janela com a conta (fecha no botão, no Esc ou fora). Mês no vermelho: "Falta R$ X", sem sinal de menos. Sem renda, a mesma linha leva a `/renda`. Troca a posição prevista na T6.17.
- Migration? Não. Env nova? Não.
- Como validei: `typecheck`, `lint`, `format:check`; testes web 857/857; capturas em 320, 390 e 1440 px (positivo, falta e sem renda), claro e escuro; valores escondidos pelo olho também na janela.
- Fora: sem teste em aparelho real.

### 2026-11-25 · Claude · servidor (conferência depois do boot, sem mudança)

- Boot das 08:29: o Postgres ficou em recuperação até 08:33; a API esperou (`[boot]`), subiu às 08:33:30 com **0 reinícios** e `/health` 200. Fica provada em produção a T6.2 (e o desligamento limpo da T6.1 às 00:30). Banco: 5 usuários, 557 lançamentos, 39 migrations.
- Desde esse boot a API em produção roda o código da T6.4 que já estava em disco (a árvore do servidor segue na `fix/fase6-refresh-grace`).

### 2026-11-25 · Claude · Fase 6: T6.8 a T6.14, T6.16 a T6.21 e correções (PRs empilhados sobre o #48)

Feito em cópia separada; **nada publicado, produção sem mudança**. Um commit por tarefa; veja `git log`.

- **Capturas (T6.8):** `pnpm shots` (Playwright em Docker, usuário demo em script separado que recusa produção).
- **Início (T6.9 a T6.11, T6.17):** blocos com Suspense (saldo de ~3,06 s pra ~0,06 s com `/forecast` +3 s); padrão enxuto; `/mais/jogos`; preferências na conta (`/me/home-prefs`); "quanto posso gastar hoje" (`use-cases/safe-to-spend.ts`; "Guardei" passa a registrar o depósito do mês).
- **Tipografia (T6.12):** tokens em Home, Carteira, Anotar e navegação; mínimo 12 px (dinheiro 13) com guarda.
- **Simuladores (T6.13, T6.14):** `SimuladorShell` + 3 pilotos; galeria com "Antes de mexer". Contas conferidas iguais às antigas.
- **Novidades (T6.16, T6.18 a T6.21):** Cobrar no Pix; avisos de reajuste e cobrança chegando (só com preço firme); imagem do mês; "Isso é golpe?"; CSV.
- **Correções:** sessão com um ramo vivo e trava contra logout simultâneo; deploy com rollback de código e `.next` e sem travar com página apagada; monitor; `homelab-setup.sh` com pm2 de processo único; "banco ligado" não vira falha; `POST /chat` não cai aos 10 s; previsão sem desconto em dobro e com o valor na frase; selo de metas; teste de e-mail repetido instável.
- **Migration:** `20261127100000_user_pix_key`, `20261128100000_user_home_prefs` (aditivas). **Env nova:** nenhuma em produção (`SHOTS_*`/`DEMO_*` só pros prints). **Dependência:** `playwright` (dev).
- **Como validei:** `format:check`, `typecheck`, `lint`; testes API 1213/1213 (com Postgres e Redis descartáveis), web 857/857, contracts 39/39; `next build` pelo `pnpm shots`; capturas das telas principais e dos pilotos sem erro; migrations numa cópia do backup (5 usuários e 557 lançamentos intactos) e `migrate diff` sem diferença; restauração dos dois formatos de backup de 23/11.
- **Fora:** T6.15; nada testado em aparelho real nem com Pluggy, DeepSeek, WhatsApp ou deploy real; limites da conta do "posso gastar hoje" (fixa com dia passado conta como paga; depósito de meta anterior ao deploy não é reconhecido).

## Code Review

Achados do revisor (Gemini) sobre o `git diff` de cada entrega. Modelo:

```
### AAAA-MM-DD · revisor · PR #N
- [bloqueante|sugestão|nit] arquivo:linha: o problema e a correção proposta.
- Status: aberto | corrigido no commit X | descartado (motivo)
```

### 2026-11-24 · Claude (agente revisor) · T6.1 a T6.7

- [bloqueante] `scripts/deploy.sh`: tipos velhos de `.next` quebravam o build isolado quando uma página sumia. Status: corrigido.
- [importante] `scripts/deploy.sh`: rollback não voltava a API e havia falhas sem rollback. Status: corrigido.
- [importante] refresh token: a janela de 30 s permitia sessão paralela sem detecção. Status: corrigido.
- [importante] `scripts/homelab-setup.sh` subia o pm2 do jeito antigo. Status: corrigido.
- [sugestão] monitor com URL vazia/disco cheio, ESLint em builds antigos, erros em `/conectar`, logout simultâneo. Status: corrigidos.
