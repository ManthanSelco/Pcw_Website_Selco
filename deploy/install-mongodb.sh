#!/usr/bin/env bash
# Installs MongoDB on this server (once), shared by all websites on it.
# Each website uses its own database inside it (PCW -> "pcw", the next site -> its own name).
#
# MongoDB runs in Docker (works on every Ubuntu version, incl. 26.04), listens ONLY on
# 127.0.0.1 (not reachable from the internet), restarts by itself, keeps data in
# /var/lib/mongodb-data and has a password.
#
# Usage:  sudo bash deploy/install-mongodb.sh
# Prints the MONGODB_URI to use. The password is also saved in /root/mongodb-admin.txt
set -euo pipefail
[[ $EUID -ne 0 ]] && { echo "Run with sudo"; exit 1; }

DATA=/var/lib/mongodb-data
CRED=/root/mongodb-admin.txt
NAME=mongodb

echo "==> 1/3 Docker"
if ! command -v docker >/dev/null; then
  apt-get update
  apt-get install -y docker.io
fi
systemctl enable --now docker >/dev/null

echo "==> 2/3 MongoDB 8 (local only, with password)"
if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  echo "MongoDB container already exists - leaving it as it is."
  docker start "$NAME" >/dev/null
else
  mkdir -p "$DATA"
  PASS="$(openssl rand -hex 16)"
  umask 077
  printf 'MongoDB admin user: admin\nPassword: %s\nURI (PCW): mongodb://admin:%s@127.0.0.1:27017/pcw?authSource=admin\n' "$PASS" "$PASS" > "$CRED"
  docker run -d --name "$NAME" --restart unless-stopped \
    -p 127.0.0.1:27017:27017 \
    -v "$DATA":/data/db \
    -e MONGO_INITDB_ROOT_USERNAME=admin \
    -e MONGO_INITDB_ROOT_PASSWORD="$PASS" \
    mongo:8 --wiredTigerCacheSizeGB 0.5 >/dev/null
fi

echo "==> 3/3 Check"
for _ in $(seq 1 30); do
  if docker exec "$NAME" mongosh --quiet --eval 'db.runCommand({ping:1}).ok' 2>/dev/null | grep -q 1; then break; fi
  sleep 2
done
docker exec "$NAME" mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null && echo "MongoDB is running on 127.0.0.1:27017 (not open to the internet)"

echo
echo "============================================================"
cat "$CRED"
echo "(saved in $CRED - only root can read it)"
echo "============================================================"
