export type TaskStatus = "PENDING" | "DUE" | "COMPLETED" | "OVERDUE" | "SKIPPED";

export type EngineEvent =
  | { kind: "TASK_COMPLETED"; taskId: string; actorLabel: string }
  | { kind: "CLOCK_TICK"; previousDate: Date; newDate: Date }
  | { kind: "WEBHOOK_RECEIVED"; vendor: string; type: string; payload: Record<string, unknown> }
  | { kind: "MANUAL_OVERRIDE"; taskId: string; nextStatus: TaskStatus; actorLabel: string };

export type ActorRef =
  | { kind: "STAFF"; id?: string; label: string }
  | { kind: "PARTICIPANT"; id: string; label: string }
  | { kind: "SYSTEM"; label: string };
