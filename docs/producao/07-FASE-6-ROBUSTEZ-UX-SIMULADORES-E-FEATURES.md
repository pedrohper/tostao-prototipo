# Fase 6 — Robustez em Produção, UX/UI, Simuladores e Features Novas

> **Origem:** revisão completa de 2026-11-24 (Claude), feita sobre o código, os logs do pm2, o banco e o Pluggy reais.
> **Objetivo:** tirar as quedas que já aconteceram em produção, deixar a Home e os simuladores mais claros e
> preparar o app pra uns amigos do Pedro usarem com o Pluggy dele. **Sem overengineering:** é um servidor só,
> com ~5 pessoas usando.
> **Esta fase substitui, por enquanto, a T3.1 (Docker multi-stage) e a T3.3 (worker BullMQ) da Fase 3.** Com
> uma instância e 5 usuários, os crons do croner com lock no Redis dão conta. Reavaliar quando houver mais de
> uma réplica.
> **Fora do escopo:** tradução (o lançamento é só PT-BR, ver `00-INDICE.md` decisão 4), billing, Docker e filas.

## Ordem de execução (1 PR por bloco)

| PR    | Tarefas          | Por quê nessa ordem                                                       |
| ----- | ---------------- | ------------------------------------------------------------------------- |
| 1     | T6.1, T6.2, T6.3 | Quedas reais em produção (EADDRINUSE em loop, API subindo antes do banco) |
| 2     | T6.4             | Logouts forçados (2 `refresh_reuse_detected` em 14 dias com 5 usuários)   |
| 3     | T6.5             | Deixar os amigos conectarem banco com segurança                           |
| 4     | T6.6, T6.7       | Deploy repetível e um `AGENT_SYNC.md` confiável                           |
| 5     | T6.8             | Prints das telas: as próximas PRs de UI precisam ser vistas               |
| 6     | T6.9             | Home mais rápida (Suspense)                                               |
| 7     | T6.10, T6.11     | Home enxuta e preferências no servidor                                    |
| 8     | T6.12            | Escala de design (tokens)                                                 |
| 9     | T6.13, T6.14     | Simuladores: base nova + 3 pilotos + galeria                              |
| 10    | T6.15            | Simuladores: o restante, **só depois do Pedro aprovar os pilotos**        |
| 11–16 | T6.16 a T6.21    | Features novas, uma por PR                                                |

---

## BLOCO A — Operação

## T6.1 — Processo único no pm2 + desligamento limpo

- [x] Concluída (código, testes e config prontos; a troca do pm2 em produção é do Pedro (AGENT_SYNC > Plano))

### Problema atual

- `~/homelab/ecosystem.config.cjs` roda a API e a web via `bash -c "pnpm start:api"`. São 5 camadas
  (`bash` → `pnpm` → `sh` → `tsx` → `node`). O pm2 mata só a de cima, e o `node` de baixo continua segurando a
  porta. Em 2026-11-22 isso gerou 26 reinícios seguidos com `EADDRINUSE 127.0.0.1:3333` (`~/.pm2/logs/tostao-api-error-1.log`).
- `apps/api/src/server.ts` não trata `SIGTERM`/`SIGINT`: crons, sync e conexões do Prisma/Redis são cortados no meio.

### Correção técnica

1. No `ecosystem.config.cjs` (fora do repo, em `~/homelab/`; **faça um backup antes**), troque para processo único:
   - API: `script: "node"`, `args: "--env-file=.env --import tsx src/server.ts"`, `cwd: .../apps/api`,
     `kill_timeout: 15000`. Confirme que `tsx` resolve a partir de `apps/api` e que `--import tsx` funciona no Node 22.
   - Web: `script: "node_modules/next/dist/bin/next"`, `args: "start -H 127.0.0.1"`, `cwd: .../apps/web`. Mantenha a
     mesma porta e as mesmas variáveis de hoje (confira `apps/web/package.json`).
   - Versione uma cópia de referência em `scripts/pm2/tostao.config.cjs` no repo, pra não depender só do arquivo do homelab.
2. Em `server.ts`: handler de `SIGTERM` e `SIGINT` que, nesta ordem, para de agendar crons (guarde os `Cron` retornados por
   `scheduleDailySync`, `scheduleRecurring`, `scheduleNotifications`, `scheduleOutbox` e `scheduleTostaoChecks`), chama
   `app.close()`, a ponte do n8n, `prisma.$disconnect()` e fecha o Redis. Se passar de 10 s, `process.exit(1)`.
   Um segundo sinal força a saída.
3. Não compile a API com `tsc` agora: `@tostao/contracts` é consumido como `.ts` (`packages/contracts/package.json`).

### Critérios de aceite & testes

- `pm2 restart tostao-api` 5 vezes seguidas: nenhum `EADDRINUSE`, e `ps --forest` mostra 1 processo `node` por app.
- Teste do handler de desligamento: os crons param, `close` e `disconnect` são chamados e há timeout.
- **Não reinicie nada em produção sem o Pedro autorizar.** Entregue os comandos de troca prontos no `AGENT_SYNC.md`.

## T6.2 — API não pode subir antes do banco

- [x] Concluída (código e testes prontos; o `systemctl edit` é do Pedro (AGENT_SYNC > Plano))

### Problema atual

O `pm2-optiplex.service` só tem `After=network.target`. No boot de 2026-11-24 a API subiu antes do Postgres
(`FATAL: the database system is starting up`) e a rodada inicial de recorrências falhou.

### Correção técnica

1. Em `server.ts`, antes de agendar os crons e chamar `listen`: espere o Postgres (`SELECT 1`) e o Redis (`PING`) com
   tentativas e espera crescente (1, 2, 4, 8 s… até ~60 s no total). Registre cada tentativa no log. Depois do teto, saia com erro.
2. Documente pro Pedro rodar (precisa de sudo; não rode você):
   `sudo systemctl edit pm2-optiplex` com `[Unit]\nAfter=docker.service\nWants=docker.service`.

### Critérios de aceite & testes

- Teste unitário do `waitFor` (sucesso na 3ª tentativa; desistência no teto).
- Com o Postgres parado, a API espera e sobe sozinha quando o banco volta, sem crash loop.

## T6.3 — `/health` de verdade + alerta

- [x] Concluída (código e testes prontos; o crontab e o `ALERT_WEBHOOK_URL` são do Pedro (AGENT_SYNC > Plano))

### Problema atual

`/health` sempre responde `{ok:true}`. Em 2026-11-22 o Redis caiu (2.208 `ECONNREFUSED`), e com `skipOnError: true` o rate
limit desligou em silêncio. Ninguém ficou sabendo.

### Correção técnica

1. `GET /health`: `SELECT 1` e `PING` com timeout de 2 s cada. Resposta: `{ ok, db, redis }`, com 200 se tudo ok e 503 se não.
   Sem rate limit e sem dado sensível. Mantenha o `cache-control` atual.
2. `scripts/healthcheck.sh`: consulta `/health` e a página `/entrar` da web. Depois de **2 falhas seguidas**, faz POST em
   `ALERT_WEBHOOK_URL` (lido de `apps/api/.env`; o Pedro aponta pra um workflow do n8n que manda WhatsApp pra ele). Avisa
   uma vez só quando cai e uma vez quando volta, com o estado guardado num arquivo em `~/.cache/tostao/`.
3. Documente a linha do crontab (a cada 5 min) e a variável nova no `.env.example`.

### Critérios de aceite & testes

- Testes de `/health` com o banco ou o Redis falhando (503 e o campo certo marcado `false`).
- O script não dispara alerta repetido enquanto o problema continua.

## T6.4 — Janela de tolerância no refresh token

- [x] Concluída (código e testes prontos, sem migration; falta o `pm2 restart tostao-api` do Pedro depois do merge, ver AGENT_SYNC > Plano)

### Problema atual

A rotação do refresh token derruba a família inteira se um token já trocado reaparecer (`use-cases/sessions.ts`). A
deduplicação da web (`apps/web/lib/refresh-session.ts`) vale só 15 s e só dentro do mesmo processo. Uma aba que perdeu a
resposta com o cookie novo desloga a pessoa. Em produção: 2 `refresh_reuse_detected` em 14 dias.

### Correção técnica

1. Ao rotacionar, guarde no token antigo `rotatedAt` e uma referência ao filho (migration aditiva, se ainda não existir).
2. Se o token antigo reaparecer **em até 30 s** depois de `rotatedAt` e o filho ainda estiver válido e não usado, emita um
   novo par **na mesma família** (ou devolva o par do filho, se der pra fazer sem guardar o token em texto puro). Não registre isso como reuso.
3. Depois de 30 s, o comportamento atual continua: derruba a família e grava `refresh_reuse_detected`.

### Critérios de aceite & testes

- Testes: reuso em 5 s funciona sem derrubar; reuso em 31 s derruba; reuso depois que o filho já foi usado derruba.
- Rode a suíte de sessão contra o Postgres real (`TEST_DATABASE_URL`) por causa da concorrência.

## T6.5 — Amigos conectando banco pelo Pluggy do Pedro

- [x] Concluída

### Situação (verificado em 2026-11-24)

- A aplicação Pluggy só tem o conector **MeuPluggy** (id 200). `POST /connect_token` responde 200.
- A posse da conexão é checada (`connect-bank.ts`: `clientUserId === userId`).
- E-mail transacional já sai de domínio próprio (`EMAIL_FROM` com `usetostao.com.br`).
- O README diz que, depois do trial de 15 dias, não dá pra ligar banco novo. **Isso não foi testado de ponta a ponta.**

### Correção técnica

1. Em `/conectar`, um passo a passo para leigo, curto e com imagens/ícones já existentes:
   1. criar conta em meu.pluggy.ai e ligar os bancos lá; 2) voltar e tocar em "Conectar"; 3) escolher MeuPluggy e autorizar.
      Com um link "Por que preciso disso?" que explica em 2 linhas que o Tostão só lê, nunca movimenta.
2. Se o widget do Pluggy falhar ao criar a conexão, mostre uma mensagem humana com a alternativa: importar extrato (PDF/OFX)
   ou anotar na mão. Nada de mostrar Item ID ou erro técnico pro usuário comum.
3. Checklist pro Pedro no `AGENT_SYNC.md` (não é código): testar com 1 amigo antes de chamar outros; confirmar com o suporte
   do Pluggy se o plano atual permite outras pessoas usando o MeuPluggy; avisar os amigos de que os dados ficam no servidor
   dele (a Política de Privacidade já está publicada).

### Critérios de aceite & testes

- Teste de markup do passo a passo, e teste de que o erro do widget não expõe detalhes técnicos.

## T6.6 — `scripts/deploy.sh`

- [x] Concluída

### Problema atual

O roteiro de deploy está repetido à mão em várias entradas do `AGENT_SYNC.md`. O incidente do `.next` aconteceu porque o
build foi feito em cima da produção rodando.

### Correção técnica

Um script `set -euo pipefail` que: confere que o working tree está limpo e na `main`; `git pull --ff-only`; roda
`scripts/backup-db.sh`; `pnpm install --frozen-lockfile`; `pnpm db:deploy`; `pnpm db:seed` só com a flag `--seed`;
faz o build da web numa **pasta separada** (`NEXT_DIST_DIR` via `distDir` no `next.config.ts`, ou build numa cópia e troca
por `mv`, o que for mais simples e funcionar com `next start`); troca o `.next` de forma atômica, guardando o anterior em
`.next.prev`; reinicia `tostao-api` e `tostao-web` juntos; espera o `/health` (T6.3) responder 200. Se o health falhar,
volta o `.next.prev`, reinicia e sai com erro. Tem `--dry-run` que só imprime os passos.

### Critérios de aceite & testes

- `bash -n` e `shellcheck` sem erro. `--dry-run` imprime a ordem certa.
- **Não rode o deploy de verdade.** O Pedro roda.

## T6.7 — Enxugar o `AGENT_SYNC.md`

- [x] Concluída

### Problema atual

São 835 linhas, lidas por todo agente antes de codar. O Plano está desatualizado: o alerta de 2026-11-15 continua no topo; diz
que o servidor está em `feat/fase1-t15-t16` (está na `main`); lista deploys como pendentes (o banco já tem as 39 migrations
e o build é da `main` de 23/11); diz que o e-mail só chega pro dono da conta Resend (já usa domínio próprio).

### Correção técnica

Mova toda a Execução anterior a 2026-11-22 para `docs/historico/agent-sync-ate-2026-11-21.md`, sem editar o conteúdo. No
`AGENT_SYNC.md` fica: as regras; o Plano real (o que ainda não foi feito, conferido contra o git e o servidor); e as últimas
~5 entradas. Meta: < 200 linhas. Atualize o `CLAUDE.md` se ele citar algo que mudou.

---

## BLOCO B — UX/UI

## T6.8 — Prints automáticos das telas

- [x] Concluída

### Problema atual

Várias entregas de UI registram "nada visto num navegador". Bugs de layout (FAB, overflow em Anotar, carrossel) só
apareceram depois do deploy.

### Correção técnica

`pnpm shots`: Playwright (dependência de dev) entra com um **usuário de demonstração criado pelo seed** (dados fictícios,
nunca dados reais) e salva prints em `shots/` (no `.gitignore`) de: `/inicio`, `/carteira`, `/anotar`, `/tostao`,
`/aprender`, um simulador, `/conectar`, `/mais`. Em 390×844 e 1440×900, nos temas claro e escuro. Sem comparação
automática de imagens. Documente no README que, no servidor, precisa uma vez de
`sudo npx playwright install-deps chromium` (o Pedro roda).

### Critérios de aceite

- `pnpm shots` gera as 32 imagens localmente. A regra no `AGENT_SYNC.md` passa a ser: PR de UI anexa ou descreve os prints.

## T6.9 — Home rápida: Suspense por bloco

- [x] Concluída

### Problema atual

`app/(app)/inicio/page.tsx` (1.226 linhas) faz 11 chamadas num único `Promise.all` e só desenha quando a mais lenta
termina (`/summary/history` e `/forecast` seguram o saldo). Só existe um `loading.tsx` no app.

### Correção técnica

Quebre a Home em componentes server por bloco (`app/(app)/inicio/_blocos/*.tsx`). Cada um busca o próprio dado e fica
dentro de `<Suspense>` com um skeleton do mesmo tamanho, pra a tela não pular. Saldo e status do mês carregam primeiro;
evolução, previsão, amigos e missões entram em streaming. Use `React.cache()` pra chamadas repetidas (`getMe`). Mantenha o
comportamento do `orFallback` e do `rethrowIfRedirect`.

### Critérios de aceite & testes

- `page.tsx` < 300 linhas. Os testes-guarda existentes passam. Prints (T6.8) antes e depois no PR.
- Com o `/forecast` atrasado artificialmente em 3 s (em dev), o saldo aparece antes.

## T6.10 — Home enxuta e "Jogos" agrupados

- [x] Concluída

### Correção técnica

1. `DEFAULT_HIDDEN_SECTIONS` (`lib/inicio-prefs.ts`): a Home padrão mostra só saldo/status do mês, "quanto posso gastar
   hoje" (quando a T6.17 existir), pra onde foi, avisos e próxima lição. O resto fica disponível em Personalizar.
   **Quem já personalizou mantém o que escolheu.**
2. Em `/mais`, uma entrada "Jogos e amigos" que agrupa Tribunal, Batalha, Compensa, Ofensiva e Amigos (confira antes se Compensa é jogo ou ferramenta; se for ferramenta, deixe fora), tirando os atalhos
   avulsos desses itens da Home.

## T6.11 — Preferências da Home no servidor

- [x] Concluída

### Correção técnica

Hoje a ordem e os blocos escondidos ficam num cookie por aparelho. Crie uma coluna JSON `home_prefs` em `users` (migration
aditiva), `GET`/`PATCH /me/home-prefs` com schema Zod em `packages/contracts`, e migre do cookie no primeiro acesso: se o
servidor estiver vazio e o cookie existir, sobe o cookie e apaga. O cookie continua só como cache.

### Critérios de aceite & testes

- Testes do use-case e da migração do cookie. Celular e PC mostram a mesma Home.

## T6.12 — Escala de design (tokens) e texto mínimo de 12 px

- [x] Concluída

### Problema atual

São 1.388 tamanhos em pixel escritos à mão: 12 tamanhos de fonte (`text-[15px]` ×238, `text-[13px]` ×210, `text-[11px]`
×93…) e uns 9 arredondamentos (`rounded-[22px]`, `[20px]`, `[18px]`…). Há 102 usos de 10 e 11 px.

### Correção técnica

1. No `@theme` do Tailwind v4 (`app/globals.css`): `--text-mini` 12, `--text-small` 13, `--text-body` 15, `--text-title`
   22, `--text-hero` 28 (com `line-height`); `--radius-card` 22 e `--radius-control` 14. Escolha os valores a partir dos
   mais usados hoje, pra a mudança visual ser mínima.
2. Aplique **só** em Home, Carteira, Anotar e na navegação nesta PR. O resto migra quando cada arquivo for mexido.
3. Teste-guarda (no estilo de `ui-mobile-sources.spec.ts`) que falha se aparecer `text-[10px]` ou `text-[11px]` em
   `app/` ou `components/`. Valor em dinheiro nunca abaixo de 13 px.

### Critérios de aceite

- Prints (T6.8) antes e depois sem regressão visível além do aumento dos textos minúsculos.

---

## BLOCO C — Simuladores

## T6.13 — `SimuladorShell` + 3 pilotos

- [x] Concluída

### Problema atual

São ~40 simuladores em `app/(app)/aprender/[licao]/simulators*.tsx`, quase todos com 2 a 4 sliders seguidos e labels de
12 px. O resultado fica **embaixo** (fora da tela no celular). Não há pergunta clara, slider é ruim pra valor exato em
dinheiro, e cada um repete o layout à mão.

### Correção técnica

1. `components/simulador-shell.tsx` (client), com a sequência:
   1. **Pergunta** em destaque (ex.: "Esse estágio se paga?").
   2. **Palpite** opcional: 2 ou 3 opções em botões, antes de liberar o resultado. Depois do palpite, mostra se a pessoa
      acertou ("Você achou X. Na real: Y."). Tem botão "Pular palpite".
   3. **Resultado** grande, `sticky` no topo do cartão (no celular fica visível enquanto a pessoa mexe), com a frase
      explicativa dinâmica que cada simulador já tem.
   4. **Controle principal** visível. Os outros ficam em "Ajustar mais" (fechado), já preenchidos com o `userContext`
      quando houver.
   5. Cada valor em dinheiro tem **toque pra digitar** (reaproveite `lib/money-mask.ts`), e o slider continua junto.
2. Props tipadas: `pergunta`, `palpites`, `respostaCerta(resultado)`, `resultado`, `explicacao`, `principal`, `extras`.
3. Migre só **BalancoDoEstagio**, **CalculadoraHoraDeFreela** e **BolaDeNeveDoMinimo**. A matemática não muda (teste que
   o resultado é igual ao de antes para os mesmos valores).
4. Acessibilidade: o resultado em `aria-live="polite"`, palpites como `radiogroup`, alvos de 44 px.

### Critérios de aceite & testes

- Testes do shell: palpite bloqueia o resultado até responder ou pular; "Ajustar mais" fechado por padrão; digitar
  R$ 1.230 atualiza o slider.
- Prints dos 3 pilotos em 390 px (T6.8). **Pare aqui e peça a aprovação do Pedro antes da T6.15.**

## T6.14 — Galeria que ensina antes

- [x] Concluída

### Correção técnica

Em `/aprender/simuladores` e `/aprender/simuladores/[id]`: cada simulador ganha no catálogo (`lib/simulators-catalog.ts`)
um campo `aprende` ("o que você vai entender", 1–2 linhas). A página do simulador mostra, antes dele, um bloco
recolhível "Antes de mexer" com o conceito da lição (reaproveite o texto do passo "A ideia" da lição) e o link "Ver a lição
completa".

## T6.15 — Migrar os demais simuladores

- [x] Concluída (pilotos aprovados pelo Pedro em 25/11/2026)

Só depois da aprovação dos pilotos. Em lotes de ~8 por PR, módulo por módulo. Cada lote: mesmos resultados numéricos
(teste), pergunta e palpites escritos no tom do Tostão (amigo sincero, sem julgamento) e prints. Ao fim, o `SimuladorShell`
é o único layout de simulador.

---

## BLOCO D — Features novas (uma PR cada)

## T6.16 — Cobrar no Pix (Acertos)

- [x] Concluída

### Correção técnica

1. Chave Pix opcional no perfil (`users.pix_key`, migration aditiva, validação de CPF/CNPJ/e-mail/telefone/aleatória em
   `packages/contracts`). Entra no export LGPD; é apagada ao excluir a conta.
2. `lib/pix-brcode.ts` (puro, sem dependência): monta o **BR Code estático** (EMV: GUI `br.gov.bcb.pix`, chave, valor,
   nome ≤ 25, cidade ≤ 15, txid `***`) com CRC16/CCITT-FALSE. Teste com o exemplo do manual do BC.
3. Em `/acertos/[id]`, quando a pessoa te deve: botão "Cobrar". Gera o "copia e cola" do valor devido, copia, e abre
   `https://wa.me/?text=` com a mensagem pronta no tom do Tostão. Sem chave cadastrada, o botão leva pro perfil.

## T6.17 — "Quanto posso gastar hoje"

- [x] Concluída

### Correção técnica

**Atenção:** `dailyPaceInCents` (`use-cases/financial-plan.ts`) é o ritmo em que a pessoa _vem gastando_, não o que ela
_pode_ gastar. O número novo é:
`(renda − já gasto − fixos que faltam − assinaturas que faltam − guardar da meta no mês) ÷ dias restantes (contando hoje)`.
Todos esses valores já existem no `ThisMonthForecast`. Adicione `safeToSpendTodayInCents` (pode ser negativo) no contrato
e no use-case. Na Home, vira o número grande acima do saldo, com uma linha de explicação ("já tirei os fixos, as
assinaturas e a sua meta"). Sem renda cadastrada, mostra o convite pra preencher a renda. Opcional: aviso diário às 9h
pelo push que já existe, desligado por padrão.

### Critérios de aceite & testes

- Testes: meio do mês, último dia, sem meta, valor negativo e sem renda.

## T6.18 — Assinatura que subiu de preço e cobrança chegando

- [x] Concluída

Investigue `services/subscriptions.ts` primeiro: se o histórico de valores já existir, é só a parte de aviso. Avisos novos
no Tostão Automático (achados): "X subiu de R$ A para R$ B" (alta > 5% em relação à cobrança anterior) e "X vai cobrar
R$ A em 3 dias". Sem duplicar aviso (use o mecanismo de reabrir achados que já existe).

## T6.19 — Resumo do mês compartilhável

- [x] Concluída

Em `/fechamento`, um botão "Compartilhar". Gera uma imagem 1080×1920 com `next/og` (`ImageResponse`) numa rota
autenticada da web: mês, % guardado, maior categoria de gasto, ofensiva e o mascote. **Valores em R$ escondidos por padrão**
(só porcentagens), com a opção "mostrar valores". Compartilha via Web Share API com arquivo; sem suporte, faz o download.
Sem nome nem e-mail da pessoa na imagem.

## T6.20 — "Isso é golpe?"

- [x] Concluída

No chat (`/tostao`), um atalho "Isso é golpe?": a pessoa cola a mensagem recebida e a IA avalia com um prompt dedicado:
sinais de golpe, nível de risco (baixo/médio/alto) e o que fazer, com o personagem Urubu do Pix. **Passa pelo
`pii-scrubber` e exige o consentimento de IA, como o resto do chat.** Nunca afirma certeza; sempre termina com "na dúvida,
fala com o banco pelo app oficial". Sem IA disponível, mostra um checklist fixo de sinais de golpe. No WhatsApp: mensagem
que começa com "golpe?" segue o mesmo fluxo. Só texto (o DeepSeek não lê imagem).

## T6.21 — Exportar planilha (CSV)

- [x] Concluída

`GET /me/export.csv?from=&to=`: lançamentos com data, descrição, categoria, conta, valor em reais (vírgula decimal, `;`
como separador, BOM UTF-8 pro Excel abrir certo). Mesmo limite e mesmo `AuditLog` do export JSON. Botão em `/mais` ao lado
do export LGPD. Escape de fórmula (`=`, `+`, `-`, `@` no começo da célula ganham `'`) contra CSV injection.

---

## Checklist de toda PR desta fase

`pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build` (o build com backup/restauração do `.next`
até a T6.6 existir). Registro no `AGENT_SYNC.md`: o que mudou, migration, env nova, como validou e o que ficou de fora.
Commit como Pedro Henrique (73310860+pedrohper@users.noreply.github.com), sem co-autoria. **Sem deploy, sem `pm2
restart`, sem `migrate deploy` em produção: quem faz é o Pedro.**
