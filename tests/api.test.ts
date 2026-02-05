import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import os from "os";
import express from "express";
import request from "supertest";
import { setDataDir } from "../src/store";
import apiRouter, { setTemplatesDir } from "../src/routes";
import { setAuditDataDir } from "../src/audit";

let tmpDir: string;
let tmpTemplatesDir: string;

const app = express();
app.use(express.json());
app.use("/api", apiRouter);

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "agent-board-api-test-"));
  setDataDir(tmpDir);
  setAuditDataDir(tmpDir);
  tmpTemplatesDir = path.join(tmpDir, "templates");
  mkdirSync(tmpTemplatesDir, { recursive: true });
  setTemplatesDir(tmpTemplatesDir);
});

afterAll(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

// --- Health ---

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// --- Projects ---

describe("Projects API", () => {
  it("POST /api/projects creates a project", async () => {
    const res = await request(app)
      .post("/api/projects")
      .send({ name: "Alpha", owner: "alice", description: "desc" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Alpha");
    expect(res.body.id).toMatch(/^proj_/);
  });

  it("POST /api/projects returns 400 without name", async () => {
    const res = await request(app).post("/api/projects").send({});
    expect(res.status).toBe(400);
  });

  it("GET /api/projects lists projects", async () => {
    await request(app).post("/api/projects").send({ name: "A" });
    await request(app).post("/api/projects").send({ name: "B" });
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("GET /api/projects filters by status", async () => {
    const { body: p } = await request(app).post("/api/projects").send({ name: "A" });
    await request(app).patch(`/api/projects/${p.id}`).send({ status: "archived" });
    await request(app).post("/api/projects").send({ name: "B" });

    const res = await request(app).get("/api/projects?status=active");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("B");
  });

  it("GET /api/projects/:id returns project with tasks", async () => {
    const { body: p } = await request(app).post("/api/projects").send({ name: "Alpha" });
    await request(app).post("/api/tasks").send({ projectId: p.id, title: "T1", assignee: "bot" });

    const res = await request(app).get(`/api/projects/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Alpha");
    expect(res.body.tasks).toHaveLength(1);
  });

  it("GET /api/projects/:id returns 404 for missing", async () => {
    const res = await request(app).get("/api/projects/nope");
    expect(res.status).toBe(404);
  });

  it("PATCH /api/projects/:id updates a project", async () => {
    const { body: p } = await request(app).post("/api/projects").send({ name: "Old" });
    const res = await request(app).patch(`/api/projects/${p.id}`).send({ name: "New" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New");
  });

  it("PATCH /api/projects/:id returns 404 for missing", async () => {
    const res = await request(app).patch("/api/projects/nope").send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/projects/:id deletes project and its tasks", async () => {
    const { body: p } = await request(app).post("/api/projects").send({ name: "Alpha" });
    await request(app).post("/api/tasks").send({ projectId: p.id, title: "T1", assignee: "bot" });

    const del = await request(app).delete(`/api/projects/${p.id}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const get = await request(app).get(`/api/projects/${p.id}`);
    expect(get.status).toBe(404);

    const tasks = await request(app).get(`/api/tasks?projectId=${p.id}`);
    expect(tasks.body).toHaveLength(0);
  });

  it("DELETE /api/projects/:id returns 404 for missing", async () => {
    const res = await request(app).delete("/api/projects/nope");
    expect(res.status).toBe(404);
  });
});

// --- Tasks ---

describe("Tasks API", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("POST /api/tasks creates a task", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ projectId, title: "Task A", assignee: "bob", priority: "high", tags: ["bug"] });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^task_/);
    expect(res.body.title).toBe("Task A");
    expect(res.body.column).toBe("backlog");
  });

  it("POST /api/tasks returns 400 without required fields", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "No project" });
    expect(res.status).toBe(400);
  });

  it("GET /api/tasks lists tasks", async () => {
    await request(app).post("/api/tasks").send({ projectId, title: "A", assignee: "bot" });
    await request(app).post("/api/tasks").send({ projectId, title: "B", assignee: "bot" });
    const res = await request(app).get("/api/tasks");
    expect(res.body).toHaveLength(2);
  });

  it("GET /api/tasks filters by projectId", async () => {
    await request(app).post("/api/tasks").send({ projectId, title: "A", assignee: "bot" });
    const res = await request(app).get(`/api/tasks?projectId=${projectId}`);
    expect(res.body).toHaveLength(1);
    const res2 = await request(app).get("/api/tasks?projectId=other");
    expect(res2.body).toHaveLength(0);
  });

  it("GET /api/tasks/:id returns a task", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({ projectId, title: "A", assignee: "bot" });
    const res = await request(app).get(`/api/tasks/${t.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("A");
  });

  it("GET /api/tasks/:id returns 404 for missing", async () => {
    const res = await request(app).get("/api/tasks/nope");
    expect(res.status).toBe(404);
  });

  it("PATCH /api/tasks/:id updates a task", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({ projectId, title: "Old", assignee: "bot" });
    const res = await request(app).patch(`/api/tasks/${t.id}`).send({ title: "New" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("New");
  });

  it("PATCH /api/tasks/:id returns 404 for missing", async () => {
    const res = await request(app).patch("/api/tasks/nope").send({ title: "X" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/tasks/:id deletes a task", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({ projectId, title: "A", assignee: "bot" });
    const del = await request(app).delete(`/api/tasks/${t.id}`);
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
    const get = await request(app).get(`/api/tasks/${t.id}`);
    expect(get.status).toBe(404);
  });

  it("DELETE /api/tasks/:id returns 404 for missing", async () => {
    const res = await request(app).delete("/api/tasks/nope");
    expect(res.status).toBe(404);
  });
});

// --- Comments ---

describe("Comments API", () => {
  it("POST /api/tasks/:id/comments adds a comment", async () => {
    const { body: p } = await request(app).post("/api/projects").send({ name: "P" });
    const { body: t } = await request(app).post("/api/tasks").send({ projectId: p.id, title: "T", assignee: "bot" });

    const res = await request(app)
      .post(`/api/tasks/${t.id}/comments`)
      .send({ author: "alice", text: "Nice" });
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].author).toBe("alice");
  });

  it("POST /api/tasks/:id/comments returns 400 without fields", async () => {
    const { body: p } = await request(app).post("/api/projects").send({ name: "P" });
    const { body: t } = await request(app).post("/api/tasks").send({ projectId: p.id, title: "T", assignee: "bot" });

    const res = await request(app).post(`/api/tasks/${t.id}/comments`).send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/tasks/:id/comments returns 404 for missing task", async () => {
    const res = await request(app)
      .post("/api/tasks/nope/comments")
      .send({ author: "a", text: "b" });
    expect(res.status).toBe(404);
  });
});

// --- Move Task ---

describe("Move Task API", () => {
  it("POST /api/tasks/:id/move moves task to new column", async () => {
    const { body: p } = await request(app).post("/api/projects").send({ name: "P" });
    const { body: t } = await request(app).post("/api/tasks").send({ projectId: p.id, title: "T", assignee: "bot" });

    const res = await request(app)
      .post(`/api/tasks/${t.id}/move`)
      .send({ column: "doing" });
    expect(res.status).toBe(200);
    expect(res.body.task.column).toBe("doing");
    expect(res.body.task.status).toBe("doing");
  });

  it("POST /api/tasks/:id/move returns 400 without column", async () => {
    const { body: p } = await request(app).post("/api/projects").send({ name: "P" });
    const { body: t } = await request(app).post("/api/tasks").send({ projectId: p.id, title: "T", assignee: "bot" });

    const res = await request(app).post(`/api/tasks/${t.id}/move`).send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/tasks/:id/move returns 400 for invalid column", async () => {
    const { body: p } = await request(app).post("/api/projects").send({ name: "P" });
    const { body: t } = await request(app).post("/api/tasks").send({ projectId: p.id, title: "T", assignee: "bot" });

    const res = await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "invalid" });
    expect(res.status).toBe(400);
  });

  it("POST /api/tasks/:id/move returns 404 for missing task", async () => {
    const res = await request(app).post("/api/tasks/nope/move").send({ column: "done" });
    expect(res.status).toBe(404);
  });
});

// --- Agents ---

describe("Agents API", () => {
  it("POST /api/agents registers an agent", async () => {
    const res = await request(app)
      .post("/api/agents")
      .send({ id: "agent-1", name: "Worker", role: "coder", capabilities: ["code"] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("agent-1");
    expect(res.body.status).toBe("online");
  });

  it("POST /api/agents returns 400 without required fields", async () => {
    const res = await request(app).post("/api/agents").send({ name: "X" });
    expect(res.status).toBe(400);
  });

  it("GET /api/agents lists agents", async () => {
    await request(app).post("/api/agents").send({ id: "a1", name: "A" });
    await request(app).post("/api/agents").send({ id: "a2", name: "B" });
    const res = await request(app).get("/api/agents");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// --- inputPath / outputPath ---

describe("Task inputPath/outputPath", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("POST /api/tasks accepts inputPath and outputPath", async () => {
    const res = await request(app).post("/api/tasks").send({
      projectId,
      title: "With paths",
      assignee: "bob",
      inputPath: "projects/curecenter/audit/",
      outputPath: "projects/curecenter/content/page-aquabike.md",
    });
    expect(res.status).toBe(201);
    expect(res.body.inputPath).toBe("projects/curecenter/audit/");
    expect(res.body.outputPath).toBe("projects/curecenter/content/page-aquabike.md");
  });

  it("POST /api/tasks works without paths (undefined)", async () => {
    const res = await request(app).post("/api/tasks").send({
      projectId,
      title: "No paths",
      assignee: "bob",
    });
    expect(res.status).toBe(201);
    expect(res.body.inputPath).toBeUndefined();
    expect(res.body.outputPath).toBeUndefined();
  });

  it("PATCH /api/tasks/:id updates inputPath/outputPath", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "T",
      assignee: "bob",
    });
    const res = await request(app).patch(`/api/tasks/${t.id}`).send({
      inputPath: "new/input/",
      outputPath: "new/output.md",
    });
    expect(res.status).toBe(200);
    expect(res.body.inputPath).toBe("new/input/");
    expect(res.body.outputPath).toBe("new/output.md");
  });

  it("GET /api/tasks/:id returns inputPath/outputPath", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "T",
      assignee: "bob",
      inputPath: "in/",
      outputPath: "out.md",
    });
    const res = await request(app).get(`/api/tasks/${t.id}`);
    expect(res.body.inputPath).toBe("in/");
    expect(res.body.outputPath).toBe("out.md");
  });
});

// --- Project Templates ---

describe("Project Templates", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P", owner: "alice" });
    projectId = body.id;
  });

  it("GET /api/templates lists available templates", async () => {
    writeFileSync(path.join(tmpTemplatesDir, "seo-audit.json"), JSON.stringify([
      { title: "Crawl", assignee: "bot" },
    ]));
    const res = await request(app).get("/api/templates");
    expect(res.status).toBe(200);
    expect(res.body).toContain("seo-audit");
  });

  it("POST /api/projects/:id/from-template creates tasks from named template", async () => {
    writeFileSync(path.join(tmpTemplatesDir, "test-tpl.json"), JSON.stringify([
      { title: "Step 1", assignee: "agent-a", priority: "high", tags: ["seo"], inputPath: "in/", outputPath: "out.md" },
      { title: "Step 2", assignee: "agent-b" },
    ]));

    const res = await request(app)
      .post(`/api/projects/${projectId}/from-template`)
      .send({ template: "test-tpl" });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(2);
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.tasks[0].title).toBe("Step 1");
    expect(res.body.tasks[0].projectId).toBe(projectId);
    expect(res.body.tasks[0].inputPath).toBe("in/");
    expect(res.body.tasks[0].outputPath).toBe("out.md");
    expect(res.body.tasks[0].priority).toBe("high");
    expect(res.body.tasks[1].assignee).toBe("agent-b");
  });

  it("POST /api/projects/:id/from-template creates tasks from inline array", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/from-template`)
      .send({
        tasks: [
          { title: "Inline 1", assignee: "x" },
          { title: "Inline 2", assignee: "y", inputPath: "data/" },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(2);
    expect(res.body.tasks[1].inputPath).toBe("data/");
  });

  it("POST /api/projects/:id/from-template returns 404 for unknown template", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/from-template`)
      .send({ template: "nonexistent" });
    expect(res.status).toBe(404);
  });

  it("POST /api/projects/:id/from-template returns 404 for unknown project", async () => {
    const res = await request(app)
      .post("/api/projects/nope/from-template")
      .send({ tasks: [{ title: "X", assignee: "a" }] });
    expect(res.status).toBe(404);
  });

  it("POST /api/projects/:id/from-template returns 400 without template or tasks", async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/from-template`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("tasks created via template appear in GET /api/tasks", async () => {
    writeFileSync(path.join(tmpTemplatesDir, "mini.json"), JSON.stringify([
      { title: "Only Task", assignee: "bot" },
    ]));
    await request(app)
      .post(`/api/projects/${projectId}/from-template`)
      .send({ template: "mini" });

    const res = await request(app).get(`/api/tasks?projectId=${projectId}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Only Task");
    expect(res.body[0].createdBy).toBe("template");
  });
});

// ============================================================
// PHASE 2: LIFECYCLE TESTS
// ============================================================

describe("Auto-retry lifecycle", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("moves task to failed, auto-retries back to todo with retryCount incremented", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Retryable",
      assignee: "bot",
      maxRetries: 2,
      column: "doing",
    });

    // Move to failed — should auto-retry
    const res = await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "failed" });
    expect(res.status).toBe(200);
    expect(res.body.retried).toBe(true);

    // Verify task is back in todo with retryCount = 1
    const get = await request(app).get(`/api/tasks/${t.id}`);
    expect(get.body.column).toBe("todo");
    expect(get.body.status).toBe("todo");
    expect(get.body.retryCount).toBe(1);

    // Verify system comment was added
    expect(get.body.comments.length).toBeGreaterThanOrEqual(1);
    const retryComment = get.body.comments.find((c: any) => c.author === "system" && c.text.includes("Auto-retry"));
    expect(retryComment).toBeDefined();
  });
});

describe("Max retry exhaustion", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("task stays failed after maxRetries exhausted and alert comment is created", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Doomed",
      assignee: "bot",
      maxRetries: 2,
      column: "doing",
    });

    // First failure → auto-retry (retryCount 0 -> 1)
    await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "failed" });
    // Move back to doing for next attempt
    await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "doing" });

    // Second failure → auto-retry (retryCount 1 -> 2)
    await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "failed" });
    // Move back to doing for next attempt
    await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "doing" });

    // Third failure → max retries exhausted (retryCount = 2 === maxRetries = 2)
    const res = await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "failed" });
    expect(res.status).toBe(200);
    expect(res.body.retried).toBe(false);

    // Verify task stays failed
    const get = await request(app).get(`/api/tasks/${t.id}`);
    expect(get.body.column).toBe("failed");
    expect(get.body.status).toBe("failed");
    expect(get.body.retryCount).toBe(2);

    // Verify exhaustion comment
    const exhaustionComment = get.body.comments.find((c: any) =>
      c.author === "system" && c.text.includes("Max retries")
    );
    expect(exhaustionComment).toBeDefined();
  });
});

describe("Task chaining", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("creates chained task in todo when parent task moves to done", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Parent Task",
      assignee: "bot",
      column: "doing",
      nextTask: {
        title: "Child Task",
        assignee: "bot2",
        priority: "high",
        tags: ["follow-up"],
      },
    });

    // Move to done → should trigger chain
    const res = await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "done" });
    expect(res.status).toBe(200);
    expect(res.body.chainedTask).toBeDefined();
    expect(res.body.chainedTask.title).toBe("Child Task");
    expect(res.body.chainedTask.assignee).toBe("bot2");
    expect(res.body.chainedTask.column).toBe("todo");
    expect(res.body.chainedTask.parentTaskId).toBe(t.id);
    expect(res.body.chainedTask.priority).toBe("high");
    expect(res.body.chainedTask.tags).toContain("follow-up");

    // Verify chained task exists in the task list
    const tasks = await request(app).get(`/api/tasks?projectId=${projectId}`);
    const chained = tasks.body.find((task: any) => task.title === "Child Task");
    expect(chained).toBeDefined();
    expect(chained.column).toBe("todo");
    expect(chained.parentTaskId).toBe(t.id);
  });
});

describe("Quality gates", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("blocks direct doing→done when requiresReview is true", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Needs Review",
      assignee: "bot",
      column: "doing",
      requiresReview: true,
    });

    // Try to move directly to done → should be blocked
    const res = await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "done" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("review");
    expect(res.body.requiresReview).toBe(true);

    // Verify task is still in doing
    const get = await request(app).get(`/api/tasks/${t.id}`);
    expect(get.body.column).toBe("doing");
  });

  it("allows done when task goes through review first", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Needs Review",
      assignee: "bot",
      column: "doing",
      requiresReview: true,
    });

    // Move to review first
    await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "review" });

    // Now move to done → should work
    const res = await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "done" });
    expect(res.status).toBe(200);
    expect(res.body.task.column).toBe("done");
  });
});

describe("Duration calculation", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("calculates durationMs when moving from doing to done", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Timed Task",
      assignee: "bot",
      column: "backlog",
    });

    // Move to doing — sets startedAt
    const doingRes = await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "doing" });
    expect(doingRes.body.task.startedAt).toBeDefined();

    // Move to done — sets completedAt and computes durationMs
    const doneRes = await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "done" });
    expect(doneRes.body.task.completedAt).toBeDefined();
    expect(doneRes.body.task.durationMs).toBeDefined();
    expect(typeof doneRes.body.task.durationMs).toBe("number");
    expect(doneRes.body.task.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("sets startedAt only on first move to doing", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Task",
      assignee: "bot",
    });

    // Move to doing — sets startedAt
    const res1 = await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "doing" });
    const firstStartedAt = res1.body.task.startedAt;
    expect(firstStartedAt).toBeDefined();

    // Move away and back to doing — startedAt should not change
    await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "review" });
    const res2 = await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "doing" });
    expect(res2.body.task.startedAt).toBe(firstStartedAt);
  });
});

describe("Template creation with chaining", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P", owner: "alice" });
    projectId = body.id;
  });

  it("resolves nextTask refs in template tasks", async () => {
    writeFileSync(path.join(tmpTemplatesDir, "chain-tpl.json"), JSON.stringify([
      {
        ref: "step1",
        title: "Step 1",
        assignee: "agent-a",
        nextTask: { ref: "step2" },
      },
      {
        ref: "step2",
        title: "Step 2",
        assignee: "agent-b",
        priority: "high",
        tags: ["final"],
      },
    ]));

    const res = await request(app)
      .post(`/api/projects/${projectId}/from-template`)
      .send({ template: "chain-tpl" });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(2);

    // Verify nextTask ref was resolved on step1
    const tasks = await request(app).get(`/api/tasks?projectId=${projectId}`);
    const step1 = tasks.body.find((t: any) => t.title === "Step 1");
    expect(step1).toBeDefined();
    expect(step1.nextTask).toBeDefined();
    expect(step1.nextTask.title).toBe("Step 2");
    expect(step1.nextTask.assignee).toBe("agent-b");
    expect(step1.nextTask.priority).toBe("high");
    expect(step1.nextTask.tags).toContain("final");
  });
});

// ============================================================
// PHASE 2: API KEY AUTH TESTS
// ============================================================

describe("API Key Authentication", () => {
  it("allows requests when AGENTBOARD_API_KEYS is not set (backward compatible)", async () => {
    // Keys are not set in test env, so all requests should pass
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });
});

// ============================================================
// PHASE 2: ZOD VALIDATION TESTS
// ============================================================

describe("Zod Validation", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("rejects task creation with invalid priority", async () => {
    const res = await request(app).post("/api/tasks").send({
      projectId,
      title: "Bad",
      assignee: "bot",
      priority: "super-urgent",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details).toBeDefined();
  });

  it("rejects task move with invalid column", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "T",
      assignee: "bot",
    });
    const res = await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "invalid" });
    expect(res.status).toBe(400);
  });

  it("rejects empty comment fields", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "T",
      assignee: "bot",
    });
    const res = await request(app).post(`/api/tasks/${t.id}/comments`).send({ author: "", text: "" });
    expect(res.status).toBe(400);
  });
});

// ============================================================
// PHASE 2: AUDIT TRAIL TESTS
// ============================================================

describe("Audit Trail", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("GET /api/audit returns audit entries", async () => {
    // Create a task to generate audit entry
    await request(app).post("/api/tasks").send({
      projectId,
      title: "Audited Task",
      assignee: "bot",
    });

    const res = await request(app).get("/api/audit");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Should have at least the project.create and task.create entries
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /api/audit filters by taskId", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Specific",
      assignee: "bot",
    });

    const res = await request(app).get(`/api/audit?taskId=${t.id}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.every((e: any) => e.taskId === t.id)).toBe(true);
  });

  it("GET /api/audit supports limit parameter", async () => {
    // Create multiple tasks
    await request(app).post("/api/tasks").send({ projectId, title: "T1", assignee: "bot" });
    await request(app).post("/api/tasks").send({ projectId, title: "T2", assignee: "bot" });
    await request(app).post("/api/tasks").send({ projectId, title: "T3", assignee: "bot" });

    const res = await request(app).get("/api/audit?limit=2");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("records task.move audit entries", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Moving",
      assignee: "bot",
    });

    await request(app).post(`/api/tasks/${t.id}/move`).send({ column: "doing" });

    const res = await request(app).get(`/api/audit?taskId=${t.id}`);
    const moveEntry = res.body.find((e: any) => e.action === "task.move");
    expect(moveEntry).toBeDefined();
    expect(moveEntry.to).toBe("doing");
  });

  it("records comment.add audit entries", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Commented",
      assignee: "bot",
    });

    await request(app).post(`/api/tasks/${t.id}/comments`).send({ author: "alice", text: "Hello" });

    const res = await request(app).get(`/api/audit?taskId=${t.id}`);
    const commentEntry = res.body.find((e: any) => e.action === "comment.add");
    expect(commentEntry).toBeDefined();
  });
});

// ============================================================
// PHASE 2: AUTO-BACKUP TESTS
// ============================================================

describe("Auto-backup", () => {
  it("creates backup files in data/backups/ on writes", async () => {
    const { body: p } = await request(app).post("/api/projects").send({ name: "Backup Test" });
    await request(app).post("/api/tasks").send({ projectId: p.id, title: "T", assignee: "bot" });

    const backupDir = path.join(tmpDir, "backups");
    expect(existsSync(backupDir)).toBe(true);

    const backups = readdirSync(backupDir);
    expect(backups.length).toBeGreaterThan(0);
    // Should have both projects and tasks backups
    const projectBackups = backups.filter(f => f.startsWith("projects-"));
    const taskBackups = backups.filter(f => f.startsWith("tasks-"));
    expect(projectBackups.length).toBeGreaterThan(0);
    expect(taskBackups.length).toBeGreaterThan(0);
  });
});

// ============================================================
// PHASE 3: TASK DEPENDENCIES (DAG)
// ============================================================

describe("Task Dependencies", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("task with unresolved dependencies cannot move to doing", async () => {
    // Create dependency task (stays in backlog)
    const { body: dep } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Dependency Task",
      assignee: "bot",
      column: "backlog",
    });

    // Create dependent task with dependency
    const { body: task } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Dependent Task",
      assignee: "bot",
      column: "todo",
      dependencies: [dep.id],
    });

    // Try to move dependent to doing — should be blocked
    const res = await request(app).post(`/api/tasks/${task.id}/move`).send({ column: "doing" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Blocked by unresolved dependencies");
    expect(res.body.error).toContain(dep.id);

    // Verify task is still in todo
    const get = await request(app).get(`/api/tasks/${task.id}`);
    expect(get.body.column).toBe("todo");
  });

  it("task with resolved dependencies can move to doing", async () => {
    // Create dependency task
    const { body: dep } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Dep",
      assignee: "bot",
      column: "doing",
    });

    // Move dep to done
    await request(app).post(`/api/tasks/${dep.id}/move`).send({ column: "done" });

    // Create dependent with resolved dep
    const { body: task } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Dependent",
      assignee: "bot",
      column: "todo",
      dependencies: [dep.id],
    });

    // Should succeed
    const res = await request(app).post(`/api/tasks/${task.id}/move`).send({ column: "doing" });
    expect(res.status).toBe(200);
    expect(res.body.task.column).toBe("doing");
  });

  it("dependency resolution adds comment to dependent tasks", async () => {
    // Create dependency task
    const { body: dep } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Dep Task",
      assignee: "bot",
      column: "doing",
    });

    // Create dependent task
    const { body: dependent } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Waiting Task",
      assignee: "bot2",
      column: "todo",
      dependencies: [dep.id],
    });

    // Move dependency to done
    await request(app).post(`/api/tasks/${dep.id}/move`).send({ column: "done" });

    // Check dependent has the resolution comment
    const get = await request(app).get(`/api/tasks/${dependent.id}`);
    const resolutionComment = get.body.comments.find(
      (c: any) => c.author === "system" && c.text.includes("Dependency resolved")
    );
    expect(resolutionComment).toBeDefined();
    expect(resolutionComment.text).toContain(dep.id);
  });

  it("GET /api/tasks/:id/dependencies returns deps and blockers", async () => {
    const { body: dep1 } = await request(app).post("/api/tasks").send({
      projectId, title: "Dep Done", assignee: "bot", column: "doing",
    });
    await request(app).post(`/api/tasks/${dep1.id}/move`).send({ column: "done" });

    const { body: dep2 } = await request(app).post("/api/tasks").send({
      projectId, title: "Dep Pending", assignee: "bot", column: "todo",
    });

    const { body: task } = await request(app).post("/api/tasks").send({
      projectId, title: "Main", assignee: "bot",
      dependencies: [dep1.id, dep2.id],
    });

    const res = await request(app).get(`/api/tasks/${task.id}/dependencies`);
    expect(res.status).toBe(200);
    expect(res.body.dependencies).toHaveLength(2);
    expect(res.body.blockedBy).toHaveLength(1);
    expect(res.body.blockedBy[0].id).toBe(dep2.id);
  });

  it("GET /api/tasks/:id/dependents returns tasks that depend on this task", async () => {
    const { body: dep } = await request(app).post("/api/tasks").send({
      projectId, title: "Parent Dep", assignee: "bot",
    });

    await request(app).post("/api/tasks").send({
      projectId, title: "Child 1", assignee: "bot", dependencies: [dep.id],
    });
    await request(app).post("/api/tasks").send({
      projectId, title: "Child 2", assignee: "bot", dependencies: [dep.id],
    });

    const res = await request(app).get(`/api/tasks/${dep.id}/dependents`);
    expect(res.status).toBe(200);
    expect(res.body.dependents).toHaveLength(2);
  });

  it("GET /api/tasks/:id/dependencies returns 404 for missing task", async () => {
    const res = await request(app).get("/api/tasks/nope/dependencies");
    expect(res.status).toBe(404);
  });

  it("GET /api/tasks/:id/dependents returns 404 for missing task", async () => {
    const res = await request(app).get("/api/tasks/nope/dependents");
    expect(res.status).toBe(404);
  });
});

// ============================================================
// PHASE 3: CLIENT VIEW
// ============================================================

describe("Client View", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({
      name: "Client Project",
      owner: "alice",
      clientViewEnabled: true,
    });
    projectId = body.id;
  });

  it("GET /api/client/:projectId returns filtered data for enabled project", async () => {
    // Create tasks with internal data
    await request(app).post("/api/tasks").send({
      projectId,
      title: "Task A",
      assignee: "secret-agent-bot",
      column: "doing",
    });
    await request(app).post("/api/tasks").send({
      projectId,
      title: "Task B",
      assignee: "internal-bot",
      column: "done",
    });

    const res = await request(app).get(`/api/client/${projectId}`);
    expect(res.status).toBe(200);

    // Project info is filtered
    expect(res.body.project.name).toBe("Client Project");
    expect(res.body.project.owner).toBeUndefined();

    // Progress
    expect(res.body.progress.total).toBe(2);
    expect(res.body.progress.done).toBe(1);
    expect(res.body.progress.percentage).toBe(50);

    // Tasks are present
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.lastUpdated).toBeDefined();
  });

  it("client view hides internal fields (assignee details, comments)", async () => {
    const { body: task } = await request(app).post("/api/tasks").send({
      projectId,
      title: "Secret Task",
      assignee: "secret-agent-007",
      column: "todo",
    });

    // Add a comment
    await request(app).post(`/api/tasks/${task.id}/comments`).send({
      author: "internal-reviewer",
      text: "This is an internal comment",
    });

    const res = await request(app).get(`/api/client/${projectId}`);
    expect(res.status).toBe(200);

    const clientTask = res.body.tasks[0];
    // Should NOT have raw assignee
    expect(clientTask.assignee).toBeUndefined();
    // Should have sanitized team member
    expect(clientTask.teamMember).toBe("Team Member");
    // Should NOT have comments
    expect(clientTask.comments).toBeUndefined();
    // Should NOT have internal fields
    expect(clientTask.createdBy).toBeUndefined();
    expect(clientTask.dependencies).toBeUndefined();
    expect(clientTask.subtasks).toBeUndefined();
  });

  it("returns 403 when clientViewEnabled is false", async () => {
    const { body: proj } = await request(app).post("/api/projects").send({
      name: "Private Project",
    });

    const res = await request(app).get(`/api/client/${proj.id}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("not enabled");
  });

  it("returns 404 for non-existent project", async () => {
    const res = await request(app).get("/api/client/nonexistent");
    expect(res.status).toBe(404);
  });

  it("clientViewEnabled can be toggled via PATCH", async () => {
    // Disable it
    await request(app).patch(`/api/projects/${projectId}`).send({ clientViewEnabled: false });

    const res = await request(app).get(`/api/client/${projectId}`);
    expect(res.status).toBe(403);

    // Re-enable it
    await request(app).patch(`/api/projects/${projectId}`).send({ clientViewEnabled: true });

    const res2 = await request(app).get(`/api/client/${projectId}`);
    expect(res2.status).toBe(200);
  });
});

// ============================================================
// REAL-TIME STEP 1: GET Comments Endpoint
// ============================================================

describe("GET Comments Endpoint", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("GET /api/tasks/:id/comments returns empty array for task with no comments", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId, title: "T", assignee: "bot",
    });
    const res = await request(app).get(`/api/tasks/${t.id}/comments`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /api/tasks/:id/comments returns comments array", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId, title: "T", assignee: "bot",
    });
    await request(app).post(`/api/tasks/${t.id}/comments`).send({ author: "alice", text: "First" });
    await request(app).post(`/api/tasks/${t.id}/comments`).send({ author: "bob", text: "Second" });

    const res = await request(app).get(`/api/tasks/${t.id}/comments`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].author).toBe("alice");
    expect(res.body[0].text).toBe("First");
    expect(res.body[0].at).toBeDefined();
    expect(res.body[1].author).toBe("bob");
    expect(res.body[1].text).toBe("Second");
  });

  it("GET /api/tasks/:id/comments returns 404 for missing task", async () => {
    const res = await request(app).get("/api/tasks/nope/comments");
    expect(res.status).toBe(404);
  });
});

// ============================================================
// REAL-TIME STEP 1: Assignee Change Webhook
// ============================================================

describe("Assignee Change Webhook", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("PATCH /api/tasks/:id with assignee change updates the task", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId, title: "T", assignee: "agent-a",
    });

    const res = await request(app).patch(`/api/tasks/${t.id}`).send({ assignee: "agent-b" });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe("agent-b");
  });

  it("PATCH /api/tasks/:id without assignee change does not trigger reassign", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId, title: "T", assignee: "agent-a",
    });

    // Update title only — same assignee, no webhook should fire
    const res = await request(app).patch(`/api/tasks/${t.id}`).send({ title: "Updated Title" });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe("agent-a");
    expect(res.body.title).toBe("Updated Title");
  });
});

// ============================================================
// REAL-TIME STEP 1: MCP Comment Tools (via store directly)
// ============================================================

describe("MCP Comment Tools (store-level)", () => {
  let projectId: string;

  beforeEach(async () => {
    const { body } = await request(app).post("/api/projects").send({ name: "P" });
    projectId = body.id;
  });

  it("list_comments returns comments for a task via GET endpoint", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId, title: "T", assignee: "bot",
    });
    await request(app).post(`/api/tasks/${t.id}/comments`).send({ author: "agent-x", text: "MCP test" });

    const res = await request(app).get(`/api/tasks/${t.id}/comments`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].author).toBe("agent-x");
    expect(res.body[0].text).toBe("MCP test");
  });

  it("add_comment via POST and retrieve via GET", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId, title: "T", assignee: "bot",
    });

    // Add comment
    const postRes = await request(app).post(`/api/tasks/${t.id}/comments`).send({
      author: "mcp-agent", text: "Hello from MCP",
    });
    expect(postRes.status).toBe(200);

    // Get comments
    const getRes = await request(app).get(`/api/tasks/${t.id}/comments`);
    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].text).toBe("Hello from MCP");
  });

  it("get_task_thread equivalent: task + comments via GET task", async () => {
    const { body: t } = await request(app).post("/api/tasks").send({
      projectId, title: "Thread Task", assignee: "bot", priority: "high", tags: ["test"],
    });
    await request(app).post(`/api/tasks/${t.id}/comments`).send({ author: "a", text: "Comment 1" });
    await request(app).post(`/api/tasks/${t.id}/comments`).send({ author: "b", text: "Comment 2" });

    // GET task returns full task with comments (like get_task_thread)
    const res = await request(app).get(`/api/tasks/${t.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Thread Task");
    expect(res.body.priority).toBe("high");
    expect(res.body.tags).toContain("test");
    expect(res.body.comments).toHaveLength(2);
    expect(res.body.comments[0].text).toBe("Comment 1");
    expect(res.body.comments[1].text).toBe("Comment 2");
  });
});
