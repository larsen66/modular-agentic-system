#!/usr/bin/env bash
# Deploy the custom TS kernel backend to the VM used by Vercel rewrites.
#
# Usage:
#   bash scripts/deploy-vm.sh [ssh-target] [remote-repo-path] [branch] [project-subdir] [service]
#
# Defaults:
#   agiens@204.168.143.213 /home/agiens/vbp-german main
#   docs/modular-agentic-system/builds/01-custom-ts-kernel custom-ts-kernel

set -euo pipefail

log() { printf '[deploy-vm] %s\n' "$*"; }
fail() { printf '[deploy-vm] ERROR: %s\n' "$*" >&2; exit 1; }

HOST="${1:-agiens@204.168.143.213}"
REMOTE_REPO="${2:-/home/agiens/vbp-german}"
BRANCH="${3:-main}"
PROJECT_SUBDIR="${4:-docs/modular-agentic-system/builds/01-custom-ts-kernel}"
SERVICE="${5:-custom-ts-kernel}"
REMOTE_PROJECT="$REMOTE_REPO/$PROJECT_SUBDIR"

log "Target: $HOST:$REMOTE_PROJECT branch=$BRANCH service=$SERVICE"

log "Step 1/5: Fetching origin/$BRANCH on VM"
ssh "$HOST" "
  set -euo pipefail
  cd '$REMOTE_REPO'
  git fetch origin '$BRANCH'
  git reset --hard 'origin/$BRANCH'
  git rev-parse --short HEAD
"

REMOTE_SHA="$(ssh "$HOST" "cd '$REMOTE_REPO' && git rev-parse --short HEAD")"
log "Remote SHA: $REMOTE_SHA"

log "Step 2/5: Installing root dependencies"
ssh "$HOST" "
  set -euo pipefail
  cd '$REMOTE_PROJECT'
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund
"

log "Step 3/5: Building backend"
ssh "$HOST" "
  set -euo pipefail
  cd '$REMOTE_PROJECT'
  npm run build
"

log "Step 4/5: Building Studio assets"
ssh "$HOST" "
  set -euo pipefail
  cd '$REMOTE_PROJECT/studio'
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund
  npm run build
"

log "Step 5/5: Installing/updating systemd service and restarting"
ssh "$HOST" "
  set -euo pipefail
  cd '$REMOTE_PROJECT'
  sudo cp deploy/systemd/custom-ts-kernel.service '/etc/systemd/system/$SERVICE.service'
  sudo systemctl daemon-reload
  sudo systemctl enable '$SERVICE' >/dev/null
  sudo systemctl restart '$SERVICE'
  sleep 3
  systemctl is-active '$SERVICE'
  systemctl status '$SERVICE' --no-pager -n 20
"

log "Health check"
ssh "$HOST" "curl -fsS 'http://127.0.0.1:8090/healthz' >/tmp/custom-ts-kernel-healthz.json && cat /tmp/custom-ts-kernel-healthz.json"

log "Deploy complete: $REMOTE_SHA"
