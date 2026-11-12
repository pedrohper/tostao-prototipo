# Tostão: contexto do projeto

App de finanças pessoais + educação financeira para jovens brasileiros de 18 a 25 anos.
Slogan: "Grana explicada, de tostão em tostão". Voz: amigo sincero, sem julgamento.

## Como o trabalho está dividido
- `pedrohper/tostao-prototipo` (este repo): protótipo feito pelo Claude pra validar a ideia rápido.
- `pedrohper/tostao` (depois): a plataforma de verdade, codada pelo Pedro aos poucos (8 h/semana),
  com o Claude como mentor (método socrático, contratos com `throw new Error('Not implemented')`, checklist, code review).
  O protótipo serve de mapa. "O Claude cava a rua, o Pedro pavimenta."
- Commits sempre como Pedro Henrique (73310860+pedrohper@users.noreply.github.com), sem co-autoria do Claude.

## Stack
Monorepo pnpm · TypeScript · Fastify (API) · Prisma 6 + Postgres 16 (Docker, localhost:5432 via DATABASE_URL) · Zod · Vitest ·
Next.js 16 App Router + Tailwind v4 (web) · lições em JSON gerado de `content/curriculo.md`.
Nest.js talvez depois. PWA primeiro. Modelo: uso próprio agora, freemium depois.

## Regras de domínio
- Dinheiro sempre em centavos (Int). Negativo = saída.
- `externalId` evita importar a mesma transação duas vezes (escopo por usuário).
- Transferência entre contas próprias e pagamento de fatura não contam como gasto nem renda. Categoria `nao-conta` (kind neutra) também vira transferência interna.
- Categoria com `userId` é da pessoa (só ela vê/usa/apaga); sem `userId` é do sistema. Conta `hidden` sai do saldo e das telas, e o sync nunca mexe no campo.
- Pluggy: auth em POST /auth (apiKey vale 2 h, reaproveitar), header X-API-KEY, pageSize máx 500 (contas),
  transações só no GET /v2/transactions (cursor `after`, `next` ou null; o v1 responde 410), DEBIT = saída. Conexão: widget Pluggy Connect (POST /connect_token) com o connector MeuPluggy, item.id vem no onSuccess.
  Trial do dashboard (15 dias) precisa estar ativo pra ligar banco. Plano B: "Copiar Item ID" no menu da Demo.

## Marca
- Personagens: Tostão (porquinho, boné laranja #FF5A36 com aba amarela #FFC233 sempre pra trás,
  fresta da moeda só nas costas, feliz por padrão) e Caramelo (vira-lata caramelo, sem coleira).
  Vilões: Urubu do Pix (golpes) e Tigrinho (bets).
- Cores: papel #FDFBF6, tinta #1E1B18, laranja #FF5A36, amarelo #FFC233, menta #3DD6A0.
  Fontes: Bricolage Grotesque 800 (títulos) e Inter (texto).
- Currículo: 9 módulos × 5 lições, cada lição em gancho, conceito, simulador, dilema e compromisso.

## Deploy
Homelab Ubuntu Server 24.04 headless, acessado via Tailscale (pasta `~/homelab/tostao-prototipo`). Postgres já existente em container na 5432. Setup: `bash scripts/homelab-setup.sh` (pm2 + `tailscale serve` com HTTPS).
Login exige HTTPS (cookie secure em produção).

## Pendências conhecidas
Atalhos do protótipo listados no README. Chat com IA: DeepSeek (`DEEPSEEK_API_KEY`), contexto montado em `use-cases/ask-tostao.ts`. Ainda só no design: Tribunal, Batalha. Comando `pnpm --filter @tostao/api recompute-transfers` reaplica a regra de transferência interna no histórico.
