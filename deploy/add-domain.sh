#!/usr/bin/env bash
# Adds your own domain(s) to the PCW website, with HTTPS.
# Keeps the names that already work (e.g. pcw.3-108-88-152.sslip.io) and adds the new ones.
# The first new domain becomes the main address (SITE_URL: Google, sitemap, share links).
#
# Before running: the domain person adds an A record  (name -> this server's IP).
# Usage:
#   sudo bash deploy/add-domain.sh thepcw.ai www.thepcw.ai
#   sudo bash deploy/add-domain.sh new.thepcw.ai
set -euo pipefail
[[ $EUID -ne 0 ]] && { echo "Run with sudo"; exit 1; }
[[ $# -lt 1 ]] && { echo "Usage: sudo bash deploy/add-domain.sh thepcw.ai www.thepcw.ai"; exit 1; }

CONF=/etc/nginx/sites-available/pcw-mern
ENV=/var/www/pcw-mern/server/.env
CERT=pcw-mern
[[ -f "$CONF" && -f "$ENV" ]] || { echo "PCW is not installed yet. Run deploy/setup-ec2.sh first."; exit 1; }
PORT=$(sed -n 's/^PORT=//p' "$ENV"); PORT=${PORT:-4100}
MAIN="$1"

echo "==> 1/5 Check that each domain points to this server"
IP=$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')
for d in "$@"; do
  got=$(getent ahostsv4 "$d" | awk '{print $1; exit}' || true)
  if [[ "$got" != "$IP" ]]; then
    echo "  $d -> ${got:-not found}  (this server is $IP)"
    echo "  The DNS A record for $d is not ready yet. Ask the domain person to point it to $IP,"
    echo "  wait 5-30 minutes and run this again. Nothing was changed."
    exit 1
  fi
  echo "  $d -> $IP  OK"
done

echo "==> 2/5 Names"
OLD=$(grep -oP '^\s*server_name\s+\K[^;]+' "$CONF" | tr ' ' '\n' | grep -v '^_$' || true)
NAMES=$(printf '%s\n' $OLD "$@" | awk 'NF && !seen[$0]++' | tr '\n' ' ' | sed 's/ $//')
echo "  $NAMES"
cp "$CONF" "$CONF.bak.$(date +%s)"

proxy_block() {
cat <<EOF
    client_max_body_size 60m;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
EOF
}

echo "==> 3/5 Temporary HTTP setup for the certificate check"
{ echo "server {"; echo "    listen 80;"; echo "    server_name $NAMES;"; proxy_block; echo "}"; } > "$CONF"
nginx -t && systemctl reload nginx

echo "==> 4/5 HTTPS certificate for: $NAMES"
D_ARGS=(); for n in $NAMES; do D_ARGS+=(-d "$n"); done
certbot certonly --nginx --cert-name "$CERT" "${D_ARGS[@]}" --expand \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --deploy-hook "systemctl reload nginx"

# the first certificate from setup-ec2.sh was named after the sslip.io address; remove it so
# only one certificate (pcw-mern) is renewed and nothing edits this nginx file later
for old in $(certbot certificates 2>/dev/null | sed -n 's/^ *Certificate Name: //p'); do
  if [[ "$old" != "$CERT" ]] && grep -qx "$old" <(printf '%s\n' $NAMES); then
    certbot delete --cert-name "$old" --non-interactive >/dev/null && echo "  removed old certificate $old (now part of $CERT)"
  fi
done

LIVE=/etc/letsencrypt/live/$CERT
NGV=$(nginx -v 2>&1 | grep -oP '[0-9]+\.[0-9]+\.[0-9]+')
H2_NEW=$(printf '%s\n1.25.1\n' "$NGV" | sort -V | head -1)
{
  echo "server {"
  echo "    listen 80;"
  echo "    server_name $NAMES;"
  echo "    location /.well-known/acme-challenge/ { root /var/www/html; }"
  echo "    location / { return 301 https://\$host\$request_uri; }"
  echo "}"
  echo "server {"
  if [[ "$H2_NEW" == "1.25.1" ]]; then echo "    listen 443 ssl;"; echo "    http2 on;"; else echo "    listen 443 ssl http2;"; fi
  echo "    server_name $NAMES;"
  echo "    ssl_certificate $LIVE/fullchain.pem;"
  echo "    ssl_certificate_key $LIVE/privkey.pem;"
  [[ -f /etc/letsencrypt/options-ssl-nginx.conf ]] && echo "    include /etc/letsencrypt/options-ssl-nginx.conf;"
  [[ -f /etc/letsencrypt/ssl-dhparams.pem ]] && echo "    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;"
  proxy_block
  echo "}"
} > "$CONF"
nginx -t && systemctl reload nginx

echo "==> 5/5 Main address -> https://$MAIN"
if grep -q '^SITE_URL=' "$ENV"; then sed -i "s#^SITE_URL=.*#SITE_URL=https://$MAIN#" "$ENV"; else echo "SITE_URL=https://$MAIN" >> "$ENV"; fi
systemctl restart pcw-mern
sleep 4
for n in $NAMES; do printf '  https://%s  ->  ' "$n"; curl -s -o /dev/null -w '%{http_code}\n' "https://$n/" || echo failed; done

echo
echo "============================================================"
echo " Done. Main address: https://$MAIN"
echo " Admin:              https://$MAIN/admin"
echo " Certificate renews by itself (check: sudo certbot renew --dry-run)"
echo " Next: add https://$MAIN in Google Search Console + Bing, submit /sitemap.xml"
echo "============================================================"
