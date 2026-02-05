# AgentBoard Security Audit & Bug Bounty Report
**Date:** 2026-02-04
**Auditor:** JarvX
**Codebase:** ~1700 LOC TypeScript (10 files)
**Tests:** 92/92 passing

---

## CRITICAL (0)

Aucune vulnérabilité critique trouvée. Le scope réseau (localhost:3456, Tailscale only) limite fortement la surface d'attaque.

---

## HIGH (3)

### H1 — Race Condition sur les écritures concurrentes (store.ts)
**Fichier:** `store.ts` — fonctions `createProject`, `updateProject`, `deleteProject`, `createTask`, `addComment`
**Description:** Seule `withLock()` est définie mais **jamais utilisée** par les fonctions exportées. Toutes les opérations CRUD font `readJSON()` → modifier → `writeJSON()` sans lock. Deux requêtes simultanées peuvent lire le même état et écraser les modifications de l'autre (lost update).
**PoC:**
```bash
# Deux créations simultanées — une peut être perdue
curl -X POST localhost:3456/api/tasks -d '{"projectId":"p1","title":"A","assignee":"x"}' &
curl -X POST localhost:3456/api/tasks -d '{"projectId":"p1","title":"B","assignee":"x"}' &
```
**Impact:** Perte de données silencieuse sous charge.
**Fix:** Wrapper toutes les opérations d'écriture avec `withLock()`. Exemple :
```typescript
export async function createTask(task: Task): Promise<Task> {
  await withLock<Task>("tasks.json", (tasks) => {
    task.status = task.column;
    tasks.push(task);
    return tasks;
  });
  return task;
}
```

### H2 — Aucune validation sur POST /agents (routes.ts:L525)
**Fichier:** `routes.ts` — route `POST /agents`
**Description:** Pas de schéma Zod. Un agent peut s'enregistrer avec n'importe quel `id`, potentiellement écraser un agent existant (via `registerAgent` qui fait upsert). Pas de validation sur `capabilities`, `role`, etc.
**PoC:**
```bash
curl -X POST localhost:3456/api/agents \
  -H "Content-Type: application/json" \
  -d '{"id":"jarvx","name":"EVIL","role":"<script>alert(1)</script>"}'
```
**Impact:** Agent hijacking, XSS stocké dans le dashboard si le role est rendu sans échappement.
**Fix:** Ajouter un `RegisterAgentSchema` Zod + interdire l'upsert sur des agents existants (ou exiger auth).

### H3 — Audit trail contournable (store.ts + routes.ts)
**Fichier:** `store.ts` — toutes les fonctions sont directement appelables
**Description:** L'audit logging est dans `routes.ts` uniquement, pas dans `store.ts`. Le MCP server (`mcp-server.ts`) fait des opérations store **sans aucun audit**. Toutes les modifications via MCP passent silencieusement.
**PoC:** N'importe quel agent avec accès MCP peut créer/supprimer/modifier des tâches sans trace.
**Impact:** Contournement complet de l'audit trail pour les opérations MCP.
**Fix:** Déplacer l'audit logging dans `store.ts` (au niveau de la persistence) ou ajouter des appels `appendAuditLog()` dans chaque tool MCP.

---

## MEDIUM (6)

### M1 — Template Path Traversal (routes.ts:L120)
**Fichier:** `routes.ts` — `loadTemplateFromDir()`
**Description:** Le paramètre `template` est passé directement à `path.join(dir, name + ".json")`. Un attaquant peut lire n'importe quel fichier .json :
```bash
curl -X POST localhost:3456/api/projects/proj_xxx/from-template \
  -d '{"template":"../../../etc/passwd"}'
```
Limité par le `.json` suffix mais peut quand même lire `../../shared/credentials.json`.
**Impact:** Lecture de fichiers JSON arbitraires (credentials, config).
**Fix:** Valider que `template` ne contient pas `..` ou `/` :
```typescript
if (name.includes('..') || name.includes('/') || name.includes('\\'))
  return null;
```

### M2 — Pas de rate limiting
**Description:** Aucun rate limit sur aucune route. Un agent malveillant ou un script peut flood l'API.
**Impact:** DoS par saturation CPU/disque (chaque write crée un backup).
**Fix:** Ajouter `express-rate-limit` (100 req/min par IP suffit pour ce use case).

### M3 — Audit log DoS (audit.ts)
**Fichier:** `audit.ts` — `readAuditLog()`
**Description:** `readAuditLog()` lit **tout** le fichier JSONL en mémoire, parse chaque ligne, puis filtre. Après des milliers d'opérations, cette route peut consommer beaucoup de RAM.
**PoC:** `GET /api/audit` sans limit → charge tout en mémoire.
**Impact:** OOM si le fichier audit.jsonl grossit trop.
**Fix:** Limiter par défaut (ex: `limit = filters?.limit || 100`) et/ou utiliser un stream reader.

### M4 — Deletion de tâche ne nettoie pas les dépendances (store.ts)
**Fichier:** `store.ts` — `deleteTask()`
**Description:** Quand une tâche est supprimée, les autres tâches qui la référencent dans `dependencies[]` gardent un ID orphelin. Ces tâches seront bloquées indéfiniment (le dep check dans `services.ts` cherche la tâche, ne la trouve pas → `dep && dep.column !== "done"` → `dep` est undefined donc false → **passe**).
**Nuance:** En fait le check `if (dep && dep.column !== "done")` fait que si dep est null, le blocker n'est pas ajouté. Donc la suppression d'une dep **débloque** silencieusement la tâche — ce qui est un bug logique inverse (la dépendance disparaît sans trace).
**Fix:** Nettoyer les `dependencies[]` de toutes les tâches quand on en supprime une :
```typescript
export function deleteTask(id: string): boolean {
  // ... existing delete logic ...
  // Clean up dangling dependencies
  const allTasks = readJSON<Task>("tasks.json", []);
  for (const t of allTasks) {
    t.dependencies = t.dependencies.filter(d => d !== id);
  }
  writeJSON("tasks.json", allTasks);
  return true;
}
```

### M5 — Circular dependencies non détectées (services.ts)
**Fichier:** `services.ts` — `moveTask()`
**Description:** On peut créer des dépendances circulaires via `PATCH /tasks/:id` (ajout de `dependencies`). Le système ne vérifie que les dépendances directes au moment du move, pas les cycles. Task A → depends on B → depends on A = deadlock permanent.
**Fix:** Ajouter une vérification de cycle lors de l'ajout de dépendances (DFS/BFS).

### M6 — PATCH /projects/:id non validé (routes.ts:L195)
**Fichier:** `routes.ts`
**Description:** `PATCH /projects/:id` passe `req.body` directement à `store.updateProject()` sans validation Zod. On peut injecter n'importe quel champ.
**PoC:**
```bash
curl -X PATCH localhost:3456/api/projects/proj_xxx \
  -d '{"id":"HIJACKED","status":"EVIL","__proto__":{"polluted":true}}'
```
**Fix:** Créer un `UpdateProjectSchema` et appliquer `validate()`.

---

## LOW (5)

### L1 — Auth bypass pour GET dashboard/client (routes.ts)
L'auth middleware s'applique à toutes les routes sous `/api`, mais la route client view (`GET /api/client/:projectId`) passe bien par l'auth. **OK.** Cependant les fichiers statiques du dashboard (`/dashboard/`) sont servis sans auth. Si le dashboard contient des tokens, ils seraient exposés.
**Status:** Acceptable vu le scope réseau (Tailscale only).

### L2 — Webhook URL hardcodée (routes.ts:L142)
`OPENCLAW_HOOK_URL` et le token sont en dur dans le code (fallback). Si les env vars ne sont pas set, le token vide fait que les webhooks échouent silencieusement — pas un problème, mais le pattern est fragile.

### L3 — backupBeforeWrite disk space (store.ts)
50 backups max par fichier JSON. Avec 2 fichiers (projects + tasks), ça fait max 100 fichiers de backup. Acceptable mais pourrait croître avec des writes fréquents.

### L4 — JSON.parse sans try/catch (store.ts:L50)
`readJSON()` fait `JSON.parse(readFileSync(...))` sans protection. Si le fichier est corrompu (crash pendant write), l'app crash au démarrage. Le write atomique (tmp + rename) minimise ce risque mais ne l'élimine pas.
**Fix:** Wrapper dans try/catch, fallback sur le dernier backup.

### L5 — MCP server manque "failed" dans board_create_task column enum
`mcp-server.ts` L77 : `column: z.enum(["backlog", "todo", "doing", "review", "done"])` — manque "failed". Incohérent avec le reste du code.

---

## Résumé

| Severity | Count | Fixed? |
|----------|-------|--------|
| Critical | 0 | — |
| High | 3 | Non |
| Medium | 6 | Non |
| Low | 5 | Non |

### Top 3 actions prioritaires :
1. **Activer withLock() sur toutes les écritures** (H1) — risque de perte de données
2. **Ajouter audit dans le MCP server** (H3) — trou dans la traçabilité
3. **Valider template path** (M1) — lecture de credentials possible

### Points forts du codebase :
- Write atomique (tmp + rename) — bonne pratique
- Zod validation sur la plupart des routes
- Backup automatique avant chaque write
- Quality gates et DAG bien implémentés
- Global error handler qui ne leak pas les paths
- Auth middleware backward-compatible

---
*Rapport généré par JarvX — 2026-02-04*
