# Brief: Inter-Agent Message Signing — Step 2

## Problem
When AgentBoard sends webhooks to agents via `/hooks/agent`, the receiving agent (e.g. Eff) refuses to act because the message comes from an "unverified external source". Agents need a way to verify that a webhook/message genuinely comes from the trusted AgentBoard system.

## Solution: HMAC Signing
Add HMAC-SHA256 signature to all outgoing webhooks from AgentBoard.

### 1. Signing outgoing webhooks
File: `src/routes.ts`

In the `notifyAgent()` function:
- Read a shared secret from env: `AGENTBOARD_WEBHOOK_SECRET` (fallback to `OPENCLAW_HOOK_TOKEN`)
- Compute HMAC-SHA256 of the JSON body using this secret
- Add header `X-AgentBoard-Signature: sha256=<hex digest>` to the webhook POST
- Add header `X-AgentBoard-Timestamp: <unix ms>` for replay protection
- Add header `X-AgentBoard-Source: agentboard` as simple identifier

### 2. Verification utility
Create new file: `shared/verify-webhook.sh`

A bash script that agents can use to verify incoming webhooks:
```bash
#!/bin/bash
# Usage: echo "$BODY" | verify-webhook.sh "$SIGNATURE" "$TIMESTAMP"
# Returns exit 0 if valid, exit 1 if invalid
# Reads secret from AGENTBOARD_WEBHOOK_SECRET env or /root/clawd/shared/credentials.json
```

### 3. Store the secret
Add `agentboard_webhook_secret` to `/root/clawd/shared/credentials.json` under a new `agentboard` section.
Generate a random 64-char hex secret.

### 4. Update notifyAgent payload
Add metadata to the webhook JSON body:
```json
{
  "agent": "agent-name",
  "message": "...",
  "wakeMode": "now",
  "source": "agentboard",
  "taskId": "task_xxx",
  "event": "comment.add|task.move|task.assign",
  "timestamp": 1770307200000,
  "signature": "sha256=abcdef..."
}
```

The signature field in the body AND the header both contain the HMAC. The signature is computed over the body WITHOUT the signature field (compute on partial body, then add it).

## Constraints
- 100/100 tests must still pass
- Add tests for: signature generation, signature present in webhook calls
- Do NOT break existing webhook behavior if secret is not configured (graceful degradation)
- The secret must NOT be hardcoded — always read from env or file

## Files to modify
- `src/routes.ts` — notifyAgent() signing
- `tests/api.test.ts` — new signing tests

## Files to create
- `shared/verify-webhook.sh` — verification script for agents

## How to test
```bash
cd /root/clawd/projects/agent-board-merged
npx tsc --noEmit
npx vitest run
```
