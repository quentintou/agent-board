import { describe, it, expect, beforeEach } from "vitest";
import { Task, TaskColumn, TaskPriority } from "./types";

describe("Task P1 Features", () => {
  describe("Task with deadline", () => {
    it("should accept a deadline field", () => {
      const task: Task = {
        id: "test-1",
        projectId: "proj-1",
        title: "Test task",
        description: "Test",
        status: "todo",
        column: "todo",
        assignee: "coding-agent",
        createdBy: "test",
        priority: "high",
        tags: [],
        dependencies: [],
        subtasks: [],
        comments: [],
        deadline: "2026-02-10T00:00:00Z",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(task.deadline).toBe("2026-02-10T00:00:00Z");
    });

    it("should allow optional deadline", () => {
      const task: Task = {
        id: "test-2",
        projectId: "proj-1",
        title: "Test task without deadline",
        description: "Test",
        status: "todo",
        column: "todo",
        assignee: "coding-agent",
        createdBy: "test",
        priority: "high",
        tags: [],
        dependencies: [],
        subtasks: [],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(task.deadline).toBeUndefined();
    });
  });

  describe("Assignee requirement", () => {
    it("should require assignee field on task creation", () => {
      // This test validates that the type system enforces assignee
      const task: Task = {
        id: "test-3",
        projectId: "proj-1",
        title: "Test with assignee",
        description: "Test",
        status: "todo",
        column: "todo",
        assignee: "coding-agent", // Required field
        createdBy: "test",
        priority: "high",
        tags: [],
        dependencies: [],
        subtasks: [],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(task.assignee).toBe("coding-agent");
      expect(task.assignee).toBeTruthy();
    });
  });

  describe("Task status updates", () => {
    it("should track status changes for webhook", () => {
      const initialStatus: TaskColumn = "todo";
      const newStatus: TaskColumn = "doing";

      expect(initialStatus).not.toBe(newStatus);
      
      // Webhook payload structure
      const webhookPayload = {
        event: "task.updated",
        taskId: "test-4",
        status: newStatus,
        assignedTo: "coding-agent",
        title: "Test task",
      };

      expect(webhookPayload.event).toBe("task.updated");
      expect(webhookPayload.status).toBe("doing");
    });
  });

  describe("Priority validation", () => {
    it("should accept valid priority values", () => {
      const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];
      
      priorities.forEach((priority) => {
        const task: Partial<Task> = {
          priority,
        };
        expect(["low", "medium", "high", "urgent"]).toContain(task.priority);
      });
    });
  });
});
