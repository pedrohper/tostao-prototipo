#!/usr/bin/env bash
# Backup diário do banco do Tostão. Guarda os últimos 14 em ~/tostao-backups.
# Se existir a chave pública do age em ~/.config/tostao/backup.pub (ou BACKUP_AGE_RECIPIENTS), o backup sai cifrado (.sql.gz.age).
# A chave PRIVADA não fica no servidor: guarde no seu gerenciador de senhas. Pra restaurar: age -d -i chave.txt arquivo.age | gunzip | psql ...
# Instalar no cron (uma vez):  (crontab -l 2>/dev/null; echo "30 3 * * * bash $PWD/scripts/backup-db.sh >> $HOME/tostao-backups/backup.log 2>&1") | crontab -
set -euo pipefail
umask 077 # backup e pasta: só o seu usuário lê
cd "$(dirname "$0")/.."
DIR="${BACKUP_DIR:-$HOME/tostao-backups}"
KEEP="${BACKUP_KEEP:-14}"
RECIPIENTS="${BACKUP_AGE_RECIPIENTS:-$HOME/.config/tostao/backup.pub}"
mkdir -p "$DIR"
chmod 700 "$DIR"
URL="$(grep -E '^DATABASE_URL=' apps/api/.env | head -1 | cut -d= -f2- | tr -d '"' | sed 's/?.*$//')"
FILE="$DIR/tostao-$(date +%Y%m%d-%H%M).sql.gz"

if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$URL" | gzip > "$FILE"
else
  # Postgres no Docker: roda o pg_dump de dentro do container que publica a porta do banco
  PORT="$(echo "$URL" | sed -E 's#.*:([0-9]+)/.*#\1#')"
  CONTAINER="${PG_CONTAINER:-$(docker ps --filter "publish=$PORT" --format '{{.Names}}' | head -1)}"
  DB="$(echo "$URL" | sed -E 's#.*/([^/?]+)$#\1#')"
  USER="$(echo "$URL" | sed -E 's#^[a-z]+://([^:@]+).*#\1#')"
  docker exec "$CONTAINER" pg_dump -U "$USER" "$DB" | gzip > "$FILE"
fi

[ -s "$FILE" ] || { echo "$(date -Is) backup vazio: $FILE"; rm -f "$FILE"; exit 1; }
if [ -f "$RECIPIENTS" ] && command -v age >/dev/null 2>&1; then
  age -R "$RECIPIENTS" -o "$FILE.age" "$FILE" && rm -f "$FILE"
  FILE="$FILE.age"
fi
ls -1t "$DIR"/tostao-*.sql.gz* | tail -n +"$((KEEP + 1))" | xargs -r rm -f
echo "$(date -Is) ok $FILE ($(du -h "$FILE" | cut -f1))"
