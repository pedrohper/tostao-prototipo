#!/usr/bin/env bash
# Deploy repetível do Tostão em produção (T6.6).
# Uso: bash scripts/deploy.sh [--seed] [--dry-run]
set -euo pipefail

DRY_RUN=0
RUN_SEED=0

usage() {
  printf 'Uso: bash scripts/deploy.sh [--seed] [--dry-run]\n'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --seed) RUN_SEED=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      printf 'Opção desconhecida: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WEB_DIR="$ROOT/apps/web"
NEXT_DIR="$WEB_DIR/.next"
NEXT_NEW="$WEB_DIR/.next.new"
NEXT_PREV="$WEB_DIR/.next.prev"
NEXT_FAILED="$WEB_DIR/.next.failed"

HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:3333/health}"
WEB_URL="${DEPLOY_WEB_URL:-http://127.0.0.1:3000/entrar}"
HEALTH_ATTEMPTS="${DEPLOY_HEALTH_ATTEMPTS:-20}"
HEALTH_SLEEP="${DEPLOY_HEALTH_SLEEP:-1}"
PM2_APPS=("tostao-api" "tostao-web")

step_n=0
step() {
  step_n=$((step_n + 1))
  printf '\n[%d] %s\n' "$step_n" "$1"
}

run_cmd() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  (dry-run) %s\n' "$*"
    return 0
  fi
  "$@"
}

check_git_clean_main() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  (dry-run) git rev-parse --abbrev-ref HEAD == main && git status --porcelain == ""\n'
    return 0
  fi
  local branch
  local dirty
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [ "$branch" != "main" ]; then
    printf 'Erro: branch atual é "%s" (esperado: "main").\n' "$branch" >&2
    exit 1
  fi
  dirty="$(git status --porcelain)"
  if [ -n "$dirty" ]; then
    printf 'Erro: working tree sujo. Limpe ou commite antes do deploy.\n%s\n' "$dirty" >&2
    exit 1
  fi
}

build_web_isolated() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  (dry-run) rm -rf %s && NEXT_DIST_DIR=.next.new NEXT_TELEMETRY_DISABLED=1 pnpm build\n' "$NEXT_NEW"
    return 0
  fi
  rm -rf "$NEXT_NEW"
  NEXT_DIST_DIR=.next.new NEXT_TELEMETRY_DISABLED=1 pnpm build
  if [ ! -f "$NEXT_NEW/BUILD_ID" ]; then
    printf 'Erro: build não gerou %s/BUILD_ID.\n' "$NEXT_NEW" >&2
    exit 1
  fi
}

swap_next_atomic() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  (dry-run) mover %s -> %s e %s -> %s\n' "$NEXT_DIR" "$NEXT_PREV" "$NEXT_NEW" "$NEXT_DIR"
    return 0
  fi
  rm -rf "$NEXT_PREV"
  if [ -d "$NEXT_DIR" ]; then
    mv "$NEXT_DIR" "$NEXT_PREV"
  fi
  if ! mv "$NEXT_NEW" "$NEXT_DIR"; then
    printf 'Erro ao ativar %s; restaurando %s.\n' "$NEXT_NEW" "$NEXT_PREV" >&2
    if [ -d "$NEXT_PREV" ]; then
      mv "$NEXT_PREV" "$NEXT_DIR" || true
    fi
    exit 1
  fi
}

rollback_next() {
  printf 'Healthcheck falhou; iniciando rollback de %s...\n' "$NEXT_DIR" >&2
  if [ -d "$NEXT_PREV" ]; then
    rm -rf "$NEXT_FAILED"
    if [ -d "$NEXT_DIR" ]; then
      mv "$NEXT_DIR" "$NEXT_FAILED"
    fi
    mv "$NEXT_PREV" "$NEXT_DIR"
    pm2 restart "${PM2_APPS[@]}" || true
    printf 'Rollback concluído com %s e serviços reiniciados.\n' "$NEXT_PREV" >&2
  else
    printf 'Aviso: %s não existe para rollback.\n' "$NEXT_PREV" >&2
  fi
}

wait_for_health() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  (dry-run) esperar 200 em %s e %s (rollback para %s se falhar)\n' "$HEALTH_URL" "$WEB_URL" "$NEXT_PREV"
    return 0
  fi
  local i=1
  while [ "$i" -le "$HEALTH_ATTEMPTS" ]; do
    if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1 \
      && curl -fsS --max-time 3 -o /dev/null "$WEB_URL" 2>/dev/null; then
      printf 'Saúde confirmada (%s e %s respondendo).\n' "$HEALTH_URL" "$WEB_URL"
      return 0
    fi
    sleep "$HEALTH_SLEEP"
    i=$((i + 1))
  done
  return 1
}

step "Conferir working tree limpo e branch main"
check_git_clean_main

step "Atualizar main (git pull --ff-only)"
run_cmd git pull --ff-only

step "Fazer backup do banco (scripts/backup-db.sh)"
run_cmd bash scripts/backup-db.sh

step "Instalar dependências (pnpm install --frozen-lockfile)"
run_cmd pnpm install --frozen-lockfile

step "Aplicar migrations (pnpm db:deploy)"
run_cmd pnpm db:deploy

if [ "$RUN_SEED" -eq 1 ]; then
  step "Rodar seed (pnpm db:seed)"
  run_cmd pnpm db:seed
fi

step "Build da web em pasta separada (NEXT_DIST_DIR=.next.new)"
build_web_isolated

step "Troca atômica de .next (guardando anterior em .next.prev)"
swap_next_atomic

step "Reiniciar tostao-api e tostao-web juntos"
run_cmd pm2 restart "${PM2_APPS[@]}"

step "Esperar /health responder 200 (rollback se falhar)"
if ! wait_for_health; then
  rollback_next
  exit 1
fi

printf '\nDeploy concluído com sucesso.\n'
