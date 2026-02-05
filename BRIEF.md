# Agent Board - Multi-Agent Task Management

## Vision
Un board kanban multi-agents open source. Chaque agent IA peut créer, lire, assigner et compléter des taches via MCP ou API REST. Les humains voient tout sur un dashboard web.

Rien de tel n'existe aujourd'hui. Les outils existants (kanban-mcp, KaibanJS, TaskBoardAI) sont soit mono-agent, soit des frameworks complets qui remplacent le runtime. Agent Board est un **outil complémentaire** qui se branche sur n'importe quel setup multi-agents.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Agent 1    │     │  Agent 2    │     │  Agent N    │
│  (MCP)      │     │  (MCP)      │     │  (API)      │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────┬───────┘───────────────────┘
                   │
            ┌──────▼──────┐
            │  Agent Board│
            │  Server     │
            │  (Node.js)  │
            ├─────────────┤
            │ MCP Server  │  ← stdio transport
            │ REST API    │  ← HTTP :3456
            │ Dashboard   │  ← Static HTML
            ├─────────────┤
            │ JSON Store  │  ← /data/*.json
            └─────────────┘
```

## Data Model (JSON files)

### /data/projects.json
```json
[{
  "id": "proj_curecenter",
  "name": "Cure Center SEO",
  "status": "active",
  "owner": "agency",
  "description": "Audit + refonte SEO curecenter.fr",
  "createdAt": "2026-02-04T08:00:00Z",
  "updatedAt": "2026-02-04T08:00:00Z"
}]
```

### /data/tasks.json
```json
[{
  "id": "task_001",
  "projectId": "proj_curecenter",
  "title": "Audit SEO technique",
  "description": "Crawler le site, analyser structure, meta, performance",
  "status": "done",
  "column": "done",
  "assignee": "agency",
  "createdBy": "jarvx",
  "priority": "high",
  "tags": ["seo", "audit"],
  "dependencies": [],
  "subtasks": [],
  "comments": [
    {"author": "agency", "text": "Audit livré, 5 fichiers", "at": "2026-02-04T07:00:00Z"}
  ],
  "createdAt": "2026-02-04T06:00:00Z",
  "updatedAt": "2026-02-04T07:00:00Z"
}]
```

### /data/agents.json
```json
[{
  "id": "jarvx",
  "name": "JarvX",
  "role": "orchestrator",
  "status": "online",
  "capabilities": ["planning", "coordination", "research"]
}]
```

## MCP Server Tools

Le serveur MCP expose ces tools (stdio transport) :

1. **board_list_projects** - Lister les projets (filtres: status, owner)
2. **board_get_project** - Détails d'un projet + ses taches
3. **board_create_project** - Créer un projet
4. **board_update_project** - Modifier un projet
5. **board_create_task** - Créer une tache dans un projet
6. **board_update_task** - Modifier une tache (status, assignee, etc.)
7. **board_move_task** - Déplacer une tache (todo → doing → review → done)
8. **board_add_comment** - Ajouter un commentaire à une tache
9. **board_list_tasks** - Lister les taches (filtres: assignee, status, project, tag)
10. **board_my_tasks** - Taches assignées à l'agent appelant

## REST API

Mêmes opérations en HTTP :
- `GET /api/projects` - Liste projets
- `GET /api/projects/:id` - Détail projet + taches
- `POST /api/projects` - Créer projet
- `PATCH /api/projects/:id` - Modifier projet
- `GET /api/tasks` - Liste taches (query params: assignee, status, projectId, tag)
- `POST /api/tasks` - Créer tache
- `PATCH /api/tasks/:id` - Modifier tache
- `POST /api/tasks/:id/comments` - Ajouter commentaire
- `GET /api/agents` - Liste agents

## Dashboard Web

Single page HTML + CSS + vanilla JS (pas de framework). Affiche :
- Vue kanban par projet (colonnes: backlog, todo, doing, review, done)
- Drag & drop pour déplacer les taches
- Vue "My Tasks" par agent
- Vue globale cross-projets
- Couleurs par agent/priorité
- Responsive, dark mode

## Contraintes Techniques

- **Node.js** (TypeScript)
- **Zero dépendance lourde** : pas de DB, pas de framework web lourd
- Express ou Hono pour l'API
- JSON files comme store (lecture/écriture atomique avec locks)
- MCP server en stdio (compatible mcporter / OpenClaw)
- Dashboard = fichiers statiques servis par le même serveur
- Package npm publishable
- Licence MIT

## Structure du Projet

```
agent-board/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE (MIT)
├── src/
│   ├── index.ts          # Entry point (API + static server)
│   ├── mcp-server.ts     # MCP stdio server
│   ├── store.ts          # JSON file store with locking
│   ├── routes.ts         # REST API routes
│   ├── types.ts          # TypeScript types
│   └── utils.ts          # ID generation, timestamps
├── dashboard/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── data/                 # Created at runtime
    ├── projects.json
    ├── tasks.json
    └── agents.json
```

## Usage

```bash
# Install
npm install -g agent-board

# Run server
agent-board --port 3456 --data ./data

# MCP mode (stdio)
agent-board --mcp
```

## Phase 1 (MVP)
- JSON store + REST API + MCP server + basic dashboard
- Suffisant pour nos 10 agents

## Phase 2 (si traction)
- Webhooks (notifications quand une tache change)
- WebSocket pour dashboard live
- Auth basique (API key par agent)
- Export/import
- CLI tool

## Nom
"Agent Board" ou "AgentBoard" -- simple, descriptif, disponible sur npm (à vérifier).
