export interface Project {
  id: string;
  name: string;
  status: "active" | "archived";
  owner: string;
  description: string;
  clientViewEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  author: string;
  text: string;
  at: string;
}

export type TaskColumn = "backlog" | "todo" | "doing" | "review" | "done" | "failed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface NextTask {
  title: string;
  description?: string;
  assignee: string;
  priority?: TaskPriority;
  tags?: string[];
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskColumn;
  column: TaskColumn;
  assignee: string;
  createdBy: string;
  priority: TaskPriority;
  tags: string[];
  dependencies: string[];
  subtasks: string[];
  comments: Comment[];
  nextTask?: NextTask;
  parentTaskId?: string;
  deadline?: string;        // ISO date string for deadline
  inputPath?: string;       // Optional input path (file/dir)
  outputPath?: string;      // Optional output path (file/dir)
  // Metrics
  startedAt?: string;       // When moved to "doing" first time
  completedAt?: string;     // When moved to "done"
  failedAt?: string;        // When moved to "failed"
  retryCount?: number;      // How many times retried
  maxRetries?: number;      // Max retries allowed (default 2)
  requiresReview?: boolean; // Must pass through "review" before "done"
  durationMs?: number;      // Computed: completedAt - startedAt
  createdAt: string;
  updatedAt: string;
}

export interface AgentStats {
  agentId: string;
  totalTasks: number;
  completed: number;
  failed: number;
  inProgress: number;
  avgDurationMs: number | null;
  completionRate: number;
}

export interface BoardStats {
  totalTasks: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  avgDurationMs: number | null;
  completionRate: number;
  agentStats: AgentStats[];
  oldestDoingTask: { id: string; title: string; assignee: string; startedAt: string; ageMs: number } | null;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: "online" | "offline";
  capabilities: string[];
}
