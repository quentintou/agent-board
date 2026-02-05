# Brief: Real-Time Agent Communication — Step 1

## Context
AgentBoard (`/root/clawd/projects/agent-board-merged/`) is a multi-agent task board.
The codebase already has: comments API (POST), notifyAgent() webhook, basic webhook on some events.
We need to complete the real-time communication layer.

## Scope — 4 deliverables

### 1. Dashboard Thread UI
File: `dashboard/app.js` + `dashboard/index.html` + `dashboard/style.css`

Add a comments/thread panel to the task detail view in the dashboard:
- When clicking a task, show its comments as a thread (chat-style, newest at bottom)
- Each comment shows: author, timestamp, text
- Add a text input + "Send" button to post new comments via `POST /api/tasks/:id/comments`
- Auto-refresh comments every 10 seconds OR after posting
- Style: clean, minimal, fits existing dark dashboard theme

### 2. Webhooks on ALL task events
File: `src/routes.ts`

Currently `notifyAgent()` is called inconsistently. Make it consistent:
- **comment.add**: ALWAYS notify assignee (already done ✓)
- **task.move**: ALWAYS notify assignee when moved to `doing`, `review`, or `failed` (currently partially done)
- **task.assign**: When assignee changes via PATCH, notify the NEW assignee
- **task.create**: Notify assignee on creation IF priority is high or urgent (already done ✓)

Add a new event type field to the webhook payload:
```json
{
  "agent": "agent-name",
  "message": "...",
  "wakeMode": "now",
  "event": "comment.add|task.move|task.assign|task.create"
}
```

### 3. MCP Tools for Comments
File: `src/mcp-server.ts`

Add these MCP tools:
- `list_comments` — input: taskId → returns array of comments
- `add_comment` — input: taskId, author, text → adds comment and returns updated task
- `get_task_thread` — input: taskId → returns task summary + all comments (for agent context)

### 4. GET Comments Endpoint
File: `src/routes.ts`

Add: `GET /api/tasks/:id/comments` — returns just the comments array for a task.
Useful for dashboard polling and agent queries.

## Constraints
- 92/92 tests must still pass after changes
- Add new tests for: GET comments endpoint, assignee change webhook, MCP comment tools
- Do NOT change the notifyAgent priority filter for task.create (keep high/urgent only)
- Do NOT modify the OPENCLAW_HOOK_URL/TOKEN env var handling
- Build must succeed: `npx tsc --noEmit` clean

## Files to modify
- `src/routes.ts` — GET comments, webhook on assign change
- `src/mcp-server.ts` — 3 new tools
- `dashboard/app.js` — thread UI
- `dashboard/index.html` — thread panel HTML
- `dashboard/style.css` — thread styling
- `tests/api.test.ts` — new tests

## How to test
```bash
cd /root/clawd/projects/agent-board-merged
npx tsc --noEmit
npx vitest run
```
