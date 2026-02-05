#!/bin/bash
# verify-webhook.sh — Verify HMAC-SHA256 signature on AgentBoard webhooks
# Usage: echo "$BODY" | verify-webhook.sh "$SIGNATURE" "$TIMESTAMP"
# Returns exit 0 if valid, exit 1 if invalid
# Reads secret from AGENTBOARD_WEBHOOK_SECRET env or /root/clawd/shared/credentials.json

set -euo pipefail

SIGNATURE="${1:-}"
TIMESTAMP="${2:-}"

if [ -z "$SIGNATURE" ] || [ -z "$TIMESTAMP" ]; then
  echo "Usage: echo \"\$BODY\" | $0 \"\$SIGNATURE\" \"\$TIMESTAMP\"" >&2
  exit 1
fi

# Read secret from env or credentials file
SECRET="${AGENTBOARD_WEBHOOK_SECRET:-}"
if [ -z "$SECRET" ]; then
  CREDS_FILE="/root/clawd/shared/credentials.json"
  if [ -f "$CREDS_FILE" ]; then
    SECRET=$(node -e "
      const c = require('$CREDS_FILE');
      console.log((c.credentials && c.credentials.agentboard && c.credentials.agentboard.webhook_secret) || '');
    " 2>/dev/null || echo "")
  fi
fi

if [ -z "$SECRET" ]; then
  echo "ERROR: No webhook secret found (set AGENTBOARD_WEBHOOK_SECRET or add to credentials.json)" >&2
  exit 1
fi

# Read body from stdin
BODY=$(cat)

# Strip the "sha256=" prefix from signature
EXPECTED_HEX="${SIGNATURE#sha256=}"

# Compute HMAC-SHA256 of body using secret
COMPUTED_HEX=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex 2>/dev/null | awk '{print $NF}')

if [ "$COMPUTED_HEX" = "$EXPECTED_HEX" ]; then
  echo "OK: Signature valid"
  exit 0
else
  echo "FAIL: Signature mismatch" >&2
  exit 1
fi
