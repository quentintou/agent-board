<p align="center">
  <h1 align="center">Agent Board</h1>
  <p align="center">
    <strong>Multi-agent task orchestration with Kanban dashboard, REST API, and MCP server.</strong>
  </p>
  <p align="center">
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#api-reference">API</a> •
    <a href="#mcp-server">MCP</a> •
    <a href="#dashboard">Dashboard</a> •
    <a href="#architecture">Architecture</a>
  </p>
</p>

---

Agent Board is a lightweight task management system built for **AI agent teams**. It gives multiple agents (or humans) a shared Kanban board with dependency tracking, auto-retry, task chaining, quality gates, and a full audit trail — all through a REST API or MCP tools.

Think of it as a project manager for your AI agents: assign tasks, enforce workflows, and track everything.

## Features

| Feature | Description |
|---------|-------------|
| **Kanban Board** | 6 columns: `backlog` → `todo` → `doing` → `review` → `done` → `failed` |
| **DAG Dependencies** | Tasks can depend on other tasks. Moving to `doing` is blocked until all dependencies are `done`. Cycle detection prevents deadlocks. |
| **Quality Gates** | Mark tasks as `requiresReview: true` — they must pass through `review` before `done`. |
| **Auto-Retry** | When a task moves to `failed`, it automatically retries (back to `todo`) up to `maxRetries` times. System comments track each attempt. |
| **Task Chaining** | Define a `nextTask` on any task. When it completes, the next task is auto-created and assigned. Build pipelines without orchestration code. |
| **Webhook Notifications** | Integrates with [OpenClaw](https://github.com/openclaw/openclaw) hooks to wake agents when tasks are assigned or retried. |
| **Audit Trail** | Every action is logged to `audit.jsonl` — who did what, when, to which task. Queryable via API. |
| **Client View** | Read-only project dashboard for clients. Enable per-project with `clientViewEnabled`. Hides internal details (agent names → "Team Member"). |
| **Project Templates** | Pre-define task sets as JSON templates. Apply them to any project in one call. |
| **Board Stats** | Per-agent and global statistics: completion rates, average duration, stuck task detection. |
| **MCP Server** | Full Model Context Protocol integration — AI agents manage tasks through MCP tools. |
| **API Key Auth** | Optional per-agent API key authentication via environment variable. Backward-compatible (no keys = no auth). |
| **Zod Validation** | All inputs validated with Zod schemas. Clear error messages on invalid requests. |
| **Atomic Writes** | Data files use temp-file-then-rename with per-file mutex locking. No corruption on concurrent access. |
| **Auto-Backup** | Automatic backups before every write (up to 50 per file, auto-pruned). |

## Quick Start

```bash
git clone https://github.com/your-org/agent-board.git
cd agent-board
npm install
npm run build
npm start
```

Open **http://localhost:3456** for the dashboard, or hit **http://localhost:3456/api** for the REST API.

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
| `AGENTBOARD_API_KEYS` | Comma-separated `key:agentId` pairs for API authentication. Example: `sk-abc123:jarvx,sk-def456:ops` |
| `OPENCLAW_HOOK_URL` | Webhook URL for agent notifications (default: `http://localhost:18789/hooks/agent`) |
| `OPENCLAW_HOOK_TOKEN` | Bearer token for webhook calls. Notifications are disabled if not set. |

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
GET /api/health
```

Returns `{ "status": "ok" }`.

### Projects

```http
GET    /api/projects                       # List projects (?status=active&owner=jarvx)
GET    /api/projects/:id                   # Get project + its tasks
POST   /api/projects                       # Create project
PATCH  /api/projects/:id                   # Update project fields
DELETE /api/projects/:id                   # Delete project + all its tasks
```

**Create project body:**
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
DELETE /api/tasks/:id                      # Delete task
POST   /api/tasks/:id/move                 # Move to column
POST   /api/tasks/:id/comments             # Add comment
GET    /api/tasks/:id/dependencies         # List dependencies (resolved)
GET    /api/tasks/:id/dependents           # List tasks that depend on this one
```

**Create task body:**
```json
{
  "projectId": "proj_abc123",
  "title": "Write landing page copy",
  "description": "Hero section + 3 feature blocks",
  "assignee": "content-creator",
  "priority": "high",
  "tags": ["copywriting", "phase1"],
  "dependencies": ["task_xyz789"],
  "requiresReview": true,
  "maxRetries": 3,
  "deadline": "2026-02-10",
  "nextTask": {
    "title": "Review landing page copy",
    "assignee": "agency",
    "priority": "high"
  }
}
```

**Move task body:**
```json
{ "column": "doing" }
```

Columns: `backlog`, `todo`, `doing`, `review`, `done`, `failed`

### Templates

```http
GET    /api/templates                      # List available templates
POST   /api/projects/:id/from-template     # Apply template to project
```

**Apply template:**
```json
{ "template": "seo-audit" }
```

Or inline:
```json
{
  "tasks": [
    { "title": "Audit technical SEO", "assignee": "research-agent", "ref": "t1" },
    { "title": "Fix issues", "assignee": "coding-agent", "dependencies": ["t1"] }
  ]
}
```

### Stats

```http
GET /api/stats
```

Returns global and per-agent statistics:

```json
{
  "totalTasks": 47,
  "byStatus": { "done": 23, "doing": 8, "todo": 12, "backlog": 4 },
  "byPriority": { "high": 15, "medium": 20, "low": 12 },
  "avgDurationMs": 3600000,
  "completionRate": 0.49,
  "agentStats": [
    {
      "agentId": "content-creator",
      "totalTasks": 12,
      "completed": 8,
      "failed": 1,
      "inProgress": 2,
      "avgDurationMs": 2400000,
      "completionRate": 0.67
    }
  ],
  "oldestDoingTask": {
    "id": "task_abc",
    "title": "Stuck task",
    "assignee": "coding-agent",
    "startedAt": "2026-02-01T10:00:00Z",
    "ageMs": 259200000
  }
}
```

### Audit Trail

```http
GET /api/audit                             # ?taskId=&agentId=&limit=100
```

Returns JSONL entries (newest first):

```json
[
  {
    "timestamp": "2026-02-04T19:48:00Z",
    "agentId": "jarvx",
    "action": "task.move",
    "taskId": "task_abc",
    "projectId": "proj_xyz",
    "from": "todo",
    "to": "doing"
  }
]
```

### Client View API

```http
GET /api/client/:projectId                 # Read-only project data (no auth required)
```

Returns sanitized project data with progress percentage. Agent names are hidden.

### Agents

```http
GET    /api/agents                         # List all registered agents
POST   /api/agents                         # Register agent { id, name, role?, capabilities? }
```

## MCP Server

Run the stdio-based MCP server for AI agent integration:

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

### MCP Tools

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

## Architecture

```
agent-board/
├── src/
│   ├── index.ts          # Express server, CLI args, static files
│   ├── routes.ts         # REST API routes, auth middleware, webhooks
│   ├── services.ts       # Business logic (move with deps/gates/retry/chain)
│   ├── store.ts          # JSON file storage with mutex + atomic writes + backup
│   ├── schemas.ts        # Zod validation schemas
│   ├── audit.ts          # Append-only JSONL audit log
│   ├── types.ts          # TypeScript interfaces
│   ├── utils.ts          # ID generation, timestamp helpers
│   └── mcp-server.ts     # MCP stdio server (12 tools)
├── dashboard/
│   ├── index.html        # Main Kanban dashboard
│   ├── client.html       # Read-only client view
│   ├── app.js            # Dashboard logic (drag-drop, CRUD, themes)
│   └── style.css         # Dark/light theme styles
├── templates/            # Reusable task templates (JSON)
├── workflows/            # Workflow documentation
├── tests/                # 92 tests (Vitest)
├── data/                 # Runtime data (auto-created)
│   ├── projects.json
│   ├── tasks.json
│   ├── agents.json
│   ├── audit.jsonl
│   └── backups/          # Auto-backups (max 50 per file)
└── package.json
```

### Data Flow

```
Agent (API/MCP) → Zod Validation → Service Layer → Store (mutex + atomic write)
                                       │
                                       ├── Dependency check (DAG)
                                       ├── Quality gate enforcement
                                       ├── Auto-retry on failure
                                       ├── Task chaining on completion
                                       ├── Audit log append
                                       └── Webhook notification → OpenClaw → Agent session
```

### Key Design Decisions

- **Zero external database** — JSON files with atomic writes. Simple to deploy, backup, and inspect.
- **Per-file mutex** — Concurrent API calls don't corrupt data, without needing a database.
- **Backward-compatible auth** — No API keys configured = no auth required. Add keys when you need them.
- **Webhook-based notifications** — Agents get woken up when tasks are assigned. Integrates with OpenClaw but works standalone.
- **MCP-first** — AI agents interact through MCP tools naturally, no SDK or client library needed.

## Webhook Integration

Agent Board can notify AI agents via webhooks when:

- A new task is assigned
- A task is retried after failure
- A chained task is created
- A task fails permanently (max retries exhausted → notifies ops)

Configure with environment variables:

```bash
OPENCLAW_HOOK_URL=http://localhost:18789/hooks/agent
OPENCLAW_HOOK_TOKEN=your-secret-token
```

The webhook payload includes the task details and is routed to the correct agent session.

## Development

```bash
npm run dev          # TypeScript watch mode
npm test             # Run all 92 tests
```

### Tech Stack

- **Runtime:** Node.js + Express
- **Language:** TypeScript
- **Validation:** Zod
- **MCP:** @modelcontextprotocol/sdk
- **Tests:** Vitest + Supertest
- **Dashboard:** Vanilla HTML/CSS/JS (no build step)
- **Storage:** JSON files (no database required)

## Running as a Service

### systemd

```ini
[Unit]
Description=Agent Board
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/agent-board
ExecStart=/usr/bin/node dist/index.js --port 3456 --data ./data
Environment=AGENTBOARD_API_KEYS=sk-key1:agent1,sk-key2:agent2
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

## License

[MIT](LICENSE)

---

Built for AI agent teams. Works great with [OpenClaw](https://github.com/openclaw/openclaw).
