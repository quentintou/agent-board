import * as store from "./store";
import { generateId, now } from "./utils";
import { Task, TaskColumn } from "./types";

export interface MoveResult {
  task: Task;
  retried: boolean;
  chainedTask?: Task;
  error?: string;
}

const VALID_COLUMNS: TaskColumn[] = ["backlog", "todo", "doing", "review", "done", "failed"];

export async function moveTask(taskId: string, column: TaskColumn): Promise<MoveResult | { error: string; requiresReview?: boolean }> {
  if (!column) return { error: "column is required" };
  if (!VALID_COLUMNS.includes(column)) return { error: `column must be one of: ${VALID_COLUMNS.join(", ")}` };

  const current = store.getTask(taskId);
  if (!current) return { error: "Task not found" };

  // Dependency gate: when moving to "doing", check all dependencies are in "done"
  if (column === "doing" && current.dependencies.length > 0) {
    const blockers: { id: string; title: string; column: string }[] = [];
    for (const depId of current.dependencies) {
      const dep = store.getTask(depId);
      if (dep && dep.column !== "done") {
        blockers.push({ id: dep.id, title: dep.title, column: dep.column });
      }
    }
    if (blockers.length > 0) {
      return {
        error: `Blocked by unresolved dependencies: ${blockers.map(b => `"${b.title}" (${b.id}, status: ${b.column})`).join(", ")}`,
      };
    }
  }

  // Quality gate: if requiresReview and trying to go straight to done from doing
  if (column === "done" && current.requiresReview && current.column !== "review") {
    return {
      error: "Quality gate: this task requires review before done. Move to 'review' first.",
      requiresReview: true,
    };
  }

  // Build update payload with metrics
  const updates: Partial<Task> = { column };

  // Track startedAt (first time moving to "doing")
  if (column === "doing" && !current.startedAt) {
    updates.startedAt = now();
  }

  // Track completedAt and compute duration
  if (column === "done") {
    updates.completedAt = now();
    if (current.startedAt) {
      updates.durationMs = new Date(updates.completedAt).getTime() - new Date(current.startedAt).getTime();
    }
  }

  // Track failedAt
  if (column === "failed") {
    updates.failedAt = now();
  }

  const updated = await store.updateTask(taskId, updates);
  if (!updated) return { error: "Task not found" };

  // Auto-retry: if moved to "failed" and retries remaining
  let retried = false;
  if (column === "failed") {
    const retryCount = (updated.retryCount || 0);
    const maxRetries = updated.maxRetries ?? 2;
    if (retryCount < maxRetries) {
      const retryUpdates: Partial<Task> = {
        column: "todo",
        retryCount: retryCount + 1,
        failedAt: undefined,
      };
      await store.updateTask(updated.id, retryUpdates);
      await store.addComment(updated.id, {
        author: "system",
        text: `Auto-retry ${retryCount + 1}/${maxRetries}: task moved back to todo after failure.`,
      });
      retried = true;
    } else {
      await store.addComment(updated.id, {
        author: "system",
        text: `Max retries (${maxRetries}) exhausted. Task requires manual intervention.`,
      });
    }
  }

  // Auto-notify dependents: if moved to "done", find tasks that depend on this one
  if (column === "done") {
    const allTasks = store.getTasks({});
    for (const t of allTasks) {
      if (t.dependencies.includes(taskId)) {
        await store.addComment(t.id, {
          author: "system",
          text: `Dependency resolved: "${updated.title}" (${updated.id}) is now done.`,
        });
      }
    }
  }

  // Auto-chain: if moved to "done" and has nextTask, create it
  let spawned: Task | undefined;
  if (column === "done" && updated.nextTask) {
    const nt = updated.nextTask;
    const chainedTask: Task = {
      id: generateId("task"),
      projectId: updated.projectId,
      title: nt.title,
      description: nt.description || `Chained from: ${updated.title} (${updated.id})`,
      status: "todo",
      column: "todo",
      assignee: nt.assignee,
      createdBy: updated.assignee,
      priority: nt.priority || updated.priority,
      tags: nt.tags || updated.tags,
      dependencies: [],
      subtasks: [],
      comments: [{
        author: "system",
        text: `Auto-created from completed task "${updated.title}" (${updated.id})`,
        at: now(),
      }],
      parentTaskId: updated.id,
      createdAt: now(),
      updatedAt: now(),
    };
    spawned = await store.createTask(chainedTask);
  }

  return { task: updated, retried, ...(spawned ? { chainedTask: spawned } : {}) };
}
