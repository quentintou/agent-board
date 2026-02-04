<p align="center">
  <h1 align="center">🎯 Agent Board</h1>
  <p align="center">
    <strong>Multi-agent task orchestration for <a href="https://github.com/openclaw/openclaw">OpenClaw</a> and AI agent teams.</strong><br/>
    Kanban dashboard · REST API · MCP server · DAG dependencies · Auto-retry · Audit trail
  </p>
  <p align="center">
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#openclaw-integration">OpenClaw Integration</a> •
    <a href="#api-reference">API</a> •
    <a href="#mcp-server">MCP</a> •
    <a href="#dashboard">Dashboard</a> •
    <a href="#architecture">Architecture</a>
  </p>
  <p align="center">
    <a href="https://github.com/quentintou/agent-board/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
    <a href="https://github.com/openclaw/openclaw"><img src="https://img.shields.io/badge/built%20for-OpenClaw-8A2BE2.svg" alt="Built for OpenClaw"></a>
    <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-green.svg" alt="MCP Compatible"></a>
  </p>
</p>

---

## Why Agent Board?

Running multiple AI agents without coordination is chaos. Each agent works in isolation, tasks get duplicated, failures go unnoticed, and there's no way to build multi-step workflows.

**Agent Board fixes this.** It's a task management system purpose-built for AI agent teams — whether you're running [OpenClaw](https://github.com/openclaw/openclaw) agents, Claude, or any LLM-based agents.

- **Agents pick up work** from the board via heartbeat polling or webhook notifications
- **Dependencies are enforced** — Agent B can't start until Agent A finishes
- **Failed tasks auto-retry** — no human intervention for transient failures
- **Task chaining** builds pipelines — when one agent finishes, the next one starts automatically
- **Full audit trail** — know exactly who did what, when, and why
- **MCP native** — agents interact through [Model Context Protocol](https://modelcontextprotocol.io/) tools

Works standalone or as the orchestration layer for an [OpenClaw](https://github.com/openclaw/openclaw) multi-agent setup.

## Features

| Feature | Description |
|---------|-------------|
| **Kanban Board** | 6 columns: `backlog` → `todo` → `doing` → `review` → `done` → `failed` |
| **DAG Dependencies** | Tasks can depend on other tasks. Moving to `doing` is blocked until all dependencies are `done`. Cycle detection prevents deadlocks. |
| **Quality Gates** | Mark tasks as `requiresReview: true` — they must pass through `review` before `done`. |
| **Auto-Retry** | When a task moves to `failed`, it automatically retries (back to `todo`) up to `maxRetries` times. System comments track each attempt. |
| **Task Chaining** | Define a `nextTask` on any task. When it completes, the next task is auto-created and assigned. Build pipelines without orchestration code. |
| **OpenClaw Webhooks** | Native [OpenClaw](https://github.com/openclaw/openclaw) webhook integration to wake agents when tasks are assigned, retried, or chained. |
| **Audit Trail** | Every action is logged to `audit.jsonl` — who did what, when, to which task. Queryable via API. Both REST and MCP mutations are tracked. |
| **Client View** | Read-only project dashboard for external stakeholders. Enable per-project with `clientViewEnabled`. Hides agent names and internal details. |
| **Project Templates** | Pre-define task sets as JSON templates. Apply them to any project in one call. |
| **Board Stats** | Per-agent and global statistics: completion rates, average duration, stuck task detection. |
| **MCP Server** | Full [Model Context Protocol](https://modelcontextprotocol.io/) server — AI agents manage tasks through 12 MCP tools. Compatible with Claude Desktop, Claude Code, and any MCP client. |
| **API Key Auth** | Optional per-agent API key authentication. Backward-compatible (no keys = no auth). |
| **Zod Validation** | All inputs validated with Zod schemas. Clear error messages on invalid requests. |
| **Concurrent Safety** | Per-file async mutex locking on all writes. Atomic temp-file-then-rename. No corruption under concurrent access. |
| **Auto-Backup** | Automatic backups before every write (up to 50 per file, auto-pruned). |

## Quick Start

```bash
git clone https://github.com/quentintou/agent-board.git
cd agent-board
npm install
npm run build
npm start
```

Open **http://localhost:3456** for the Kanban dashboard, or hit **http://localhost:3456/api** for the REST API.

### Options

```bash
node dist/index.js --port 8080 --data ./my-data
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `3456` | HTTP server port |
| `--data` | `./data` | Directory for JSON data files |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENTBOARD_API_KEYS` | Comma-separated `key:agentId` pairs for API authentication. Example: `sk-abc123:agent1,sk-def456:agent2` |
| `OPENCLAW_HOOK_URL` | OpenClaw webhook URL for agent notifications (default: `http://localhost:18789/hooks/agent`) |
| `OPENCLAW_HOOK_TOKEN` | Bearer token for OpenClaw webhook calls. Notifications disabled if not set. |
| `TEMPLATES_DIR` | Custom templates directory (default: `./templates`) |

## OpenClaw Integration

Agent Board is designed as the **orchestration layer for [OpenClaw](https://github.com/openclaw/openclaw) multi-agent setups**. Here's how they work together:

### Architecture: OpenClaw + Agent Board

```
┌─────────────────────────────────────────────────┐
│                  OpenClaw Gateway                │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Agent A  │ │ Agent B  │ │ Agent C          │ │
│  │ (Sonnet) │ │ (Opus)   │ │ (Gemini Flash)   │ │
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │
│       │             │                │           │
│       └─────────────┴────────────────┘           │
│                     │                            │
│            ┌────────▼────────┐                   │
│            │   Agent Board   │ ◄── REST / MCP    │
│            │   (localhost)   │                    │
│            └─────────────────┘                   │
└─────────────────────────────────────────────────┘
```

### How Agents Use the Board

1. **Heartbeat polling** — Each OpenClaw agent checks the board periodically (via `curl` or MCP tools) for assigned tasks
2. **Webhook wake** — When a high-priority task is created, Agent Board sends a webhook to OpenClaw's `/hooks/agent` endpoint, which wakes the target agent immediately
3. **Task lifecycle** — Agents move tasks through columns: pick up from `todo` → work in `doing` → submit to `review` or `done`
4. **Auto-chaining** — When Agent A completes a task with `nextTask` defined, the follow-up task is auto-created and assigned to Agent B

### OpenClaw Agent HEARTBEAT.md Example

Add this to your OpenClaw agent's `HEARTBEAT.md`:

```markdown
### Board Check
Check for assigned tasks:
curl -s http://localhost:3456/api/tasks?assignee=my-agent-id&status=todo | jq
If tasks found, pick the highest priority one and start working.
```

### OpenClaw Configuration

Set the webhook token in your Agent Board service to match your OpenClaw hooks token:

```bash
OPENCLAW_HOOK_URL=http://localhost:18789/hooks/agent
OPENCLAW_HOOK_TOKEN=your-openclaw-hooks-token
```

Agent Board maps agent IDs to OpenClaw session keys (configurable in `routes.ts`).

## Dashboard

The web dashboard at `http://localhost:3456` provides:

- **Kanban board** with drag-and-drop between columns
- **Project selector** and creation
- **Task creation** with all fields (priority, tags, dependencies, deadlines, review gates)
- **Task detail view** with comments, metrics, and dependency graph
- **Agent overview** with performance stats
- **Dark/light theme** toggle
- **Auto-refresh** every 5 seconds

### Client View

Enable `clientViewEnabled` on a project to get a read-only dashboard at:

```
http://localhost:3456/dashboard/client/:projectId
```

Client view hides agent names and internal details — safe to share with external stakeholders.

## API Reference

Base URL: `http://localhost:3456/api`

### Authentication

If `AGENTBOARD_API_KEYS` is set, all requests require an `X-API-Key` header:

```bash
curl -H "X-API-Key: sk-abc123" http://localhost:3456/api/projects
```

If no keys are configured, all requests are allowed (backward compatible).

### Health

```
GET /api/health → { "status": "ok", "uptime": 3600, "timestamp": "..." }
```

### Projects

```http
GET    /api/projects                       # List projects (?status=active&owner=alice)
GET    /api/projects/:id                   # Get project + its tasks
POST   /api/projects                       # Create project
PATCH  /api/projects/:id                   # Update project fields
DELETE /api/projects/:id                   # Delete project + all its tasks
```

**Create project:**
```json
{
  "name": "Website Redesign",
  "owner": "agency",
  "description": "Full site rebuild",
  "clientViewEnabled": true
}
```

### Tasks

```http
GET    /api/tasks                          # List tasks (?projectId=&assignee=&status=&tag=)
GET    /api/tasks/:id                      # Get single task
POST   /api/tasks                          # Create task
PATCH  /api/tasks/:id                      # Update task fields
DELETE /api/tasks/:id                      # Delete task (cleans up orphaned deps)
POST   /api/tasks/:id/move                 # Move to column (enforces DAG + gates)
POST   /api/tasks/:id/comments             # Add comment
GET    /api/tasks/:id/dependencies         # List dependencies and blockers
GET    /api/tasks/:id/dependents           # List tasks depending on this one
```

**Create task with chaining and dependencies:**
```json
{
  "projectId": "proj_abc123",
  "title": "Write landing page copy",
  "assignee": "content-creator",
  "priority": "high",
  "tags": ["copywriting"],
  "dependencies": ["task_xyz789"],
  "requiresReview": true,
  "maxRetries": 3,
  "nextTask": {
    "title": "Design landing page",
    "assignee": "design-agent",
    "priority": "high"
  }
}
```

**Move task:** `POST /api/tasks/:id/move` with `{ "column": "doing" }`

Columns: `backlog` · `todo` · `doing` · `review` · `done` · `failed`

### Templates

```http
GET    /api/templates                      # List available templates
POST   /api/projects/:id/from-template     # Apply template to project
```

```json
{ "template": "seo-audit" }
```

### Agents

```http
GET    /api/agents                         # List registered agents
POST   /api/agents                         # Register agent (409 if exists)
```

### Stats

```http
GET /api/stats                             # Board + per-agent statistics
```

Returns completion rates, average task duration, stuck task detection, and per-agent performance metrics.

### Audit Trail

```http
GET /api/audit                             # ?taskId=&agentId=&limit=100
```

Returns append-only log entries (newest first) for all REST and MCP mutations.

### Client View

```http
GET /api/client/:projectId                 # Read-only sanitized project data
```

## MCP Server

Agent Board includes a full [Model Context Protocol](https://modelcontextprotocol.io/) server for AI agent integration. Agents can manage tasks through natural MCP tool calls — no HTTP client needed.

```bash
npm run mcp                                # default data dir
node dist/mcp-server.js --data ./data      # custom data dir
```

### Claude Desktop / Claude Code Configuration

```json
{
  "mcpServers": {
    "agent-board": {
      "command": "node",
      "args": [
        "/path/to/agent-board/dist/mcp-server.js",
        "--data", "/path/to/agent-board/data"
      ]
    }
  }
}
```

### MCP Tools (12)

| Tool | Description |
|------|-------------|
| `board_list_projects` | List projects (filter by `status`, `owner`) |
| `board_get_project` | Get project details + all tasks |
| `board_create_project` | Create a new project |
| `board_update_project` | Update project fields |
| `board_create_task` | Create a task with full options (deps, chaining, gates) |
| `board_update_task` | Update task fields |
| `board_move_task` | Move task to a column (enforces deps + quality gates) |
| `board_add_comment` | Add a comment to a task |
| `board_list_tasks` | List tasks with filters |
| `board_my_tasks` | Get all tasks for a specific agent |
| `board_delete_task` | Delete a task |
| `board_delete_project` | Delete a project and all its tasks |

All MCP mutations are logged to the audit trail.

## Architecture

```
agent-board/
├── src/
│   ├── index.ts          # Express server, CLI args, static files
│   ├── routes.ts         # REST API routes, auth middleware, OpenClaw webhooks
│   ├── services.ts       # Business logic (move with deps/gates/retry/chain)
│   ├── store.ts          # JSON file storage with async mutex + atomic writes
│   ├── schemas.ts        # Zod validation schemas
│   ├── audit.ts          # Append-only JSONL audit log
│   ├── types.ts          # TypeScript interfaces
│   ├── utils.ts          # ID generation, timestamp helpers
│   └── mcp-server.ts     # MCP stdio server (12 tools)
├── dashboard/
│   ├── index.html        # Kanban dashboard (drag-and-drop)
│   ├── client.html       # Read-only client view
│   ├── app.js            # Dashboard logic
│   └── style.css         # Dark/light theme
├── templates/            # Reusable task templates (JSON)
├── tests/                # 92 tests (Vitest)
└── data/                 # Runtime data (auto-created, gitignored)
```

### Data Flow

```
Agent (REST/MCP) → Auth → Zod Validation → Service Layer → Store (mutex lock)
                                                │
                                                ├── DAG dependency check
                                                ├── Quality gate enforcement
                                                ├── Auto-retry on failure
                                                ├── Task chaining on completion
                                                ├── Audit log append
                                                └── OpenClaw webhook → Agent wakes up
```

### Design Decisions

- **Zero external database** — JSON files with atomic writes. Simple to deploy, backup, inspect, and version control.
- **Per-file async mutex** — Concurrent API calls never corrupt data, without needing PostgreSQL or Redis.
- **MCP-first** — AI agents interact through MCP tools naturally. No SDK, no client library.
- **OpenClaw-native webhooks** — Agents get woken up instantly when tasks need attention. Works with any webhook consumer.
- **Security hardened** — Path traversal protection, circular dependency detection, input validation on all routes, audit trail on all mutations.

## Running as a Service

### systemd

```ini
[Unit]
Description=Agent Board - Multi-agent task orchestration
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/agent-board
ExecStart=/usr/bin/node dist/index.js --port 3456 --data ./data
Environment=AGENTBOARD_API_KEYS=sk-key1:agent1,sk-key2:agent2
Environment=OPENCLAW_HOOK_TOKEN=your-token
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### Docker

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ dist/
COPY dashboard/ dashboard/
COPY templates/ templates/
EXPOSE 3456
CMD ["node", "dist/index.js"]
```

## Development

```bash
npm install              # Install dependencies
npm run build            # Compile TypeScript
npm run dev              # TypeScript watch mode
npm test                 # Run all 92 tests (Vitest)
```

### Tech Stack

- **Runtime:** Node.js + Express
- **Language:** TypeScript
- **Validation:** Zod
- **MCP:** @modelcontextprotocol/sdk
- **Tests:** Vitest + Supertest (92 tests)
- **Dashboard:** Vanilla HTML/CSS/JS (no build step)
- **Storage:** JSON files (no database required)

## Contributing

Issues and PRs welcome. Please run `npm test` before submitting.

## License

[MIT](LICENSE)

---

<p align="center">
  Built for AI agent teams. Works great with <a href="https://github.com/openclaw/openclaw">OpenClaw</a>.<br/>
  <a href="https://openclaw.ai">openclaw.ai</a> · <a href="https://discord.com/invite/clawd">Discord</a>
</p>
