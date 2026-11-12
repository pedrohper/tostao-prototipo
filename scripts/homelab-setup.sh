#!/usr/bin/env bash
# Sobe o Tostão no homelab e publica com HTTPS na sua rede Tailscale.
# Usa o Postgres que JÁ roda em Docker na porta 5432 (cria usuário e banco "tostao" nele).
#
# Uso (na raiz do repo):  bash scripts/homelab-setup.sh
# Variáveis opcionais:    DB_PORT=5432 WEB_PORT=3000 PG_CONTAINER=nome-do-container
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DB_PORT="${DB_PORT:-5432}"
WEB_PORT="${WEB_PORT:-3000}"
ENV_FILE="apps/api/.env"
say() { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }

# ---------- 1. Achar o container do Postgres ----------
say "Procurando o container do Postgres na porta $DB_PORT"
PG_CONTAINER="${PG_CONTAINER:-$(docker ps --filter "publish=$DB_PORT" --format '{{.Names}}' | head -n1)}"
if [ -z "$PG_CONTAINER" ]; then
  echo "Nenhum container publicando a porta $DB_PORT. Rode 'docker ps' e passe PG_CONTAINER=nome."; exit 1
fi
echo "Usando: $PG_CONTAINER"
psql_admin() { docker exec -i "$PG_CONTAINER" sh -c 'psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d postgres -tA'; }

# ---------- 2. Criar usuário e banco (só se não existirem) ----------
if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=\"$(openssl rand -hex 32)\"/" "$ENV_FILE"
fi
# Reaproveita a senha se o .env já aponta pro usuário tostao nessa porta; senão gera uma nova.
DB_PASS="$(grep -oP '^DATABASE_URL="postgresql://tostao:\K[^@]+(?=@localhost:'"$DB_PORT"'/)' "$ENV_FILE" || true)"
if [ -z "$DB_PASS" ] || [ "$DB_PASS" = "tostao" ]; then DB_PASS="$(openssl rand -hex 16)"; fi

say "Criando usuário e banco 'tostao' (se ainda não existem)"
psql_admin <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tostao') THEN
    CREATE ROLE tostao LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE tostao WITH LOGIN PASSWORD '$DB_PASS';
  END IF;
END \$\$;
SQL
if ! echo "SELECT 1 FROM pg_database WHERE datname='tostao'" | psql_admin | grep -q 1; then
  echo "CREATE DATABASE tostao OWNER tostao;" | psql_admin
fi

sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://tostao:$DB_PASS@localhost:$DB_PORT/tostao?schema=public\"|" "$ENV_FILE"
[ -f apps/web/.env.local ] || cp apps/web/.env.example apps/web/.env.local
echo "DATABASE_URL atualizado em $ENV_FILE"

# Se o container do compose (porta 5433) de testes anteriores estiver ligado, desliga.
docker compose stop db >/dev/null 2>&1 || true

# ---------- 3. Instalar, migrar, popular e compilar ----------
say "Instalando dependências";            pnpm install --frozen-lockfile
say "Criando tabelas";                    pnpm db:deploy
say "Categorias e regras padrão";         pnpm db:seed
say "Compilando o site";                  NEXT_TELEMETRY_DISABLED=1 pnpm build

# ---------- 4. Deixar rodando com pm2 ----------
command -v pm2 >/dev/null || { say "Instalando pm2"; sudo npm i -g pm2; }
say "Subindo API e site no pm2"
pm2 delete tostao-api tostao-web >/dev/null 2>&1 || true
pm2 start "pnpm start:api" --name tostao-api --cwd "$ROOT"
PORT="$WEB_PORT" pm2 start "pnpm start:web" --name tostao-web --cwd "$ROOT"
pm2 save

sleep 5
curl -fsS "http://localhost:3333/health" >/dev/null && echo "API ok" || { echo "API não respondeu. Veja: pm2 logs tostao-api"; exit 1; }
curl -fsS -o /dev/null "http://localhost:$WEB_PORT/entrar" && echo "Site ok" || { echo "Site não respondeu. Veja: pm2 logs tostao-web"; exit 1; }

# ---------- 5. HTTPS na rede Tailscale ----------
say "Publicando com HTTPS na sua rede Tailscale"
sudo tailscale serve --bg "$WEB_PORT"
URL="$(tailscale status --json | grep -oP '"DNSName":\s*"\K[^"]+' | head -n1 | sed 's/\.$//')"
printf '\n\033[1;32m✔ Pronto! No celular (com Tailscale ligado): https://%s\033[0m\n' "$URL"
echo "Pra religar sozinho quando o servidor reiniciar, rode uma vez: pm2 startup  (e o comando sudo que ele mostrar)"
