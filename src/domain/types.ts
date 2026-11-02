/* ==========================================================================
   Domain model — shared by UI, mock API and (future) HTTP API.
   Every tenant-owned entity carries `customerId`. The API layer is the only
   place that resolves data, and it always scopes by customer.
   ========================================================================== */

export type ID = string;
export type ISODate = string;

/* ---------- customers (tenants) ---------- */
export interface Customer {
  id: ID;
  name: string;
  plan: 'Starter' | 'Growth' | 'Enterprise';
  region: string;
  hue: number; // avatar tint
}

/* ---------- agents ---------- */
export type AgentStatus = 'running' | 'idle' | 'degraded' | 'failing' | 'paused';
export type AgentKind =
  | 'order_router'
  | 'invoice'
  | 'datasync'
  | 'support'
  | 'claims'
  | 'kyc'
  | 'outreach'
  | 'research';

export interface Agent {
  id: ID;
  customerId: ID;
  kind: AgentKind;
  name: string;
  model: string;
  status: AgentStatus;
  tasksToday: number;
  successRate: number; // 0..1
  avgLatencyMs: number;
  currentTask: string | null;
  lastActiveAt: ISODate;
}

/* ---------- tasks ---------- */
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'repaired' | 'needs_review';

export interface Task {
  id: ID;
  customerId: ID;
  agentId: ID;
  title: string;
  status: TaskStatus;
  attempts: number;
  incidentId: ID | null;
  correctionId: ID | null;
  durationMs: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface TaskAttempt {
  n: number;
  status: 'failed' | 'succeeded' | 'running';
  startedAt: ISODate;
  durationMs: number;
  note: string;
  correctionApplied: string | null;
}

export interface TaskDetail extends Task {
  input: unknown;
  output: unknown;
  attemptsLog: TaskAttempt[];
}

export interface TaskPage {
  total: number; // total tasks in workspace
  items: Task[]; // latest window
}

/* ---------- traces ---------- */
export type StepKind = 'plan' | 'llm' | 'tool' | 'retrieval' | 'guard' | 'output';
export type StepStatus = 'ok' | 'warning' | 'error' | 'skipped';

export interface TraceStep {
  id: ID;
  index: number;
  kind: StepKind;
  name: string;
  startMs: number;
  durationMs: number;
  status: StepStatus;
  model?: string;
  tokens?: number;
  input: unknown;
  output: unknown;
  error?: string;
}

/* ---------- incidents & repair workflow ---------- */
export type FailureCategory =
  | 'schema_mismatch'
  | 'wrong_tool'
  | 'timeout'
  | 'hallucination'
  | 'auth'
  | 'loop'
  | 'policy'
  | 'tool_error';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type IncidentStatus =
  | 'new'
  | 'investigating'
  | 'repair_proposed'
  | 'verifying'
  | 'needs_review'
  | 'resolved'
  | 'failed';

export interface Evidence {
  label: string;
  detail: string;
  stepId?: ID;
}

export interface RootCause {
  summary: string;
  category: FailureCategory;
  failingStepId: ID;
  confidence: number; // 0..1
  evidence: Evidence[];
  contributing: string[];
}

export type RepairStrategy = 'prompt_patch' | 'tool_args' | 'guardrail' | 'retry_policy' | 'schema_coercion';

export interface DiffLine {
  t: ' ' | '+' | '-' | '@';
  s: string;
}

export interface RepairProposal {
  id: ID;
  strategy: RepairStrategy;
  title: string;
  rationale: string;
  target: string;
  diff: DiffLine[];
  risk: 'low' | 'medium' | 'high';
  expectedSuccess: number; // 0..1
  model: string; // repair model id
  generatedAt: ISODate;
}

export type CheckStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface VerificationCheck {
  id: ID;
  label: string;
  status: CheckStatus;
  detail?: string;
}

export interface Verification {
  status: 'passed' | 'failed';
  checks: VerificationCheck[];
  ranAt: ISODate;
  retryDurationMs: number;
}

export type FeedbackVerdict = 'approved' | 'rejected' | 'changes_requested';

export interface Feedback {
  verdict: FeedbackVerdict;
  comment: string;
  by: string;
  at: ISODate;
}

export interface Incident {
  id: ID;
  customerId: ID;
  agentId: ID;
  agentName: string;
  taskId: ID;
  taskTitle: string;
  title: string;
  errorMessage: string;
  category: FailureCategory;
  severity: Severity;
  status: IncidentStatus;
  detectedAt: ISODate;
  resolvedAt: ISODate | null;
  failingStepName: string;
  requiresHuman: boolean;
  trace: TraceStep[];
  investigationLog: string[];
  rootCause: RootCause | null;
  proposal: RepairProposal | null;
  verification: Verification | null;
  feedback: Feedback | null;
  correctionId: ID | null;
}

export type IncidentSummary = Omit<
  Incident,
  'trace' | 'investigationLog' | 'rootCause' | 'proposal' | 'verification' | 'feedback'
>;

/* ---------- recovery history (verified corrections) ---------- */
export interface Correction {
  id: ID;
  customerId: ID;
  incidentId: ID;
  incidentTitle: string;
  agentId: ID;
  agentName: string;
  category: FailureCategory;
  strategy: RepairStrategy;
  title: string;
  outcome: 'verified' | 'rejected';
  verifiedBy: 'auto' | 'human';
  reviewer: string | null;
  timeToRepairMs: number;
  storedForTraining: boolean;
  createdAt: ISODate;
}

/* ---------- overview ---------- */
export type RangeKey = '24h' | '7d' | '30d';

export interface Overview {
  range: RangeKey;
  points: ISODate[];
  series: { tasks: number[]; failures: number[]; autoRepaired: number[] };
  kpis: {
    tasks: number;
    tasksDelta: number;
    failureRate: number;
    failureRateDelta: number;
    autoRepairRate: number;
    autoRepairDelta: number;
    mttrMs: number;
    mttrDelta: number;
    awaitingReview: number;
  };
  sparks: { tasks: number[]; failureRate: number[]; autoRepair: number[]; mttr: number[] };
  categories: { category: FailureCategory; count: number }[];
  topAgents: { agentId: ID; name: string; failures: number; repaired: number }[];
  funnel: { stage: string; count: number }[];
  recent: IncidentSummary[];
}

/* ---------- live monitoring ---------- */
export type LiveEventType =
  | 'task_started'
  | 'task_succeeded'
  | 'failure_detected'
  | 'auto_repaired'
  | 'review_requested';

export interface LiveEvent {
  id: ID;
  customerId: ID;
  agentId: ID;
  agentName: string;
  type: LiveEventType;
  message: string;
  incidentId?: ID;
  at: ISODate;
}
