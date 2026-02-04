import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import path from "path";
import os from "os";
import {
  setDataDir,
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  addComment,
} from "../src/store";
import { Project, Task } from "../src/types";

let tmpDir: string;

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: `proj_${Math.random().toString(36).slice(2, 10)}`,
    name: "Test Project",
    status: "active",
    owner: "tester",
    description: "A test project",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTask(projectId: string, overrides: Partial<Task> = {}): Task {
  return {
    id: `task_${Math.random().toString(36).slice(2, 10)}`,
    projectId,
    title: "Test Task",
    description: "A test task",
    status: "backlog",
    column: "backlog",
    assignee: "",
    createdBy: "tester",
    priority: "medium",
    tags: [],
    dependencies: [],
    subtasks: [],
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "agent-board-test-"));
  setDataDir(tmpDir);
});

afterAll(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

// --- Projects CRUD ---

describe("Projects CRUD", () => {
  it("creates and retrieves a project", async () => {
    const p = makeProject({ id: "proj_1", name: "Alpha" });
    await createProject(p);
    expect(getProject("proj_1")).toMatchObject({ id: "proj_1", name: "Alpha" });
  });

  it("lists all projects", async () => {
    await createProject(makeProject({ id: "p1" }));
    await createProject(makeProject({ id: "p2" }));
    expect(getProjects()).toHaveLength(2);
  });

  it("filters projects by status", async () => {
    await createProject(makeProject({ id: "p1", status: "active" }));
    await createProject(makeProject({ id: "p2", status: "archived" }));
    expect(getProjects({ status: "active" })).toHaveLength(1);
    expect(getProjects({ status: "archived" })).toHaveLength(1);
  });

  it("filters projects by owner", async () => {
    await createProject(makeProject({ id: "p1", owner: "alice" }));
    await createProject(makeProject({ id: "p2", owner: "bob" }));
    expect(getProjects({ owner: "alice" })).toHaveLength(1);
  });

  it("updates a project", async () => {
    await createProject(makeProject({ id: "p1", name: "Old" }));
    const updated = await updateProject("p1", { name: "New" });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe("New");
    expect(getProject("p1")!.name).toBe("New");
  });

  it("returns undefined when updating non-existent project", async () => {
    expect(await updateProject("nope", { name: "X" })).toBeUndefined();
  });

  it("deletes a project", async () => {
    await createProject(makeProject({ id: "p1" }));
    expect(await deleteProject("p1")).toBe(true);
    expect(getProject("p1")).toBeUndefined();
  });

  it("returns false when deleting non-existent project", async () => {
    expect(await deleteProject("nope")).toBe(false);
  });
});

// --- Tasks CRUD ---

describe("Tasks CRUD", () => {
  it("creates and retrieves a task", async () => {
    const t = makeTask("proj_1", { id: "t1", title: "Do stuff" });
    await createTask(t);
    expect(getTask("t1")).toMatchObject({ id: "t1", title: "Do stuff" });
  });

  it("lists tasks with filters", async () => {
    await createTask(makeTask("p1", { id: "t1", assignee: "alice", status: "todo", column: "todo", tags: ["bug"] }));
    await createTask(makeTask("p1", { id: "t2", assignee: "bob", status: "doing", column: "doing", tags: ["feat"] }));
    await createTask(makeTask("p2", { id: "t3", assignee: "alice", status: "todo", column: "todo", tags: ["bug"] }));

    expect(getTasks({ projectId: "p1" })).toHaveLength(2);
    expect(getTasks({ assignee: "alice" })).toHaveLength(2);
    expect(getTasks({ status: "doing" })).toHaveLength(1);
    expect(getTasks({ tag: "bug" })).toHaveLength(2);
  });

  it("updates a task", async () => {
    await createTask(makeTask("p1", { id: "t1", title: "Old" }));
    const updated = await updateTask("t1", { title: "New" });
    expect(updated!.title).toBe("New");
  });

  it("returns undefined when updating non-existent task", async () => {
    expect(await updateTask("nope", { title: "X" })).toBeUndefined();
  });

  it("deletes a task", async () => {
    await createTask(makeTask("p1", { id: "t1" }));
    expect(await deleteTask("t1")).toBe(true);
    expect(getTask("t1")).toBeUndefined();
  });

  it("returns false when deleting non-existent task", async () => {
    expect(await deleteTask("nope")).toBe(false);
  });
});

// --- Delete cascade ---

describe("Delete cascade", () => {
  it("deleting a project removes its tasks", async () => {
    await createProject(makeProject({ id: "p1" }));
    await createTask(makeTask("p1", { id: "t1" }));
    await createTask(makeTask("p1", { id: "t2" }));
    await createTask(makeTask("other", { id: "t3" }));

    await deleteProject("p1");
    expect(getTasks({ projectId: "p1" })).toHaveLength(0);
    expect(getTasks({ projectId: "other" })).toHaveLength(1);
  });
});

// --- Comments ---

describe("Comments", () => {
  it("adds a comment to a task", async () => {
    await createTask(makeTask("p1", { id: "t1" }));
    const result = await addComment("t1", { author: "alice", text: "Looks good" });
    expect(result).toBeDefined();
    expect(result!.comments).toHaveLength(1);
    expect(result!.comments[0]).toMatchObject({ author: "alice", text: "Looks good" });
    expect(result!.comments[0].at).toBeDefined();
  });

  it("adds multiple comments", async () => {
    await createTask(makeTask("p1", { id: "t1" }));
    await addComment("t1", { author: "alice", text: "First" });
    await addComment("t1", { author: "bob", text: "Second" });
    const task = getTask("t1");
    expect(task!.comments).toHaveLength(2);
  });

  it("returns undefined for non-existent task", async () => {
    expect(await addComment("nope", { author: "a", text: "b" })).toBeUndefined();
  });
});

// --- Move task ---

describe("Move task (column update)", () => {
  it("moves a task to a new column and syncs status", async () => {
    await createTask(makeTask("p1", { id: "t1", column: "backlog", status: "backlog" }));
    const moved = await updateTask("t1", { column: "doing" });
    expect(moved!.column).toBe("doing");
    expect(moved!.status).toBe("doing");
  });

  it("status update also syncs column", async () => {
    await createTask(makeTask("p1", { id: "t1", column: "backlog", status: "backlog" }));
    const moved = await updateTask("t1", { status: "review" });
    expect(moved!.status).toBe("review");
    expect(moved!.column).toBe("review");
  });
});
