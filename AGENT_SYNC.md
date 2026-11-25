# AGENT_SYNC

Quadro de passagem entre os agentes que mexem neste repo (Claude escreve o código, Gemini revisa o `git diff`).
Regra: **leia este arquivo antes de codar** e **registre o relatório ao terminar**. Entradas novas vão no topo de cada seção, com data, agente e branch/PR.
Histórico: [até 2026-11-21](docs/historico/agent-sync-ate-2026-11-21.md) · [2026-11-22 a 2026-11-24](docs/historico/agent-sync-2026-11-22-a-24.md).

---

## Plano

O que está pra ser feito agora, por quem e em que branch. Tire daqui quando for pra Execução.

- [ ] **Mergear os PRs da Fase 6, em ordem, com "merge commit" (sem squash).** Pedro. #47 → #48 → os empilhados em cima deles. Cada um tem como base o anterior.
- [ ] **Primeiro deploy com o script novo.** Pedro. Há 2 migrations aditivas (`20261127100000_user_pix_key`, `20261128100000_user_home_prefs`), ensaiadas numa cópia do backup de 24/11. Sem env nova.

  ```bash
  cd ~/homelab/tostao-prototipo
  mv docs/producao/07-PROMPTS-ANTIGRAVITY.md ~/        # arquivo solto trava o deploy
  git fetch && git checkout main && git merge --ff-only origin/main
  bash scripts/deploy.sh
  ```

  Só nesta primeira vez o rollback automático não volta o código (o `pull` já aconteceu). Se a API não subir: `git checkout fix/fase6-refresh-grace && pm2 restart tostao-api tostao-web`.

- [ ] **Aprovar os 3 simuladores modelo (T6.13).** Pedro. Só depois disso fazer a T6.15 (migrar os outros).
- [ ] **Operação no servidor.** Pedro. Preencher `ALERT_WEBHOOK_URL` em `apps/api/.env` e testar (`pm2 stop tostao-web`); trocar a senha do `sudo`; conferir que a chave que abre o backup da nuvem também está guardada fora do servidor.
- [ ] **Postgres é morto no desligamento das 00:30 (visto em 24 e 25/11).** Pedro. O `root` desliga o servidor toda noite (`rtcwake` + `shutdown`) e o Docker mata o Postgres antes do checkpoint terminar; no boot ele faz recuperação (~2 min fora do ar em 25/11; dados íntegros). Em `~/homelab/docker-compose.yml`, no serviço `postgres`, acrescentar `stop_grace_period: 60s` e rodar `docker compose up -d postgres` (reinicia o banco).
- [ ] **Amigos no Pluggy (T6.5).** Pedro. Testar com 1 amigo; confirmar com o suporte do Pluggy se o plano permite; avisar que os dados ficam no servidor dele.
- [ ] **Decisões de produto.** Pedro. (1) O cartão "posso gastar hoje" negativo mostra "-R$ X é o que falta": manter o sinal? (2) "Quanto sobra no mês" projeta o ritmo de gasto e pode mostrar sobra enquanto o cartão mostra falta. (3) Citar a mensagem colada em "Isso é golpe?" no aviso de IA e na Política de Privacidade.
- [ ] **Conferir em aparelho e serviço reais.** Pedro. Pix copia e cola num app de banco; compartilhar a imagem do mês no iPhone e no Android; abrir o CSV no Excel; DeepSeek e WhatsApp reais; widget do Pluggy; `NEXT_PUBLIC_LEGAL_CNPJ` se aplicável; faturas PDF, Atalhos do iOS e Share Target.
- [ ] **Backlog.** Logos de marcas (resto da T4.4); o layout do app ainda espera `/progress`, `/missions` e `/tostao/auto` antes de desenhar; ícones das explicações dos simuladores quase somem no tema escuro.

## Execução

Relatório do que foi feito. Modelo:

```
### AAAA-MM-DD · agente · PR #N (branch)
- O que mudou (arquivos/rotas/tabelas).
- Migration? Variável de ambiente nova?
- Como validei (testes, rota, tela).
- O que ficou de fora / riscos.
```

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
