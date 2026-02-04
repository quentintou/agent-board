import { z } from "zod";

const TaskColumnSchema = z.enum(["backlog", "todo", "doing", "review", "done", "failed"]);
const TaskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const NextTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  assignee: z.string(),
  priority: TaskPrioritySchema.optional(),
  tags: z.array(z.string()).optional(),
  ref: z.string().optional(),
});

export const CreateTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  assignee: z.string().min(1),
  createdBy: z.string().optional(),
  priority: TaskPrioritySchema.optional(),
  tags: z.array(z.string()).optional(),
  column: TaskColumnSchema.optional(),
  nextTask: NextTaskSchema.optional(),
  parentTaskId: z.string().optional(),
  requiresReview: z.boolean().optional(),
  maxRetries: z.number().int().min(0).optional(),
  deadline: z.string().optional(),
  inputPath: z.string().optional(),
  outputPath: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assignee: z.string().optional(),
  priority: TaskPrioritySchema.optional(),
  tags: z.array(z.string()).optional(),
  column: TaskColumnSchema.optional(),
  status: TaskColumnSchema.optional(),
  nextTask: NextTaskSchema.optional(),
  requiresReview: z.boolean().optional(),
  maxRetries: z.number().int().min(0).optional(),
  deadline: z.string().optional(),
  inputPath: z.string().optional(),
  outputPath: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
});

export const MoveTaskSchema = z.object({
  column: TaskColumnSchema,
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  owner: z.string().optional(),
  description: z.string().optional(),
  clientViewEnabled: z.boolean().optional(),
});

export const CreateCommentSchema = z.object({
  author: z.string().min(1),
  text: z.string().min(1),
});

export const RegisterAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["active", "archived"]).optional(),
  owner: z.string().optional(),
  description: z.string().optional(),
  clientViewEnabled: z.boolean().optional(),
});
