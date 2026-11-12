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
- Transferência entre contas próprias e pagamento de fatura não contam como gasto nem renda.
- Pluggy: auth em POST /auth (apiKey vale 2 h, reaproveitar), header X-API-KEY, pageSize máx 500,
  DEBIT = saída. Meu Pluggy: conectar bancos com o trial ativo; Item ID copiado no dashboard ("Ir para Demo").

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
Atalhos do protótipo listados no README. Ainda só no design: Chat, Tribunal, Batalha, Fechamento.
