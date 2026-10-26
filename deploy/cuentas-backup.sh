#!/bin/sh
# Instalado en el VPS como /usr/local/bin/cuentas-backup (cron diario en /etc/cron.d/cuentas-backup).
# Snapshot consistente de la DB de prod (VACUUM INTO dentro del contenedor) + secret del JWT,
# en /srv/backups/cuentas/cuentas-AAAAMMDD-HHMMSS.tar.gz. Guarda los últimos 30 días.
set -eu
DEST=/srv/backups/cuentas
DATA=/srv/cuentas/data
KEEP_DAYS=30
TS=$(date +%Y%m%d-%H%M%S)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"; rm -f "$DATA/.backup.db"' EXIT
mkdir -p "$DEST" && chmod 700 "$DEST"
cd /srv/cuentas
rm -f "$DATA/.backup.db"
docker compose exec -T cuentas node -e "new (require('node:sqlite').DatabaseSync)('data/cuentas.db').exec(\"VACUUM INTO 'data/.backup.db'\")" 2>/dev/null
mv "$DATA/.backup.db" "$TMP/cuentas.db"
cp "$DATA/secret" "$TMP/secret"
tar -czf "$DEST/cuentas-$TS.tar.gz" -C "$TMP" cuentas.db secret
chmod 600 "$DEST/cuentas-$TS.tar.gz"
find "$DEST" -name 'cuentas-*.tar.gz' -mtime +$KEEP_DAYS -delete
echo "backup ok: $DEST/cuentas-$TS.tar.gz ($(du -h "$DEST/cuentas-$TS.tar.gz" | cut -f1))"
