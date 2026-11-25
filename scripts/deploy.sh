#!/usr/bin/env bash
# Deploy repetível do Tostão em produção (T6.6).
# Uso: bash scripts/deploy.sh [--seed] [--dry-run]
#
# Se qualquer passo depois do `git pull` falhar, volta o código (git reset --keep), as dependências e o `.next`
# anteriores. Migrations NÃO são desfeitas: por isso elas precisam ser sempre aditivas.
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
    printf '  (dry-run) rm -rf %s %s/types && NEXT_DIST_DIR=.next.new NEXT_TELEMETRY_DISABLED=1 pnpm build\n' "$NEXT_NEW" "$NEXT_DIR"
    return 0
  fi
  # O type-check do build também lê os tipos gerados em .next (o build no ar): uma página apagada ou renomeada
  # faria esse build falhar. O `next start` não usa essas pastas.
  rm -rf "$NEXT_NEW" "$NEXT_DIR/types" "$NEXT_DIR/dev/types"
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

# Código que estava no ar antes do pull; vazio = nada a desfazer.
PREV_SHA=""
SWAPPED=0

restore_next() {
  if [ ! -d "$NEXT_PREV" ]; then
    printf 'Aviso: %s não existe; o .next ficou como está.\n' "$NEXT_PREV" >&2
    return 0
  fi
  rm -rf "$NEXT_FAILED"
  if [ -d "$NEXT_DIR" ]; then
    mv "$NEXT_DIR" "$NEXT_FAILED"
  fi
  mv "$NEXT_PREV" "$NEXT_DIR"
}

# Roda em qualquer saída. Em falha depois do pull, devolve o servidor ao estado anterior e diz se voltou mesmo.
on_exit() {
  local code=$?
  trap - EXIT
  if [ "$code" -eq 0 ] || [ -z "$PREV_SHA" ]; then
    exit "$code"
  fi
  set +e
  local current ok=1
  current="$(git rev-parse HEAD)"
  printf '\nDeploy falhou (código %s); iniciando rollback...\n' "$code" >&2
  if [ "$current" != "$PREV_SHA" ]; then
    printf 'Voltando o código para %s (migrations já aplicadas continuam).\n' "$PREV_SHA" >&2
    git reset --keep "$PREV_SHA" && pnpm install --frozen-lockfile || ok=0
  fi
  if [ "$SWAPPED" -eq 1 ]; then
    restore_next || ok=0
    pm2 restart "${PM2_APPS[@]}" || ok=0
    wait_for_health || ok=0
  fi
  if [ "$ok" -eq 1 ]; then
    printf 'Rollback concluído.\n' >&2
  else
    printf 'ROLLBACK NÃO RECUPEROU TUDO: confira na mão (git log -1, pm2 status, pm2 logs).\n' >&2
  fi
  exit "$code"
}

main() {
  step "Conferir working tree limpo e branch main"
  check_git_clean_main
  if [ "$DRY_RUN" -eq 0 ]; then
    PREV_SHA="$(git rev-parse HEAD)"
  fi

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
  SWAPPED=1

  step "Reiniciar tostao-api e tostao-web juntos"
  run_cmd pm2 restart "${PM2_APPS[@]}"

  step "Esperar /health responder 200 (rollback se falhar)"
  wait_for_health

  printf '\nDeploy concluído com sucesso.\n'
}

trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Tudo dentro de main(): o bash lê o script inteiro antes do `git pull` poder trocar este arquivo.
main
