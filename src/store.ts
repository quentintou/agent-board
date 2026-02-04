import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync, unlinkSync, copyFileSync } from "fs";
import path from "path";
import { Project, Task, Agent } from "./types";

const MAX_BACKUPS = 50;

// Async mutex for file locking (single-process, no external deps)
class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;
  async acquire(): Promise<() => void> {
    return new Promise(resolve => {
      const release = () => {
        const next = this.queue.shift();
        if (next) next();
        else this.locked = false;
      };
      if (!this.locked) { this.locked = true; resolve(release); }
      else this.queue.push(() => { resolve(release); });
    });
  }
}

const fileMutexes = new Map<string, AsyncMutex>();
function getMutex(name: string): AsyncMutex {
  if (!fileMutexes.has(name)) fileMutexes.set(name, new AsyncMutex());
  return fileMutexes.get(name)!;
}

let dataDir = path.resolve("data");

export function setDataDir(dir: string) {
  dataDir = path.resolve(dir);
}

function filePath(name: string): string {
  return path.join(dataDir, name);
}

function ensureDir() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

function readJSON<T>(name: string, fallback: T[]): T[] {
  ensureDir();
  const fp = filePath(name);
  if (!existsSync(fp)) {
    writeFileSync(fp, JSON.stringify(fallback, null, 2));
    return fallback;
  }
  try {
    return JSON.parse(readFileSync(fp, "utf-8"));
  } catch {
    return fallback;
  }
}

function backupBeforeWrite(name: string) {
  const fp = filePath(name);
  if (!existsSync(fp)) return;

  const backupDir = path.join(dataDir, "backups");
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const baseName = name.replace(/\.json$/, "");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `${baseName}-${timestamp}.json`;
  copyFileSync(fp, path.join(backupDir, backupName));

  // Prune old backups: keep only MAX_BACKUPS per file prefix
  const allBackups = readdirSync(backupDir)
    .filter(f => f.startsWith(baseName + "-") && f.endsWith(".json"))
    .sort(); // lexicographic sort by timestamp

  if (allBackups.length > MAX_BACKUPS) {
    const toDelete = allBackups.slice(0, allBackups.length - MAX_BACKUPS);
    for (const old of toDelete) {
      unlinkSync(path.join(backupDir, old));
    }
  }
}

function writeJSON<T>(name: string, data: T[]) {
  ensureDir();
  backupBeforeWrite(name);
  const fp = filePath(name);
  const tmp = fp + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, fp);
}

// Locked read-modify-write
async function withLock<T>(name: string, fn: (data: T[]) => T[]): Promise<T[]> {
  const release = await getMutex(name).acquire();
  try {
    const data = readJSON<T>(name, []);
    const result = fn(data);
    writeJSON(name, result);
    return result;
  } finally {
    release();
  }
}

// --- Projects ---

export function getProjects(filters?: { status?: string; owner?: string }): Project[] {
  let projects = readJSON<Project>("projects.json", []);
  if (filters?.status) projects = projects.filter(p => p.status === filters.status);
  if (filters?.owner) projects = projects.filter(p => p.owner === filters.owner);
  return projects;
}

export function getProject(id: string): Project | undefined {
  return readJSON<Project>("projects.json", []).find(p => p.id === id);
}

export async function createProject(project: Project): Promise<Project> {
  await withLock<Project>("projects.json", (projects) => {
    projects.push(project);
    return projects;
  });
  return project;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
  let result: Project | undefined;
  await withLock<Project>("projects.json", (projects) => {
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) { result = undefined; return projects; }
    projects[idx] = { ...projects[idx], ...updates, updatedAt: new Date().toISOString() };
    result = projects[idx];
    return projects;
  });
  return result;
}

export async function deleteProject(id: string): Promise<boolean> {
  let found = false;
  await withLock<Project>("projects.json", (projects) => {
    const idx = projects.findIndex(p => p.id === id);
    if (idx === -1) { found = false; return projects; }
    projects.splice(idx, 1);
    found = true;
    return projects;
  });
  if (!found) return false;
  // Also delete tasks belonging to this project
  await withLock<Task>("tasks.json", (tasks) => {
    return tasks.filter(t => t.projectId !== id);
  });
  return true;
}

// --- Tasks ---

export function getTasks(filters?: {
  projectId?: string;
  assignee?: string;
  status?: string;
  tag?: string;
}): Task[] {
  let tasks = readJSON<Task>("tasks.json", []);
  if (filters?.projectId) tasks = tasks.filter(t => t.projectId === filters.projectId);
  if (filters?.assignee) tasks = tasks.filter(t => t.assignee === filters.assignee);
  if (filters?.status) tasks = tasks.filter(t => t.status === filters.status || t.column === filters.status);
  if (filters?.tag) tasks = tasks.filter(t => t.tags.includes(filters.tag!));
  return tasks;
}

export function getTask(id: string): Task | undefined {
  return readJSON<Task>("tasks.json", []).find(t => t.id === id);
}

export async function createTask(task: Task): Promise<Task> {
  // Column is canonical — always derive status from column
  task.status = task.column;
  await withLock<Task>("tasks.json", (tasks) => {
    tasks.push(task);
    return tasks;
  });
  return task;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
  let result: Task | undefined;
  await withLock<Task>("tasks.json", (tasks) => {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) { result = undefined; return tasks; }
    const updated = { ...tasks[idx], ...updates, updatedAt: new Date().toISOString() };
    // Column is canonical — always derive status from column
    if (updates.column) {
      updated.status = updates.column;
    } else if (updates.status) {
      // If only status was passed, treat it as a column change
      updated.column = updates.status;
      updated.status = updates.status;
    }
    tasks[idx] = updated;
    result = tasks[idx];
    return tasks;
  });
  return result;
}

export async function deleteTask(id: string): Promise<boolean> {
  let found = false;
  await withLock<Task>("tasks.json", (tasks) => {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) { found = false; return tasks; }
    tasks.splice(idx, 1);
    found = true;
    return tasks;
  });
  return found;
}

export async function addComment(taskId: string, comment: { author: string; text: string }): Promise<Task | undefined> {
  let result: Task | undefined;
  await withLock<Task>("tasks.json", (tasks) => {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) { result = undefined; return tasks; }
    tasks[idx].comments.push({ ...comment, at: new Date().toISOString() });
    tasks[idx].updatedAt = new Date().toISOString();
    result = tasks[idx];
    return tasks;
  });
  return result;
}

// --- Agents ---

export function getAgents(): Agent[] {
  return readJSON<Agent>("agents.json", []);
}

export async function registerAgent(agent: Agent): Promise<Agent> {
  await withLock<Agent>("agents.json", (agents) => {
    const idx = agents.findIndex(a => a.id === agent.id);
    if (idx >= 0) {
      agents[idx] = agent;
    } else {
      agents.push(agent);
    }
    return agents;
  });
  return agent;
}
