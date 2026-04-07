#!/bin/bash
set -e

DEPLOY_DIR="/opt/etasks"
REPO_URL="https://github.com/emadexus/etasks.git"

echo "==> Pulling latest code..."
cd "$DEPLOY_DIR"
git pull origin master

echo "==> Building and restarting containers..."
docker compose build --no-cache
docker compose up -d

echo "==> Cleaning up old images..."
docker image prune -f

echo "==> Done! Yeti is live."
