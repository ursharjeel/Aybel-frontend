/* ==========================================================================
   API contract — the only surface the UI talks to.
   Two implementations: `mock` (in-browser, simulated) and `http` (your
   backend). Every tenant-scoped call takes `customerId` explicitly; the
   implementation must never return another customer's records.
   ========================================================================== */
import type {
  Agent,
  Correction,
  Customer,
  Feedback,
  ID,
  Incident,
  IncidentSummary,
  LiveEvent,
  Overview,
  RangeKey,
  TaskDetail,
  TaskPage,
  VerificationCheck,
} from '../domain/types';

/** Which features are backed by real systems vs simulated in this build. */
export type Capability = 'real' | 'simulated';
export interface Capabilities {
  data: Capability;
  liveStream: Capability;
  investigator: Capability;
  repairModel: Capability;
  retryExecution: Capability;
}

export type WorkflowProgress =
  | { type: 'log'; line: string }
  | { type: 'diff'; lineIndex: number }
  | { type: 'check'; check: VerificationCheck };

export type OnProgress = (p: WorkflowProgress) => void;

export interface AybelApi {
  readonly mode: 'mock' | 'http';
  readonly capabilities: Capabilities;

  listCustomers(): Promise<Customer[]>;

  getOverview(customerId: ID, range: RangeKey): Promise<Overview>;
  listAgents(customerId: ID): Promise<Agent[]>;

  listIncidents(customerId: ID): Promise<IncidentSummary[]>;
  getIncident(customerId: ID, incidentId: ID): Promise<Incident>;

  /* repair workflow — each step resolves with the updated incident */
  investigate(customerId: ID, incidentId: ID, onProgress?: OnProgress): Promise<Incident>;
  proposeRepair(customerId: ID, incidentId: ID, onProgress?: OnProgress): Promise<Incident>;
  applyAndVerify(customerId: ID, incidentId: ID, onProgress?: OnProgress): Promise<Incident>;
  submitFeedback(customerId: ID, incidentId: ID, feedback: Omit<Feedback, 'at'>): Promise<Incident>;

  listCorrections(customerId: ID): Promise<Correction[]>;

  listTasks(customerId: ID): Promise<TaskPage>;
  getTask(customerId: ID, taskId: ID): Promise<TaskDetail>;

  /** Live agent events. Returns an unsubscribe function. */
  subscribeLive(customerId: ID, onEvent: (e: LiveEvent) => void): () => void;

  /** Fires when server-side state for a customer changes (refetch hint). */
  onChange(listener: (customerId: ID) => void): () => void;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found in this workspace`);
    this.name = 'NotFoundError';
  }
}
