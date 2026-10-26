#!/bin/sh
# Instalado en el VPS como /usr/local/bin/cuentas-deploy.
# Lo ejecuta la clave de GitHub Actions (command= en authorized_keys) con "main" o "qa".
set -eu
case "${SSH_ORIGINAL_COMMAND:-${1:-}}" in
  main) DIR=/srv/cuentas;    BR=main; PORT=8090 ;;
  qa)   DIR=/srv/cuentas-qa; BR=qa;   PORT=8091 ;;
  *) echo "uso: main | qa" >&2; exit 2 ;;
esac
exec 9>/tmp/cuentas-deploy.lock
flock 9
cd "$DIR"
git fetch -q origin "$BR"
git reset -q --hard "origin/$BR"
docker compose up --build -d --remove-orphans
docker image prune -f >/dev/null
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fs -o /dev/null "http://127.0.0.1:$PORT/"; then
    echo "deploy $BR ok: $(git log -1 --format='%h %s')"; exit 0
  fi
  sleep 2
done
echo "deploy $BR: la app no responde en el puerto $PORT" >&2
docker compose logs --tail 30 >&2
exit 1
