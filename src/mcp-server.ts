#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as store from "./store";
import { generateId, now } from "./utils";
import { Task, TaskColumn } from "./types";
import { moveTask } from "./services";
import { appendAuditLog } from "./audit";

const server = new McpServer({
  name: "agent-board",
  version: "0.1.0",
});

// --- Tools ---

server.tool(
  "board_list_projects",
  "List all projects with optional filters",
  { status: z.string().optional(), owner: z.string().optional() },
  async (args) => ({
    content: [{ type: "text" as const, text: JSON.stringify(store.getProjects(args), null, 2) }],
  })
);

server.tool(
  "board_get_project",
  "Get project details with its tasks",
  { id: z.string() },
  async ({ id }) => {
    const project = store.getProject(id);
    if (!project) return { content: [{ type: "text" as const, text: "Project not found" }], isError: true };
    const tasks = store.getTasks({ projectId: id });
    return { content: [{ type: "text" as const, text: JSON.stringify({ ...project, tasks }, null, 2) }] };
  }
);

server.tool(
  "board_create_project",
  "Create a new project",
  { name: z.string(), owner: z.string().optional(), description: z.string().optional() },
  async ({ name, owner, description }) => {
    const project = await store.createProject({
      id: generateId("proj"),
      name,
      status: "active",
      owner: owner || "unknown",
      description: description || "",
      createdAt: now(),
      updatedAt: now(),
    });
    appendAuditLog({
      timestamp: now(),
      agentId: "mcp",
      action: "project.create",
      projectId: project.id,
      details: `[MCP] Created project "${project.name}"`,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }] };
  }
);

server.tool(
  "board_update_project",
  "Update project fields",
  { id: z.string(), name: z.string().optional(), status: z.enum(["active", "archived"]).optional(), owner: z.string().optional(), description: z.string().optional() },
  async ({ id, ...updates }) => {
    const project = await store.updateProject(id, updates);
    if (!project) return { content: [{ type: "text" as const, text: "Project not found" }], isError: true };
    appendAuditLog({
      timestamp: now(),
      agentId: "mcp",
      action: "project.update",
      projectId: id,
      details: `[MCP] Updated project fields: ${Object.keys(updates).join(", ")}`,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }] };
  }
);

server.tool(
  "board_create_task",
  "Create a new task in a project",
  {
    projectId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    assignee: z.string().optional(),
    createdBy: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    tags: z.array(z.string()).optional(),
    column: z.enum(["backlog", "todo", "doing", "review", "done", "failed"]).optional(),
  },
  async ({ projectId, title, description, assignee, createdBy, priority, tags, column }) => {
    const col: TaskColumn = column || "backlog";
    const task: Task = {
      id: generateId("task"),
      projectId,
      title,
      description: description || "",
      status: col,
      column: col,
      assignee: assignee || "",
      createdBy: createdBy || "unknown",
      priority: priority || "medium",
      tags: tags || [],
      dependencies: [],
      subtasks: [],
      comments: [],
      createdAt: now(),
      updatedAt: now(),
    };
    const created = await store.createTask(task);
    appendAuditLog({
      timestamp: now(),
      agentId: "mcp",
      action: "task.create",
      taskId: created.id,
      projectId: created.projectId,
      details: `[MCP] Created task "${created.title}"`,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(created, null, 2) }] };
  }
);

server.tool(
  "board_update_task",
  "Update task fields (status, assignee, priority, etc.)",
  {
    id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    assignee: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    tags: z.array(z.string()).optional(),
    column: z.enum(["backlog", "todo", "doing", "review", "done", "failed"]).optional(),
  },
  async ({ id, ...updates }) => {
    const task = await store.updateTask(id, updates);
    if (!task) return { content: [{ type: "text" as const, text: "Task not found" }], isError: true };
    appendAuditLog({
      timestamp: now(),
      agentId: "mcp",
      action: "task.update",
      taskId: task.id,
      projectId: task.projectId,
      details: `[MCP] Updated task fields: ${Object.keys(updates).join(", ")}`,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
  }
);

server.tool(
  "board_move_task",
  "Move a task to a different column (backlog, todo, doing, review, done, failed)",
  { id: z.string(), column: z.enum(["backlog", "todo", "doing", "review", "done", "failed"]) },
  async ({ id, column }) => {
    const taskBefore = store.getTask(id);
    const result = await moveTask(id, column);
    if ("error" in result && !("task" in result)) {
      return { content: [{ type: "text" as const, text: result.error }], isError: true };
    }
    const moveResult = result as { task: Task; retried: boolean; chainedTask?: Task };
    appendAuditLog({
      timestamp: now(),
      agentId: "mcp",
      action: "task.move",
      taskId: moveResult.task.id,
      projectId: moveResult.task.projectId,
      from: taskBefore?.column,
      to: column,
      details: `[MCP] Moved task from ${taskBefore?.column} to ${column}`,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "board_add_comment",
  "Add a comment to a task",
  { taskId: z.string(), author: z.string(), text: z.string() },
  async ({ taskId, author, text }) => {
    const task = await store.addComment(taskId, { author, text });
    if (!task) return { content: [{ type: "text" as const, text: "Task not found" }], isError: true };
    appendAuditLog({
      timestamp: now(),
      agentId: "mcp",
      action: "comment.add",
      taskId: task.id,
      projectId: task.projectId,
      details: `[MCP] Comment by ${author}: ${text.slice(0, 100)}`,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
  }
);

server.tool(
  "board_list_comments",
  "List all comments for a task",
  { taskId: z.string() },
  async ({ taskId }) => {
    const task = store.getTask(taskId);
    if (!task) return { content: [{ type: "text" as const, text: "Task not found" }], isError: true };
    return { content: [{ type: "text" as const, text: JSON.stringify(task.comments, null, 2) }] };
  }
);

server.tool(
  "board_get_task_thread",
  "Get task summary with all comments (for agent context)",
  { taskId: z.string() },
  async ({ taskId }) => {
    const task = store.getTask(taskId);
    if (!task) return { content: [{ type: "text" as const, text: "Task not found" }], isError: true };
    const thread = {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.column,
      assignee: task.assignee,
      priority: task.priority,
      tags: task.tags,
      comments: task.comments,
    };
    return { content: [{ type: "text" as const, text: JSON.stringify(thread, null, 2) }] };
  }
);

server.tool(
  "board_list_tasks",
  "List tasks with optional filters",
  {
    projectId: z.string().optional(),
    assignee: z.string().optional(),
    status: z.string().optional(),
    tag: z.string().optional(),
  },
  async (args) => ({
    content: [{ type: "text" as const, text: JSON.stringify(store.getTasks(args), null, 2) }],
  })
);

server.tool(
  "board_my_tasks",
  "List tasks assigned to a specific agent",
  { agentId: z.string() },
  async ({ agentId }) => ({
    content: [{ type: "text" as const, text: JSON.stringify(store.getTasks({ assignee: agentId }), null, 2) }],
  })
);

server.tool(
  "board_delete_task",
  "Delete a task by ID",
  { id: z.string() },
  async ({ id }) => {
    const task = store.getTask(id);
    const deleted = await store.deleteTask(id);
    if (!deleted) return { content: [{ type: "text" as const, text: "Task not found" }], isError: true };
    appendAuditLog({
      timestamp: now(),
      agentId: "mcp",
      action: "task.delete",
      taskId: id,
      projectId: task?.projectId,
      details: `[MCP] Deleted task "${task?.title || id}"`,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, deletedId: id }) }] };
  }
);

server.tool(
  "board_delete_project",
  "Delete a project and all its tasks",
  { id: z.string() },
  async ({ id }) => {
    const project = store.getProject(id);
    const deleted = await store.deleteProject(id);
    if (!deleted) return { content: [{ type: "text" as const, text: "Project not found" }], isError: true };
    appendAuditLog({
      timestamp: now(),
      agentId: "mcp",
      action: "project.delete",
      projectId: id,
      details: `[MCP] Deleted project "${project?.name || id}"`,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, deletedId: id }) }] };
  }
);

// --- Start ---

async function main() {
  // Parse --data flag
  const dataIdx = process.argv.indexOf("--data");
  if (dataIdx !== -1 && process.argv[dataIdx + 1]) {
    store.setDataDir(process.argv[dataIdx + 1]);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
