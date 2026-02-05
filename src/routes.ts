import { Router, Request, Response, NextFunction } from "express";
import { existsSync, readFileSync, readdirSync } from "fs";
import pathLib from "path";
import { createHmac } from "crypto";
import { z } from "zod";
import * as store from "./store";
import { generateId, now } from "./utils";
import { Task, TaskColumn, TaskPriority, NextTask, AgentStats, BoardStats } from "./types";
import { moveTask } from "./services";
import { appendAuditLog, readAuditLog } from "./audit";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  MoveTaskSchema,
  CreateProjectSchema,
  CreateCommentSchema,
  RegisterAgentSchema,
  UpdateProjectSchema,
} from "./schemas";

const router = Router();

// --- API Key Authentication Middleware ---

interface ApiKey {
  key: string;
  agentId: string;
}

function loadApiKeys(): Map<string, string> {
  const raw = process.env.AGENTBOARD_API_KEYS || "";
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const pair of raw.split(",")) {
    const [key, agentId] = pair.split(":");
    if (key && agentId) map.set(key.trim(), agentId.trim());
  }
  return map;
}

const apiKeys = loadApiKeys();

export function reloadApiKeys(): void {
  const fresh = loadApiKeys();
  apiKeys.clear();
  for (const [k, v] of fresh) apiKeys.set(k, v);
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth if no keys configured (backward compatible)
  if (apiKeys.size === 0) {
    (req as any).agentId = "anonymous";
    return next();
  }

  // Skip auth for GET requests to dashboard-related routes
  // (health and stats are fine without auth for monitoring)

  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: "Missing X-API-Key header" });
    return;
  }

  const agentId = apiKeys.get(apiKey);
  if (!agentId) {
    res.status(403).json({ error: "Invalid API key" });
    return;
  }

  (req as any).agentId = agentId;
  next();
}

// Apply auth middleware to all routes
router.use(authMiddleware);

// --- Zod Validation Helper ---

function validate<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        details: result.error.issues,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// --- Audit Helper ---

function getAgentId(req: Request): string {
  return (req as any).agentId || "unknown";
}

// --- Dependency Cycle Detection ---

function hasCycle(taskId: string, dependencies: string[]): boolean {
  const visited = new Set<string>();
  const stack = [...dependencies];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const task = store.getTask(current);
    if (task) {
      for (const dep of task.dependencies) {
        stack.push(dep);
      }
    }
  }
  return false;
}

// --- Templates ---

const TEMPLATES_DIR = process.env.TEMPLATES_DIR || pathLib.resolve("templates");

function loadTemplate(name: string): any[] | null {
  const fp = pathLib.join(TEMPLATES_DIR, `${name}.json`);
  if (!existsSync(fp)) return null;
  try {
    const data = JSON.parse(readFileSync(fp, "utf-8"));
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export function setTemplatesDir(dir: string) {
  // For testing: override the templates dir at runtime
  (globalThis as any).__TEMPLATES_DIR = dir;
}

function getTemplatesDir(): string {
  return (globalThis as any).__TEMPLATES_DIR || TEMPLATES_DIR;
}

function loadTemplateFromDir(name: string): any[] | null {
  // M1 fix: prevent path traversal
  if (/[\/\\]|\.\./.test(name)) return null;

  const dir = getTemplatesDir();
  const fp = pathLib.join(dir, `${name}.json`);
  if (!existsSync(fp)) return null;
  try {
    const data = JSON.parse(readFileSync(fp, "utf-8"));
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

// --- OpenClaw Webhook Integration ---

const OPENCLAW_HOOK_URL = process.env.OPENCLAW_HOOK_URL || "http://localhost:18789/hooks/agent";
const OPENCLAW_HOOK_TOKEN = process.env.OPENCLAW_HOOK_TOKEN || "";

function getHookToken(): string {
  return process.env.OPENCLAW_HOOK_TOKEN || OPENCLAW_HOOK_TOKEN;
}

// --- HMAC Signing ---

function getWebhookSecret(): string {
  return process.env.AGENTBOARD_WEBHOOK_SECRET || getHookToken();
}

export function signPayload(body: Record<string, unknown>, secret: string): { signature: string; timestamp: number } {
  const timestamp = Date.now();
  const bodyWithTimestamp = { ...body, timestamp };
  const raw = JSON.stringify(bodyWithTimestamp);
  const hmac = createHmac("sha256", secret).update(raw).digest("hex");
  return { signature: `sha256=${hmac}`, timestamp };
}

// Agent ID -> OpenClaw agent session key mapping
const AGENT_SESSION_MAP: Record<string, string> = {
  "jarvx": "agent:main:main",
  "eff": "agent:eff:main",
  "agency": "agent:agency:main",
  "auteur-augmente": "agent:auteur-augmente:main",
  "content-creator": "agent:content:main",
  "sales-agent": "agent:sales:main",
  "research-agent": "agent:research:main",
  "coding-agent": "agent:coding:main",
  "support": "agent:support:main",
  "onboarding": "agent:onboarding:main",
  "community": "agent:community:main",
  "ops": "agent:ops:main",
  "infra-agent": "agent:infra:main",
};

// Map board assignee names to gateway agent IDs
function resolveAgentId(assignee: string): string {
  const sessionKey = AGENT_SESSION_MAP[assignee];
  if (sessionKey) {
    // Extract agent ID from "agent:{id}:main" format
    const parts = sessionKey.split(":");
    return parts.length >= 2 ? parts[1] : assignee;
  }
  return assignee;
}

async function notifyAgent(task: Task, context?: string, event?: string): Promise<boolean> {
  const hookToken = getHookToken();
  if (!hookToken) return false;
  const agentName = task.assignee;
  if (!agentName) return false;

  const message = [
    `[AgentBoard] Task: ${task.title} (${task.id})`,
    context ? `Contexte: ${context}` : "",
    task.description ? `Brief: ${task.description.slice(0, 300)}` : "",
    ``,
    `Check ton board et traite cette task.`,
  ].filter(Boolean).join("\n");

  try {
    const resolvedAgent = resolveAgentId(agentName);
    const basePayload: Record<string, unknown> = {
      agent: resolvedAgent,
      message,
      wakeMode: "now",
      source: "agentboard",
      taskId: task.id,
      event: event || undefined,
    };

    const secret = getWebhookSecret();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${hookToken}`,
    };

    let finalPayload: Record<string, unknown>;

    if (secret) {
      const { signature, timestamp } = signPayload(basePayload, secret);
      finalPayload = { ...basePayload, timestamp, signature };
      headers["X-AgentBoard-Signature"] = signature;
      headers["X-AgentBoard-Timestamp"] = String(timestamp);
      headers["X-AgentBoard-Source"] = "agentboard";
    } else {
      finalPayload = basePayload;
    }

    const res = await fetch(OPENCLAW_HOOK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(finalPayload),
    });
    return res.ok;
  } catch (e) {
    console.error(`[webhook] Failed to notify ${agentName}:`, e);
    return false;
  }
}

async function sendTaskUpdateWebhook(task: Task): Promise<boolean> {
  const webhookUrl = process.env.OPENCLAW_HOOK_URL || "http://localhost:18789/hooks";
  const webhookToken = process.env.OPENCLAW_HOOK_TOKEN || "";

  const payload = {
    event: "task.updated",
    taskId: task.id,
    status: task.status,
    assignedTo: task.assignee,
    title: task.title,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${webhookToken}`,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.error(`[webhook] Failed to send task update webhook:`, e);
    return false;
  }
}

// --- Health ---

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// --- Projects ---

router.get("/projects", (req: Request, res: Response) => {
  const { status, owner } = req.query;
  res.json(store.getProjects({
    status: status as string | undefined,
    owner: owner as string | undefined,
  }));
});

router.get("/projects/:id", (req: Request, res: Response) => {
  const id = req.params.id as string;
  const project = store.getProject(id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  const tasks = store.getTasks({ projectId: id });
  res.json({ ...project, tasks });
});

router.post("/projects", validate(CreateProjectSchema), async (req: Request, res: Response) => {
  const { name, owner, description, clientViewEnabled } = req.body;
  const project = await store.createProject({
    id: generateId("proj"),
    name,
    status: "active",
    owner: owner || "unknown",
    description: description || "",
    clientViewEnabled: clientViewEnabled || false,
    createdAt: now(),
    updatedAt: now(),
  });

  appendAuditLog({
    timestamp: now(),
    agentId: getAgentId(req),
    action: "project.create",
    projectId: project.id,
    details: `Created project "${project.name}"`,
  });

  res.status(201).json(project);
});

router.patch("/projects/:id", validate(UpdateProjectSchema), async (req: Request, res: Response) => {
  const updated = await store.updateProject(req.params.id as string, req.body);
  if (!updated) return res.status(404).json({ error: "Project not found" });

  appendAuditLog({
    timestamp: now(),
    agentId: getAgentId(req),
    action: "project.update",
    projectId: req.params.id as string,
    details: `Updated project fields: ${Object.keys(req.body).join(", ")}`,
  });

  res.json(updated);
});

router.delete("/projects/:id", async (req: Request, res: Response) => {
  const project = store.getProject(req.params.id as string);
  const deleted = await store.deleteProject(req.params.id as string);
  if (!deleted) return res.status(404).json({ error: "Project not found" });

  appendAuditLog({
    timestamp: now(),
    agentId: getAgentId(req),
    action: "project.delete",
    projectId: req.params.id as string,
    details: `Deleted project "${project?.name || req.params.id}"`,
  });

  res.json({ ok: true });
});

// --- Project Templates ---

router.get("/templates", (_req: Request, res: Response) => {
  const dir = getTemplatesDir();
  if (!existsSync(dir)) return res.json([]);
  try {
    const files = readdirSync(dir).filter(f => f.endsWith(".json"));
    res.json(files.map(f => f.replace(/\.json$/, "")));
  } catch {
    res.json([]);
  }
});

router.post("/projects/:id/from-template", async (req: Request, res: Response) => {
  const projectId = req.params.id as string;
  const project = store.getProject(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const { template, tasks: inlineTasks } = req.body;

  let taskDefs: any[];

  if (template) {
    const loaded = loadTemplateFromDir(template);
    if (!loaded) return res.status(404).json({ error: `Template "${template}" not found` });
    taskDefs = loaded;
  } else if (Array.isArray(inlineTasks) && inlineTasks.length > 0) {
    taskDefs = inlineTasks;
  } else {
    return res.status(400).json({ error: "Provide 'template' name or 'tasks' array" });
  }

  // Create tasks, mapping placeholder refs to real IDs
  const refMap = new Map<string, string>(); // placeholder ref -> real task id
  const created: Task[] = [];

  for (const def of taskDefs) {
    if (!def.title) continue;
    const taskId = generateId("task");
    if (def.ref) refMap.set(def.ref, taskId);

    const col: TaskColumn = def.column || "backlog";
    let nextTask: NextTask | undefined;
    if (def.nextTask) {
      nextTask = { ...def.nextTask };
    }

    const task: Task = {
      id: taskId,
      projectId,
      title: def.title,
      description: def.description || "",
      status: col,
      column: col,
      assignee: def.assignee || project.owner || "unassigned",
      createdBy: "template",
      priority: def.priority || "medium",
      tags: def.tags || [],
      dependencies: [],
      subtasks: [],
      comments: [],
      nextTask,
      inputPath: def.inputPath || undefined,
      outputPath: def.outputPath || undefined,
      requiresReview: def.requiresReview || false,
      maxRetries: def.maxRetries ?? 2,
      retryCount: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    await store.createTask(task);
    created.push(task);
  }

  // Second pass: resolve nextTask refs
  for (const task of created) {
    if (task.nextTask && (task.nextTask as any).ref) {
      const realId = refMap.get((task.nextTask as any).ref);
      if (realId) {
        const refTask = created.find(t => t.id === realId);
        if (refTask) {
          task.nextTask = {
            title: refTask.title,
            description: refTask.description,
            assignee: refTask.assignee,
            priority: refTask.priority,
            tags: refTask.tags,
          };
          await store.updateTask(task.id, { nextTask: task.nextTask });
        }
      }
    }
  }

  appendAuditLog({
    timestamp: now(),
    agentId: getAgentId(req),
    action: "project.from-template",
    projectId,
    details: `Created ${created.length} tasks from template`,
  });

  res.status(201).json({ created: created.length, tasks: created });
});

// --- Tasks ---

router.get("/tasks/:id", (req: Request, res: Response) => {
  const task = store.getTask(req.params.id as string);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

router.get("/tasks", (req: Request, res: Response) => {
  const { projectId, assignee, status, tag } = req.query;
  res.json(store.getTasks({
    projectId: projectId as string | undefined,
    assignee: assignee as string | undefined,
    status: status as string | undefined,
    tag: tag as string | undefined,
  }));
});

router.post("/tasks", validate(CreateTaskSchema), async (req: Request, res: Response) => {
  const { projectId, title, description, assignee, createdBy, priority, tags, column, nextTask, parentTaskId, requiresReview, maxRetries, deadline, inputPath, outputPath, dependencies } = req.body;
  const col: TaskColumn = column || "backlog";
  const task: Task = {
    id: generateId("task"),
    projectId,
    title,
    description: description || "",
    status: col,
    column: col,
    assignee,
    createdBy: createdBy || "unknown",
    priority: priority || "medium",
    tags: tags || [],
    dependencies: dependencies || [],
    subtasks: [],
    comments: [],
    nextTask: nextTask || undefined,
    parentTaskId: parentTaskId || undefined,
    deadline: deadline || undefined,
    inputPath: inputPath || undefined,
    outputPath: outputPath || undefined,
    requiresReview: requiresReview || false,
    maxRetries: maxRetries ?? 2,
    retryCount: 0,
    startedAt: col === "doing" ? now() : undefined,
    createdAt: now(),
    updatedAt: now(),
  };
  const created = await store.createTask(task);

  appendAuditLog({
    timestamp: now(),
    agentId: getAgentId(req),
    action: "task.create",
    taskId: created.id,
    projectId: created.projectId,
    details: `Created task "${created.title}"`,
  });

  // Notify agent only for high/critical priority tasks (routine tasks picked up via heartbeat)
  if (created.column === "todo" && created.assignee && (created.priority === "high" || created.priority === "urgent")) {
    notifyAgent(created, undefined, "task.create").catch(() => {});
  }

  // Webhook to main disabled (pollutes Quentin's chat)
  // sendTaskUpdateWebhook(created).catch(() => {});

  res.status(201).json(created);
});

router.patch("/tasks/:id", validate(UpdateTaskSchema), async (req: Request, res: Response) => {
  // Cycle detection when dependencies are being updated
  if (req.body.dependencies && Array.isArray(req.body.dependencies)) {
    if (hasCycle(req.params.id as string, req.body.dependencies)) {
      return res.status(400).json({ error: "Circular dependency detected" });
    }
  }

  // Capture previous assignee before update for change detection
  const taskBefore = store.getTask(req.params.id as string);
  const previousAssignee = taskBefore?.assignee;

  const updated = await store.updateTask(req.params.id as string, req.body);
  if (!updated) return res.status(404).json({ error: "Task not found" });

  appendAuditLog({
    timestamp: now(),
    agentId: getAgentId(req),
    action: "task.update",
    taskId: updated.id,
    projectId: updated.projectId,
    details: `Updated task fields: ${Object.keys(req.body).join(", ")}`,
  });

  // Notify NEW assignee when assignee changes via PATCH
  if (req.body.assignee && req.body.assignee !== previousAssignee && updated.assignee) {
    notifyAgent(updated, `Task reassigned to you (was: ${previousAssignee || "unassigned"})`, "task.assign").catch(() => {});
  }

  res.json(updated);
});

router.delete("/tasks/:id", async (req: Request, res: Response) => {
  const taskId = req.params.id as string;
  const task = store.getTask(taskId);
  const deleted = await store.deleteTask(taskId);
  if (!deleted) return res.status(404).json({ error: "Task not found" });

  // Clean up orphaned dependencies in other tasks
  const allTasks = store.getTasks({});
  for (const t of allTasks) {
    if (t.dependencies.includes(taskId)) {
      await store.updateTask(t.id, {
        dependencies: t.dependencies.filter(d => d !== taskId),
      });
    }
  }

  if (task) {
    appendAuditLog({
      timestamp: now(),
      agentId: getAgentId(req),
      action: "task.delete",
      taskId: task.id,
      projectId: task.projectId,
      details: `Deleted task "${task.title}"`,
    });
  }

  res.json({ ok: true });
});

router.post("/tasks/:id/comments", validate(CreateCommentSchema), async (req: Request, res: Response) => {
  const { author, text } = req.body;
  const updated = await store.addComment(req.params.id as string, { author, text });
  if (!updated) return res.status(404).json({ error: "Task not found" });

  appendAuditLog({
    timestamp: now(),
    agentId: getAgentId(req),
    action: "comment.add",
    taskId: updated.id,
    projectId: updated.projectId,
    details: `Comment by ${author}: ${text.slice(0, 100)}`,
  });

  // Notify assignee in real-time via webhook (if comment is from a different agent)
  if (updated.assignee && updated.assignee !== author) {
    notifyAgent(updated, `New comment from ${author}: ${text.slice(0, 200)}`, "comment.add").catch(() => {});
  }

  res.json(updated);
});

// --- GET Comments ---

router.get("/tasks/:id/comments", (req: Request, res: Response) => {
  const task = store.getTask(req.params.id as string);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task.comments);
});

// --- Task Dependencies ---

router.get("/tasks/:id/dependencies", (req: Request, res: Response) => {
  const task = store.getTask(req.params.id as string);
  if (!task) return res.status(404).json({ error: "Task not found" });

  const dependencies: Task[] = [];
  const blockedBy: Task[] = [];

  for (const depId of task.dependencies) {
    const dep = store.getTask(depId);
    if (dep) {
      dependencies.push(dep);
      if (dep.column !== "done") {
        blockedBy.push(dep);
      }
    }
  }

  res.json({ task, dependencies, blockedBy });
});

router.get("/tasks/:id/dependents", (req: Request, res: Response) => {
  const task = store.getTask(req.params.id as string);
  if (!task) return res.status(404).json({ error: "Task not found" });

  const allTasks = store.getTasks({});
  const dependents = allTasks.filter(t => t.dependencies.includes(task.id));

  res.json({ task, dependents });
});

// --- Client View ---

router.get("/client/:projectId", (req: Request, res: Response) => {
  const project = store.getProject(req.params.projectId as string);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!project.clientViewEnabled) return res.status(403).json({ error: "Client view is not enabled for this project" });

  const tasks = store.getTasks({ projectId: project.id });
  const total = tasks.length;
  const done = tasks.filter(t => t.column === "done").length;

  // Filter out internal fields
  const clientTasks = tasks.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.column,
    priority: t.priority,
    tags: t.tags,
    teamMember: t.assignee ? "Team Member" : "Unassigned",
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    completedAt: t.completedAt,
  }));

  const lastUpdated = tasks.length
    ? tasks.reduce((latest, t) => t.updatedAt > latest ? t.updatedAt : latest, tasks[0].updatedAt)
    : project.updatedAt;

  res.json({
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
    },
    tasks: clientTasks,
    progress: { total, done, percentage: total > 0 ? Math.round((done / total) * 100) : 0 },
    lastUpdated,
  });
});

// --- Move Task (convenience) ---

router.post("/tasks/:id/move", validate(MoveTaskSchema), async (req: Request, res: Response) => {
  const { column } = req.body;
  const taskBefore = store.getTask(req.params.id as string);
  const fromColumn = taskBefore?.column;

  const result = await moveTask(req.params.id as string, column);

  if ("error" in result && !("task" in result)) {
    const status = result.error === "Task not found" ? 404 : 400;
    return res.status(status).json(result);
  }

  const moveResult = result as { task: Task; retried: boolean; chainedTask?: Task };

  appendAuditLog({
    timestamp: now(),
    agentId: getAgentId(req),
    action: "task.move",
    taskId: moveResult.task.id,
    projectId: moveResult.task.projectId,
    from: fromColumn,
    to: column,
    details: moveResult.retried ? `Moved to failed, auto-retried` : `Moved from ${fromColumn} to ${column}`,
  });

  // Notify assignee when moved to doing, review, or failed
  if ((column === "doing" || column === "review" || column === "failed") && moveResult.task.assignee) {
    const contextMap: Record<string, string> = {
      doing: "Task remise en doing, check les commentaires pour le feedback",
      review: "Task moved to review",
      failed: "Task has failed",
    };
    notifyAgent(moveResult.task, contextMap[column], "task.move").catch(() => {});
  }

  // Notify on retry
  if (moveResult.retried) {
    const retriedTask = store.getTask(req.params.id as string);
    if (retriedTask) {
      notifyAgent(retriedTask, `Auto-retry. Check les commentaires pour comprendre l'echec.`, "task.move").catch(() => {});
    }
  }

  // Notify on failed max retries (alert ops)
  if (column === "failed" && !moveResult.retried) {
    const alertTask = { ...moveResult.task, assignee: "ops" } as Task;
    notifyAgent(alertTask, `ALERTE: Task "${moveResult.task.title}" a echoue. Agent: ${moveResult.task.assignee}. Intervention manuelle requise.`, "task.move").catch(() => {});
  }

  // Notify on chained task
  if (moveResult.chainedTask) {
    notifyAgent(moveResult.chainedTask, `Chained from "${moveResult.task.title}" by ${moveResult.task.assignee}`, "task.create").catch(() => {});
  }

  res.json(moveResult);
});

// --- Audit ---

router.get("/audit", (req: Request, res: Response) => {
  const { taskId, agentId, limit } = req.query;
  const entries = readAuditLog({
    taskId: taskId as string | undefined,
    agentId: agentId as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : 100,
  });
  res.json(entries);
});

// --- Stats ---

router.get("/stats", (_req: Request, res: Response) => {
  const tasks = store.getTasks({});
  const agents = store.getAgents();
  const nowMs = Date.now();

  // By status
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const durations: number[] = [];

  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    if (t.durationMs) durations.push(t.durationMs);
  }

  const completed = tasks.filter(t => t.status === "done").length;
  const failed = tasks.filter(t => t.status === "failed").length;
  const completionRate = tasks.length ? completed / tasks.length : 0;
  const avgDurationMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  // Per-agent stats
  const agentStats: AgentStats[] = agents.map(a => {
    const agentTasks = tasks.filter(t => t.assignee === a.id);
    const agentCompleted = agentTasks.filter(t => t.status === "done");
    const agentFailed = agentTasks.filter(t => t.status === "failed").length;
    const agentInProgress = agentTasks.filter(t => t.status === "doing").length;
    const agentDurations = agentCompleted.filter(t => t.durationMs).map(t => t.durationMs!);
    return {
      agentId: a.id,
      totalTasks: agentTasks.length,
      completed: agentCompleted.length,
      failed: agentFailed,
      inProgress: agentInProgress,
      avgDurationMs: agentDurations.length ? Math.round(agentDurations.reduce((a, b) => a + b, 0) / agentDurations.length) : null,
      completionRate: agentTasks.length ? agentCompleted.length / agentTasks.length : 0,
    };
  }).filter(a => a.totalTasks > 0);

  // Oldest doing task (stuck detection)
  const doingTasks = tasks.filter(t => t.status === "doing" && t.startedAt);
  let oldestDoingTask: BoardStats["oldestDoingTask"] = null;
  if (doingTasks.length) {
    const oldest = doingTasks.sort((a, b) => new Date(a.startedAt!).getTime() - new Date(b.startedAt!).getTime())[0];
    oldestDoingTask = {
      id: oldest.id,
      title: oldest.title,
      assignee: oldest.assignee,
      startedAt: oldest.startedAt!,
      ageMs: nowMs - new Date(oldest.startedAt!).getTime(),
    };
  }

  const stats: BoardStats = {
    totalTasks: tasks.length,
    byStatus,
    byPriority,
    avgDurationMs,
    completionRate,
    agentStats,
    oldestDoingTask,
  };

  res.json(stats);
});

// --- Agents ---

router.get("/agents", (_req: Request, res: Response) => {
  res.json(store.getAgents());
});

router.post("/agents", validate(RegisterAgentSchema), async (req: Request, res: Response) => {
  const { id, name, role, capabilities } = req.body;

  // Check for existing agent — no upsert allowed
  const existing = store.getAgents().find(a => a.id === id);
  if (existing) {
    return res.status(409).json({ error: `Agent "${id}" already exists` });
  }

  const agent = await store.registerAgent({
    id,
    name,
    role: role || "worker",
    status: "online",
    capabilities: capabilities || [],
  });

  appendAuditLog({
    timestamp: now(),
    agentId: getAgentId(req),
    action: "agent.register",
    details: `Registered agent "${name}" (${id})`,
  });

  res.status(201).json(agent);
});

export default router;
