# Tostão (protótipo)

> Grana explicada, de tostão em tostão.

Protótipo funcional pra testar e validar a ideia. Depois, a plataforma de verdade é reescrita aos poucos no repo `tostao`, usando este aqui como mapa.

## O que já funciona

- Criar conta, entrar e sair (JWT em cookie httpOnly)
- Conectar banco pelo **Meu Pluggy** (Item ID) ou com um **banco de exemplo**
- Sincronização na hora e automática todo dia às 6h, sem duplicar transação
- Categorização automática por regras (iFood, Spotify, Uber, mercados...)
- Categorizar na mão com "sempre colocar X em Y", que vira regra e já arruma as outras pendentes
- Transferência entre suas contas e pagamento de fatura **não contam como gasto**
- Anotar gasto na mão (dinheiro vivo, Pix que ainda não apareceu)
- Início com saldo, entrou/saiu do mês e pra onde foi
- Carteira por mês, com filtros
- Trilha com os **9 módulos e 45 lições** do currículo, em 6 passos cada
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

1. Crie uma conta no [dashboard do Pluggy](https://dashboard.pluggy.ai). Em **Applications**, pegue o `Client ID` e o `Client Secret`.
2. Em [meu.pluggy.ai](https://meu.pluggy.ai), conecte seus bancos. Faça isso **enquanto o trial do Pluggy estiver ativo**.
3. No dashboard, em "Ir para Demo", use **Copiar Item ID** (um por banco).
4. No `apps/api/.env`:
   ```
   BANK_GATEWAY="pluggy"
   PLUGGY_CLIENT_ID="..."
   PLUGGY_CLIENT_SECRET="..."
   ```
5. Reinicie o `pnpm dev` e cole o Item ID na tela "Conectar".

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
| Item ID colado à mão | Pluggy Connect Widget dentro do app (exige plano pago do Pluggy) |
| Progresso das lições no `localStorage` | Tabela `LessonProgress` + endpoint na API |
| Só o simulador da lição 1.1 existe | Um simulador por lição |
| Compromisso da semana não é auditado | Job que confere o extrato e marca cumprido/não cumprido |
| Cron dentro do processo da API | Worker separado ou cron do provedor |
| Fuso fixo -03:00 | Fuso do usuário |
| Transferência interna por par de valores | Pode errar se alguém te mandar o mesmo valor que você mandou pra outra pessoa no mesmo dia |
| Sem recuperar senha, sem refresh token | E-mail de recuperação e sessão renovável |
| Chat, Tribunal, Batalha e Fechamento | Ainda só no design (canvas) |
