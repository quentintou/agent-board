import { appendFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

export interface AuditEntry {
  timestamp: string;
  agentId: string;
  action: string;
  taskId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  details?: string;
}

let dataDir = path.resolve("data");

export function setAuditDataDir(dir: string) {
  dataDir = path.resolve(dir);
}

function auditFilePath(): string {
  return path.join(dataDir, "audit.jsonl");
}

function ensureDir() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

export function appendAuditLog(entry: AuditEntry): void {
  ensureDir();
  const line = JSON.stringify(entry) + "\n";
  appendFileSync(auditFilePath(), line);
}

export function readAuditLog(filters?: {
  taskId?: string;
  agentId?: string;
  limit?: number;
}): AuditEntry[] {
  const fp = auditFilePath();
  if (!existsSync(fp)) return [];

  const lines = readFileSync(fp, "utf-8").split("\n").filter(Boolean);
  let entries: AuditEntry[] = lines.map(line => JSON.parse(line));

  if (filters?.taskId) {
    entries = entries.filter(e => e.taskId === filters.taskId);
  }
  if (filters?.agentId) {
    entries = entries.filter(e => e.agentId === filters.agentId);
  }

  // Return newest first
  entries.reverse();

  if (filters?.limit && filters.limit > 0) {
    entries = entries.slice(0, filters.limit);
  }

  return entries;
}
