# Tostão (protótipo)

> Grana explicada, de tostão em tostão.

Protótipo funcional pra testar e validar a ideia. Depois, a plataforma de verdade é reescrita aos poucos no repo `tostao`, usando este aqui como mapa.

## O que já funciona

- Criar conta, entrar e sair (JWT em cookie httpOnly)
- Conectar banco pelo **Pluggy Connect** (widget dentro do app, com o MeuPluggy) ou com um **banco de exemplo**
- Sincronização na hora e automática todo dia às 6h, sem duplicar transação
- Categorização automática por regras (iFood, Spotify, Uber, mercados...)
- Categorizar na mão com "sempre colocar X em Y", que vira regra e já arruma as outras pendentes
- Transferência entre suas contas e pagamento de fatura **não contam como gasto**
- Anotar gasto na mão (dinheiro vivo, Pix que ainda não apareceu)
- Início com saldo, entrou/saiu do mês e pra onde foi
- Carteira por mês, com filtros
- Trilha com os **9 módulos e 45 lições** do currículo, em 6 passos cada, com progresso salvo na conta
- **Minhas assinaturas**: acha o que cobra todo mês (Spotify, YouTube, plano anual em 12x...) e soma por mês e por ano
- **Fechamento do mês**: quanto sobrou, entrou e saiu vs mês anterior, categorias que mais pesaram e maior gasto
- **Limites por categoria**: teto mensal com barra no Início e aviso quando passa
- Mesmo cartão vindo de duas conexões (ex.: Bradesco e Bradescard) conta uma vez só
- Desconectar banco pela tela Conectar
- **Minhas categorias**: crie categorias de gasto e de entrada; a categoria **Não conta** tira do resumo dinheiro que só passa por você (repasse com a família)
- **Importar extrato** OFX/CSV (Conectar → Importar extrato): funciona com qualquer banco, sem Pluggy; reimportar não duplica
- Aviso no Início e no Conectar quando um banco para de atualizar ou o Pluggy está fora
- **Chat com o Tostão** (aba Tostão): IA (DeepSeek) que responde com base nos seus números; precisa de `DEEPSEEK_API_KEY` no `apps/api/.env` (limite `CHAT_DAILY_LIMIT`, padrão 40/dia)
- **Tostão no WhatsApp** (Perfil > Tostão no WhatsApp): o mesmo chat pela Cloud API da Meta. A pessoa gera um código no app e manda pro número; só número ligado vê dados. Liga com `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` e `WHATSAPP_NUMBER` (só dígitos, com DDI) no `apps/api/.env`. Webhook: `GET/POST /whatsapp/webhook` (assinatura `X-Hub-Signature-256` conferida); é a única rota que precisa ser pública.
  - **Ou via n8n** (API não oficial, sem Meta): `N8N_WHATSAPP_SECRET` (16+ caracteres) e `WHATSAPP_NUMBER` no `.env`. O n8n faz `POST /whatsapp/n8n` com header `X-Tostao-Secret` e corpo `{ id, from, text, fromMe? }` (`from` aceita JID tipo `5511...@s.whatsapp.net`; grupo é ignorado) (ou o webhook cru da Evolution API, `messages.upsert`, inclusive `@lid`) e recebe `{ replies: string[] }` pra mandar de volta. "gastei 25 no ifood" / "recebi 100 do pai" anota na hora (sem IA, sem gastar pergunta); o resto vai pro chat. Com o n8n em Docker, `N8N_LISTEN_HOST=172.18.0.1` (gateway da rede `homelab_default` no servidor) abre uma porta extra (`N8N_LISTEN_PORT`, padrão 3334) só com essa rota, e a API continua no 127.0.0.1. Nada fica público: o n8n chama a API pela rede local. `N8N_WHATSAPP_SEND_URL` (opcional) é o webhook do n8n que recebe `{ to, text }` pra avisos que partem do Tostão.
- **Busca** (topo da Carteira), **Metas** (Perfil > Minha meta) e **categoria automática** com o DeepSeek depois de cada sync/importação (botão "Categorizar pra mim" na aba "sem categoria").
- Cadastro aberto; convite (Perfil → Convidar alguém) é opcional e só marca quem chamou quem
- Sessão que renova sozinha, limite de 5 tentativas de login, backup diário (`scripts/backup-db.sh`)
- Ocultar conta que você não usa (ex.: poupança parada): some da Carteira e do saldo
- Layout de celular e de desktop, e modo escuro automático

## Rodando na sua máquina

Precisa de Node 22, pnpm 10 e Docker.

```bash
pnpm install
pnpm db:up                                   # sobe o Postgres no Docker
cp .env.example apps/api/.env                # depois edite o JWT_SECRET
cp apps/web/.env.example apps/web/.env.local
pnpm db:migrate                              # cria as tabelas
pnpm db:seed                                 # categorias e regras padrão
pnpm dev                                     # API em :3333 e web em :3000
```

Abra http://localhost:3000, crie uma conta e, em "Conectar", digite qualquer texto. Com `BANK_GATEWAY="fake"` entram dados de exemplo.

### Usando seu banco de verdade (Meu Pluggy)

1. Em [meu.pluggy.ai](https://meu.pluggy.ai), conecte seus bancos (Open Finance).
2. Crie uma conta no [dashboard do Pluggy](https://dashboard.pluggy.ai). Começa um trial de 15 dias: conecte os bancos **enquanto ele estiver ativo** (depois do trial os dados continuam sendo lidos, mas não dá pra ligar banco novo).
3. Na sua Application, em personalizar, deixe o connector **MeuPluggy** na lista. Pegue o `Client ID` e o `Client Secret`.
4. No `apps/api/.env`:
   ```
   BANK_GATEWAY="pluggy"
   PLUGGY_CLIENT_ID="..."
   PLUGGY_CLIENT_SECRET="..."
   ```
5. Reinicie o `pnpm dev`. Na tela "Conectar", toque em **Conectar meu banco**: abre o Pluggy Connect, você escolhe **MeuPluggy** e autoriza (uma vez por banco). O Tostão recebe o Item ID sozinho.

Plano B: se o banco já foi ligado pela Demo do dashboard ("Ir para Demo" → menu de três pontos no canto superior direito → **Copiar Item ID**), cole em "Já tenho um Item ID". O campo aceita o ID puro ou qualquer texto/link que tenha o ID dentro.

> ⚠️ **Este repo é público.** O `.env` está no `.gitignore`. Nunca commite credenciais.

### Comandos úteis

| Comando | O que faz |
|---|---|
| `pnpm test` | Testes da API (Vitest, sem precisar de banco) |
| `pnpm --filter @tostao/api sync` | Roda a sincronização de todo mundo agora |
| `pnpm content:build` | Regera as lições a partir de `content/curriculo.md` |
| `pnpm --filter @tostao/api exec prisma studio` | Abre o banco no navegador |

## Mapa do código

```
apps/
  api/                        Fastify + Prisma + Zod
    prisma/schema.prisma      tabelas (dinheiro sempre em centavos, Int)
    src/
      domain/                 entidades e erros. Não conhece banco nem HTTP
      services/               regras puras: categorizar, achar transferência interna
      use-cases/              um arquivo por ação do usuário + factories.ts
      repositories/           interfaces + versão em memória (testes) + Prisma
      gateways/               BankGateway: Pluggy de verdade e um fake
      http/                   controllers, middleware de JWT, tratamento de erro
      jobs/                   sincronização diária (croner)
      app.ts / server.ts      monta o app / liga o servidor
      env.ts                  valida as variáveis de ambiente na subida
  web/                        Next.js (App Router) + Tailwind v4
    app/(auth)/               entrar, criar conta (server actions)
    app/(app)/                telas logadas: início, carteira, anotar, conectar, aprender, perfil
    lib/api.ts                cliente da API (só no servidor, anexa o token)
packages/contracts/           schemas Zod e tipos usados pela API e pela web
content/                      currículo (.md) e lições geradas (.json)
```

O caminho de uma requisição: **controller** valida com Zod, chama o **use case**, que usa **repositórios** e **gateways** por interface. Trocar Postgres por memória (nos testes) ou Pluggy por fake não muda nenhum use case.

## Atalhos do protótipo (pra fazer direito na plataforma)

| Atalho | Como deveria ser |
|---|---|
| Só o simulador da lição 1.1 existe | Um simulador por lição |
| Compromisso da semana não é auditado | Job que confere o extrato e marca cumprido/não cumprido |
| Cron dentro do processo da API | Worker separado ou cron do provedor |
| Fuso fixo -03:00 (dia sem hora vindo do banco = meio-dia de Brasília) | Fuso do usuário |
| Transferência interna por par de valores | Pode errar se alguém te mandar o mesmo valor que você mandou pra outra pessoa no mesmo dia |
| Recuperar senha por link gerado no servidor (`pnpm --filter @tostao/api reset-link email`) | E-mail de recuperação automático |
| Limite de login em memória, por e-mail | Redis/limite por IP na borda |
| Chat manda um resumo pronto pra IA (sem ferramentas) | IA consultando dados por function calling |
| Tribunal e Batalha | Ainda só no design (canvas) |
| Assinatura detectada por padrão de descrição | Usar a categoria do Pluggy e deixar a pessoa confirmar/ignorar |
