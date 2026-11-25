#!/usr/bin/env bash
# Monitor do Tostão (T6.3). Rode do crontab a cada 5 minutos:
#   */5 * * * * /home/optiplex/homelab/tostao-prototipo/scripts/healthcheck.sh >> /home/optiplex/.cache/tostao/healthcheck.log 2>&1
#
# Consulta GET /health da API (banco + Redis; 503 se algum falha) e a página /entrar da web.
# Depois de 2 falhas SEGUIDAS faz POST em ALERT_WEBHOOK_URL (workflow do n8n). Avisa uma vez só quando cai e uma
# vez quando volta; o estado fica em ~/.cache/tostao/healthcheck.state. Em silêncio enquanto tudo está ok.
#
# ALERT_WEBHOOK_URL vem do ambiente ou de apps/api/.env (lido por grep, nunca com `source`). A URL é segredo: não vai pro log.
# Dá pra trocar os alvos pra teste: API_URL, WEB_URL, ENV_FILE, STATE_DIR, FAIL_THRESHOLD.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/apps/api/.env}"
API_URL="${API_URL:-http://127.0.0.1:3333/health}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000/entrar}"
STATE_DIR="${STATE_DIR:-$HOME/.cache/tostao}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-2}"
STATE_FILE="$STATE_DIR/healthcheck.state"

log() { printf '[healthcheck] %s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

mkdir -p "$STATE_DIR" || { log "não consegui criar $STATE_DIR"; exit 1; }

# Uma execução por vez (um curl lento não pode se sobrepor à próxima rodada do cron).
exec 9>"$STATE_DIR/healthcheck.lock"
flock -n 9 || exit 0

webhook_url="${ALERT_WEBHOOK_URL:-}"
if [[ -z "$webhook_url" && -r "$ENV_FILE" ]]; then
  webhook_url="$(grep -E '^[[:space:]]*ALERT_WEBHOOK_URL=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- || true)"
  webhook_url="${webhook_url%$'\r'}"
  webhook_url="${webhook_url#\"}"; webhook_url="${webhook_url%\"}"
  webhook_url="${webhook_url#\'}"; webhook_url="${webhook_url%\'}"
fi

# Estado: fails = falhas seguidas; alerted = 1 se o aviso de "caiu" já foi entregue.
fails=0
alerted=0
if [[ -r "$STATE_FILE" ]]; then
  while IFS='=' read -r key value; do
    case "$key" in
      fails) [[ "$value" =~ ^[0-9]+$ ]] && fails="$value" ;;
      alerted) [[ "$value" == 1 ]] && alerted=1 ;;
    esac
  done < "$STATE_FILE"
fi

save_state() {
  printf 'fails=%s\nalerted=%s\n' "$fails" "$alerted" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"
}

probe() { curl -fsS -o /dev/null --max-time 10 --connect-timeout 5 "$1" 2>/dev/null; }

# Devolve 0 só se o webhook respondeu 2xx. Sem URL configurada devolve 0 (não adianta tentar de novo a cada rodada).
send_alert() {
  local status="$1" text="$2" failed="$3"
  if [[ -z "$webhook_url" ]]; then
    log "ALERT_WEBHOOK_URL vazio: não há para onde avisar ($status: $text)"
    return 0
  fi
  local payload
  payload="$(printf '{"status":"%s","text":"%s","failed":[%s],"failures":%s,"host":"%s","at":"%s"}' \
    "$status" "$text" "$failed" "$fails" "$(hostname)" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')")"
  curl -fsS -o /dev/null --max-time 10 --connect-timeout 5 -X POST -H 'Content-Type: application/json' \
    --data "$payload" "$webhook_url" 2>/dev/null
}

failed_names=()
probe "$API_URL" || failed_names+=("api")
probe "$WEB_URL" || failed_names+=("web")

if ((${#failed_names[@]} == 0)); then
  if ((alerted == 1)); then
    if send_alert "up" "Tostão voltou: API e site respondendo." ""; then
      log "voltou ao normal: aviso enviado"
      fails=0
      alerted=0
    else
      log "voltou ao normal, mas o aviso falhou: tento de novo na próxima rodada"
    fi
  else
    fails=0
  fi
  save_state
  exit 0
fi

fails=$((fails + 1))
failed_json="$(printf '"%s",' "${failed_names[@]}")"
failed_json="${failed_json%,}"
failed_text="${failed_names[*]}"
log "falha $fails (${failed_text})"

if ((fails >= FAIL_THRESHOLD && alerted == 0)); then
  if send_alert "down" "Tostão fora do ar: ${failed_text} sem responder (${fails} checagens seguidas)." "$failed_json"; then
    log "aviso de queda enviado"
    alerted=1
  else
    log "aviso de queda falhou: tento de novo na próxima rodada"
  fi
fi
save_state
