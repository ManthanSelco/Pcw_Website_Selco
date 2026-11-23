#!/usr/bin/env bash
# PCW (MERN) - one-command setup on an Ubuntu EC2 server.
# Does NOT touch other apps on the server (CIP etc.): own folder, own service
# (pcw-mern), own nginx file, own MongoDB database ("pcw").
#
# Usage (from inside the unzipped pcw-mern folder):
#   sudo bash deploy/setup-ec2.sh pcw.16-192-105-187.sslip.io 4100
#   sudo bash deploy/setup-ec2.sh pcw.16-192-105-187.sslip.io 4100 "mongodb://USER:PASS@127.0.0.1:27017/pcw?authSource=admin"
#   arg 1 = web address   arg 2 = free local port (default 4100)
#   arg 3 = MongoDB URI (optional; default: local MongoDB on 27017, database "pcw")
set -euo pipefail

DOMAIN="${1:-}"
PORT="${2:-4100}"
MONGO="${3:-}"
APP_DIR=/var/www/pcw-mern
RUN_USER="${SUDO_USER:-ubuntu}"

[[ -z "$DOMAIN" ]] && { echo "Usage: sudo bash deploy/setup-ec2.sh pcw.16-192-105-187.sslip.io 4100"; exit 1; }
[[ $EUID -ne 0 ]] && { echo "Run with sudo"; exit 1; }

echo "==> 1/7 Node.js"
if ! command -v node >/dev/null || [[ $(node -p 'process.versions.node.split(".")[0]') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> 2/7 Port $PORT"
if ss -ltn | awk '{print $4}' | grep -qE "[:.]$PORT\$" && ! systemctl is-active --quiet pcw-mern; then
  echo "Port $PORT is used by another app. Run again with another port, e.g. 4101"; exit 1
fi

echo "==> 3/7 MongoDB"
if [[ -z "$MONGO" ]]; then
  if ss -ltn | awk '{print $4}' | grep -qE "[:.]27017\$"; then
    MONGO="mongodb://127.0.0.1:27017/pcw"
    echo "Using local MongoDB on 27017, database 'pcw' (separate from CIP's database)"
  else
    echo "No MongoDB found on this server - the site will save to a local file for now."
    echo "Re-run with a MongoDB URI as the 3rd argument to use MongoDB."
  fi
fi

echo "==> 4/7 Files -> $APP_DIR"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$APP_DIR"
if [[ "$SRC_DIR" != "$APP_DIR" ]]; then
  rsync -a --delete --exclude node_modules --exclude data --exclude server/.env --exclude client/dist "$SRC_DIR/" "$APP_DIR/"
fi
if [[ ! -f "$APP_DIR/server/.env" ]]; then
  cp "$APP_DIR/server/.env.example" "$APP_DIR/server/.env"
fi
sed -i "s#^PORT=.*#PORT=$PORT#" "$APP_DIR/server/.env"
if [[ -n "$MONGO" ]]; then
  grep -q '^MONGODB_URI=' "$APP_DIR/server/.env" && sed -i "s#^MONGODB_URI=.*#MONGODB_URI=$MONGO#" "$APP_DIR/server/.env" || echo "MONGODB_URI=$MONGO" >> "$APP_DIR/server/.env"
fi
chmod 600 "$APP_DIR/server/.env"
chown -R "$RUN_USER":"$RUN_USER" "$APP_DIR"
cd "$APP_DIR"
sudo -u "$RUN_USER" npm install --prefix server --omit=optional --omit=dev --no-audit --no-fund
sudo -u "$RUN_USER" npm install --prefix client --no-audit --no-fund
sudo -u "$RUN_USER" npm run build --prefix client
sudo -u "$RUN_USER" npm run fetch-images --prefix server || echo "(some images will be fetched on first visit)"

echo "==> 5/7 Service pcw-mern"
cat > /etc/systemd/system/pcw-mern.service <<EOF
[Unit]
Description=PCW website (MERN)
After=network.target docker.service

[Service]
WorkingDirectory=$APP_DIR/server
ExecStart=$(command -v node) src/index.js
Environment=NODE_ENV=production
Restart=always
User=$RUN_USER

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable pcw-mern >/dev/null
systemctl restart pcw-mern
sleep 3
curl -fsS "http://127.0.0.1:$PORT/api/health" && echo

echo "==> 6/7 nginx for $DOMAIN"
command -v nginx >/dev/null || apt-get install -y nginx
cat > /etc/nginx/sites-available/pcw-mern <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sf /etc/nginx/sites-available/pcw-mern /etc/nginx/sites-enabled/pcw-mern
nginx -t && systemctl reload nginx

echo "==> 7/7 HTTPS"
command -v certbot >/dev/null || apt-get install -y certbot python3-certbot-nginx
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
  URL="https://$DOMAIN"
else
  echo "(HTTPS not set up now - check ports 80/443 in the EC2 Security Group)"; URL="http://$DOMAIN"
fi

echo
echo "============================================================"
echo " PCW (MERN) is live:  $URL"
echo " Logs:     sudo journalctl -u pcw-mern -f"
echo " Restart:  sudo systemctl restart pcw-mern"
echo "============================================================"
