# Cuentas
Requiere Node 18+. 
    npm install && npm start      # puerto 3000
Variables: PORT, JWT_SECRET (opcional), COOKIE_SECURE=1 (con HTTPS), ALLOW_REGISTER=0 (cerrar registro luego de crear tu usuario).
Datos en ./data/cuentas.db (hacé backup de esa carpeta). Poné nginx/Caddy con HTTPS delante y mantenelo vivo con pm2 o systemd.
