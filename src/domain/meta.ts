/* Display metadata for domain enums — one place for labels + tones. */
import type {
  AgentStatus,
  FailureCategory,
  IncidentStatus,
  LiveEventType,
  RepairStrategy,
  Severity,
  StepKind,
  StepStatus,
  TaskStatus,
} from './types';

export type Tone = 'ok' | 'warn' | 'err' | 'info' | 'repair' | 'neutral' | 'accent';

export const toneVar = (t: Tone) => (t === 'accent' ? 'var(--accent)' : `var(--${t})`);
export const toneSoftVar = (t: Tone) => (t === 'accent' ? 'var(--accent-soft)' : `var(--${t}-soft)`);

export const INCIDENT_STATUS: Record<IncidentStatus, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'err' },
  investigating: { label: 'Investigating', tone: 'info' },
  repair_proposed: { label: 'Repair proposed', tone: 'repair' },
  verifying: { label: 'Verifying', tone: 'info' },
  needs_review: { label: 'Needs review', tone: 'warn' },
  resolved: { label: 'Resolved', tone: 'ok' },
  failed: { label: 'Unresolved', tone: 'neutral' },
};

export const SEVERITY: Record<Severity, { label: string; tone: Tone; rank: number }> = {
  critical: { label: 'Critical', tone: 'err', rank: 0 },
  high: { label: 'High', tone: 'warn', rank: 1 },
  medium: { label: 'Medium', tone: 'info', rank: 2 },
  low: { label: 'Low', tone: 'neutral', rank: 3 },
};

export const CATEGORY: Record<FailureCategory, { label: string; color: string }> = {
  schema_mismatch: { label: 'Schema mismatch', color: '#7c5cff' },
  tool_error: { label: 'Tool error', color: '#3b9cf6' },
  timeout: { label: 'Timeout', color: '#f59e0b' },
  hallucination: { label: 'Ungrounded output', color: '#ec4899' },
  wrong_tool: { label: 'Wrong tool', color: '#14b8a6' },
  auth: { label: 'Auth failure', color: '#ef4444' },
  loop: { label: 'Reasoning loop', color: '#8b93a8' },
  policy: { label: 'Policy violation', color: '#f97316' },
};

export const STRATEGY: Record<RepairStrategy, string> = {
  prompt_patch: 'Prompt patch',
  tool_args: 'Tool arguments',
  guardrail: 'Guardrail',
  retry_policy: 'Retry policy',
  schema_coercion: 'Schema coercion',
};

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'info' },
  succeeded: { label: 'Succeeded', tone: 'ok' },
  failed: { label: 'Failed', tone: 'err' },
  repaired: { label: 'Auto-repaired', tone: 'repair' },
  needs_review: { label: 'Needs review', tone: 'warn' },
};

export const AGENT_STATUS: Record<AgentStatus, { label: string; tone: Tone }> = {
  running: { label: 'Running', tone: 'ok' },
  idle: { label: 'Idle', tone: 'neutral' },
  degraded: { label: 'Degraded', tone: 'warn' },
  failing: { label: 'Failing', tone: 'err' },
  paused: { label: 'Paused', tone: 'neutral' },
};

export const STEP_KIND: Record<StepKind, { label: string; color: string }> = {
  plan: { label: 'Plan', color: '#8b5cf6' },
  llm: { label: 'LLM', color: '#5b5bf7' },
  tool: { label: 'Tool', color: '#0ea5e9' },
  retrieval: { label: 'Retrieval', color: '#14b8a6' },
  guard: { label: 'Guard', color: '#f59e0b' },
  output: { label: 'Output', color: '#64748b' },
};

export const STEP_STATUS: Record<StepStatus, Tone> = {
  ok: 'ok',
  warning: 'warn',
  error: 'err',
  skipped: 'neutral',
};

export const LIVE_EVENT: Record<LiveEventType, { label: string; tone: Tone }> = {
  task_started: { label: 'Started', tone: 'info' },
  task_succeeded: { label: 'Succeeded', tone: 'ok' },
  failure_detected: { label: 'Failure', tone: 'err' },
  auto_repaired: { label: 'Auto-repaired', tone: 'repair' },
  review_requested: { label: 'Review', tone: 'warn' },
};

/** Repair workflow stages, in order — drives the stepper in the workspace. */
export const WORKFLOW = [
  { key: 'detect', label: 'Detected' },
  { key: 'investigate', label: 'Root cause' },
  { key: 'repair', label: 'Repair' },
  { key: 'verify', label: 'Verify' },
  { key: 'review', label: 'Human review' },
  { key: 'learn', label: 'Stored' },
] as const;

export function workflowIndex(status: IncidentStatus, hasFeedback: boolean): number {
  switch (status) {
    case 'new':
      return 0;
    case 'investigating':
      return 1;
    case 'repair_proposed':
      return 2;
    case 'verifying':
      return 3;
    case 'needs_review':
      return 4;
    case 'resolved':
      return 6;
    case 'failed':
      return hasFeedback ? 5 : 3;
  }
}
