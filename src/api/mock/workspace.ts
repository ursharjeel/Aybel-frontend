/* ==========================================================================
   Mock workspace generator (SIMULATED DATA).
   Builds one fully isolated workspace per customer from a deterministic seed.
   Nothing in here is shared between customers except immutable templates.
   ========================================================================== */
import type {
  Agent,
  AgentKind,
  Correction,
  Customer,
  ID,
  Incident,
  IncidentStatus,
  TaskDetail,
  TaskStatus,
  TraceStep,
} from '../../domain/types';
import { hash, rng, type Rng } from '../../lib/random';
import { SCENARIOS, type Scenario } from './scenarios';

export const CUSTOMERS: Customer[] = [
  { id: 'cus_northwind', name: 'Northwind Logistics', plan: 'Enterprise', region: 'us-east-1', hue: 252 },
  { id: 'cus_helix', name: 'Helix Health', plan: 'Growth', region: 'eu-west-1', hue: 168 },
  { id: 'cus_orbital', name: 'Orbital Pay', plan: 'Enterprise', region: 'ap-south-1', hue: 22 },
];

const PROFILE: Record<ID, { code: string; kinds: AgentKind[]; rate: [number, number] }> = {
  cus_northwind: { code: 'NW', kinds: ['order_router', 'invoice', 'datasync', 'support', 'research'], rate: [70, 110] },
  cus_helix: { code: 'HX', kinds: ['claims', 'kyc', 'support', 'research', 'outreach'], rate: [40, 70] },
  cus_orbital: { code: 'OP', kinds: ['kyc', 'invoice', 'support', 'datasync', 'outreach'], rate: [85, 130] },
};

export const AGENT_NAME: Record<AgentKind, string> = {
  order_router: 'Order Router',
  invoice: 'Invoice Clerk',
  datasync: 'Data Sync',
  support: 'Support Desk',
  claims: 'Claims Intake',
  kyc: 'KYC Reviewer',
  outreach: 'Lead Outreach',
  research: 'Account Research',
};

const AGENT_MODEL: Record<AgentKind, string> = {
  order_router: 'claude-sonnet-5-5',
  invoice: 'claude-sonnet-5-5',
  datasync: 'claude-haiku-5-5',
  support: 'claude-sonnet-5-5',
  claims: 'claude-haiku-5-5',
  kyc: 'claude-opus-5-5',
  outreach: 'claude-haiku-5-5',
  research: 'claude-opus-5-5',
};

const TASK_TEMPLATES: Record<AgentKind, string[]> = {
  order_router: ['Route order ORD-#####', 'Re-route split shipment SHP-####', 'Allocate stock for ORD-#####'],
  invoice: ['Create invoice for PO-#####', 'Reconcile vendor statement V-####', 'Match receipt to PO-#####'],
  datasync: ['Sync shipments → analytics', 'Backfill customers table', 'Refresh pricing snapshot'],
  support: ['Reply to ticket ######', 'Triage ticket ######', 'Summarize thread ######'],
  claims: ['Extract line items from CLM-#####', 'Validate coverage for CLM-#####', 'Flag duplicates in batch B-####'],
  kyc: ['Review applicant A-#####', 'Request documents from A-#####', 'Screen sanctions for A-#####'],
  outreach: ['Log call outcomes for batch B-####', 'Draft follow-up for lead L-#####', 'Enrich lead L-#####'],
  research: ['Summarize account activity for #####', 'Compile churn signals for #####', 'Brief: QBR prep #####'],
};

export const REPAIR_MODEL = 'aybel-repair-1 (preview)';
const REVIEWERS = ['M. Okafor', 'S. Lindqvist', 'R. Iyer', 'J. Moreau'];

export interface IncidentRecord {
  incident: Incident;
  scenario: Scenario;
  attempt: number;
}

export interface Workspace {
  customer: Customer;
  code: string;
  agents: Agent[];
  incidents: IncidentRecord[];
  tasks: TaskDetail[];
  corrections: Correction[];
  taskTotal: number;
  ratePerHour: number;
  seq: { incident: number; task: number; correction: number };
  rand: Rng;
  createdAt: number;
}

/* ---------- helpers ---------- */

const iso = (t: number) => new Date(t).toISOString();

const fillDigits = (tpl: string, r: Rng) => tpl.replace(/#/g, () => String(r.int(0, 9))).replace(/^(\D*)0/, '$11');

/** Re-number IDs like PO-48211 consistently inside one scenario instance. */
function instantiate(s: Scenario, r: Rng): Scenario {
  const offsets = new Map<string, number>();
  const json = JSON.stringify(s).replace(/\b([A-Z]{1,4})-(\d{4,6})\b/g, (_m, pre: string, num: string) => {
    if (!offsets.has(pre)) offsets.set(pre, r.int(-800, 800));
    const n = Math.max(10 ** (num.length - 1), Number(num) + (offsets.get(pre) ?? 0));
    return `${pre}-${String(n).padStart(num.length, '0')}`;
  });
  return JSON.parse(json) as Scenario;
}

export function buildTrace(incId: ID, s: Scenario, r: Rng): TraceStep[] {
  let t = 0;
  return s.steps.map((st, i) => {
    const jitter = st.ms > 0 ? Math.round(st.ms * r.range(0.86, 1.14)) : 0;
    const step: TraceStep = {
      id: `${incId}-s${i}`,
      index: i,
      kind: st.kind,
      name: st.name,
      startMs: t,
      durationMs: jitter,
      status: st.status ?? 'ok',
      model: st.model,
      tokens: st.tokens,
      input: st.input,
      output: st.output,
      error: st.error,
    };
    t += jitter + (jitter ? r.int(8, 60) : 0);
    return step;
  });
}

/** Stage → which workflow artifacts exist. */
export function materialize(rec: IncidentRecord, status: IncidentStatus, r: Rng, opts: { resolvedAt?: number; passed?: boolean; feedbackVerdict?: 'approved' | 'rejected'; reviewer?: string } = {}) {
  const { incident: inc, scenario: s } = rec;
  const stage = { new: 0, investigating: 0, repair_proposed: 2, verifying: 2, needs_review: 3, resolved: 3, failed: 3 }[status];
  inc.status = status;
  if (stage >= 1 || status === 'repair_proposed') {
    inc.investigationLog = [...s.investigationLog];
    inc.rootCause = rootCauseFor(inc, s);
  }
  if (stage >= 2) inc.proposal = proposalFor(inc, s);
  if (stage >= 3) {
    const passed = opts.passed ?? true;
    inc.verification = {
      status: passed ? 'passed' : 'failed',
      ranAt: iso(opts.resolvedAt ?? Date.now()),
      retryDurationMs: Math.round(r.range(1200, 6800)),
      checks: s.checks.map((c, i) => ({
        id: `${inc.id}-c${i}`,
        label: c.label,
        status: !passed && i === s.checks.length - 1 ? 'failed' : 'passed',
        detail: !passed && i === s.checks.length - 1 ? 'Regression detected on replay set' : c.detail,
      })),
    };
  }
  if (opts.feedbackVerdict) {
    inc.feedback = {
      verdict: opts.feedbackVerdict,
      comment: opts.feedbackVerdict === 'approved' ? 'Looks right. Approving for this agent.' : 'Too broad — would affect unrelated flows.',
      by: opts.reviewer ?? r.pick(REVIEWERS),
      at: iso(opts.resolvedAt ?? Date.now()),
    };
  }
  if (status === 'resolved' || status === 'failed') inc.resolvedAt = iso(opts.resolvedAt ?? Date.now());
}

export function rootCauseFor(inc: Incident, s: Scenario) {
  return {
    summary: s.rootCause.summary,
    category: s.category,
    failingStepId: inc.trace[s.failingStep]?.id ?? '',
    confidence: s.rootCause.confidence,
    evidence: s.rootCause.evidence.map((e, i) => ({ ...e, stepId: inc.trace[s.rootCause.evidenceSteps[i]]?.id })),
    contributing: s.rootCause.contributing,
  };
}

export function proposalFor(inc: Incident, s: Scenario, revision = 0, comment?: string) {
  return {
    id: `${inc.id}-r${revision + 1}`,
    strategy: s.proposal.strategy,
    title: revision ? `${s.proposal.title} (revision ${revision + 1})` : s.proposal.title,
    rationale: comment ? `${s.proposal.rationale}\n\nRevised per reviewer: “${comment}”` : s.proposal.rationale,
    target: s.proposal.target,
    diff: s.proposal.diff,
    risk: s.proposal.risk,
    expectedSuccess: Math.max(0.5, s.proposal.expectedSuccess - revision * 0.02),
    model: REPAIR_MODEL,
    generatedAt: iso(Date.now()),
  };
}

export function correctionFrom(ws: Workspace, rec: IncidentRecord): Correction {
  const inc = rec.incident;
  const human = !!inc.feedback;
  const rejected = inc.feedback?.verdict === 'rejected';
  return {
    id: `${ws.code}-C${++ws.seq.correction}`,
    customerId: ws.customer.id,
    incidentId: inc.id,
    incidentTitle: inc.title,
    agentId: inc.agentId,
    agentName: inc.agentName,
    category: inc.category,
    strategy: rec.scenario.proposal.strategy,
    title: inc.proposal?.title ?? rec.scenario.proposal.title,
    outcome: rejected ? 'rejected' : 'verified',
    verifiedBy: human ? 'human' : 'auto',
    reviewer: inc.feedback?.by ?? null,
    timeToRepairMs: new Date(inc.resolvedAt ?? Date.now()).getTime() - new Date(inc.detectedAt).getTime(),
    storedForTraining: !rejected,
    createdAt: inc.resolvedAt ?? iso(Date.now()),
  };
}

export function taskForIncident(ws: Workspace, inc: Incident, s: Scenario): TaskDetail {
  const status: TaskStatus =
    inc.status === 'resolved' ? 'repaired' : inc.status === 'needs_review' ? 'needs_review' : 'failed';
  const t0 = new Date(inc.detectedAt).getTime() - (inc.trace.at(-1)?.startMs ?? 0) - 400;
  const attempts: TaskDetail['attemptsLog'] = [
    { n: 1, status: 'failed', startedAt: iso(t0), durationMs: (inc.trace.at(-1)?.startMs ?? 0) + 400, note: inc.errorMessage, correctionApplied: null },
  ];
  if (status === 'repaired' && inc.verification) {
    attempts.push({
      n: 2,
      status: 'succeeded',
      startedAt: inc.verification.ranAt,
      durationMs: inc.verification.retryDurationMs,
      note: 'Retried with verified correction',
      correctionApplied: inc.proposal?.title ?? null,
    });
  }
  return {
    id: inc.taskId,
    customerId: ws.customer.id,
    agentId: inc.agentId,
    title: inc.taskTitle,
    status,
    attempts: attempts.length,
    incidentId: inc.id,
    correctionId: inc.correctionId,
    durationMs: attempts.reduce((a, x) => a + x.durationMs, 0),
    createdAt: iso(t0),
    updatedAt: inc.resolvedAt ?? inc.detectedAt,
    input: s.steps[0]?.input ?? null,
    output: status === 'repaired' ? { ok: true, via: 'correction', correction: inc.proposal?.id } : { ok: false, error: inc.errorMessage },
    attemptsLog: attempts,
  };
}

/* ---------- incident factory (also used by the live simulator) ---------- */

export function newIncident(ws: Workspace, agent: Agent, detectedAt: number, r: Rng, scenarioOverride?: Scenario): IncidentRecord {
  const options = SCENARIOS.filter((s) => s.agentKind === agent.kind);
  const s = instantiate(scenarioOverride ?? r.pick(options.length ? options : SCENARIOS), r);
  const id = `${ws.code}-${++ws.seq.incident}`;
  const taskId = `${ws.code}-T${++ws.seq.task}`;
  const incident: Incident = {
    id,
    customerId: ws.customer.id,
    agentId: agent.id,
    agentName: agent.name,
    taskId,
    taskTitle: s.taskTitle,
    title: s.title,
    errorMessage: s.errorMessage,
    category: s.category,
    severity: s.severity,
    status: 'new',
    detectedAt: iso(detectedAt),
    resolvedAt: null,
    failingStepName: s.steps[s.failingStep]?.name ?? '',
    requiresHuman: s.requiresHuman,
    trace: [],
    investigationLog: [],
    rootCause: null,
    proposal: null,
    verification: null,
    feedback: null,
    correctionId: null,
  };
  incident.trace = buildTrace(id, s, r);
  return { incident, scenario: s, attempt: 0 };
}

/* ---------- workspace builder ---------- */

const cache = new Map<ID, Workspace>();

export function getWorkspace(customerId: ID): Workspace | null {
  const existing = cache.get(customerId);
  if (existing) return existing;
  const customer = CUSTOMERS.find((c) => c.id === customerId);
  const profile = PROFILE[customerId];
  if (!customer || !profile) return null;
  const ws = buildWorkspace(customer, profile);
  cache.set(customerId, ws);
  return ws;
}

function buildWorkspace(customer: Customer, profile: (typeof PROFILE)[string]): Workspace {
  const r = rng(hash(customer.id));
  const now = Date.now();
  const H = 3600e3;
  const ratePerHour = r.int(profile.rate[0], profile.rate[1]);
  const ws: Workspace = {
    customer,
    code: profile.code,
    agents: [],
    incidents: [],
    tasks: [],
    corrections: [],
    taskTotal: Math.round(ratePerHour * 24 * 30 * r.range(0.95, 1.05)),
    ratePerHour,
    seq: { incident: 4000, task: 180000, correction: 900 },
    rand: rng(hash(customer.id + ':live')),
    createdAt: now,
  };

  ws.agents = profile.kinds.map((kind, i) => ({
    id: `${profile.code}-AG${i + 1}`,
    customerId: customer.id,
    kind,
    name: AGENT_NAME[kind],
    model: AGENT_MODEL[kind],
    status: 'running',
    tasksToday: Math.round((ratePerHour * new Date().getHours() + ratePerHour) / profile.kinds.length * r.range(0.6, 1.4)),
    successRate: r.range(0.962, 0.995),
    avgLatencyMs: Math.round(r.range(1400, 6200)),
    currentTask: null,
    lastActiveAt: iso(now - r.int(2, 90) * 1000),
  }));

  /* incidents, oldest first so sequence numbers increase with time */
  const n = r.int(240, 320);
  const ages = Array.from({ length: n }, () => 30 * 24 * H * Math.pow(r.next(), 1.3) + 4 * 60e3).sort((a, b) => b - a);
  ages.forEach((age) => {
    const agent = r.pick(ws.agents);
    ws.incidents.push(newIncident(ws, agent, now - age, r));
  });
  ws.incidents.reverse(); // newest first

  ws.incidents.forEach((rec, j) => {
    const inc = rec.incident;
    const detected = new Date(inc.detectedAt).getTime();
    const ageH = (now - detected) / H;
    const human = inc.requiresHuman;
    const ttr = human ? r.range(18 * 60e3, 5 * H) : r.range(38e3, 260e3);
    const resolvedAt = Math.min(now - 15e3, detected + ttr);

    if (j < 4) return; // stays 'new'
    if (j < 6) return materialize(rec, 'repair_proposed', r);
    if (j < 9 || (human && ageH < 30 && r.chance(0.5))) return materialize(rec, 'needs_review', r, { resolvedAt: detected + 90e3, passed: !(j === 8) });
    if (r.chance(0.055)) {
      const rejected = r.chance(0.5);
      materialize(rec, 'failed', r, { resolvedAt, passed: rejected, feedbackVerdict: rejected ? 'rejected' : undefined });
      if (rejected) {
        const c = correctionFrom(ws, rec);
        inc.correctionId = c.id;
        ws.corrections.push(c);
      }
      return;
    }
    materialize(rec, 'resolved', r, { resolvedAt, feedbackVerdict: human ? 'approved' : undefined });
    const c = correctionFrom(ws, rec);
    inc.correctionId = c.id;
    ws.corrections.push(c);
  });
  ws.corrections.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  /* tasks: one per incident + a window of recent normal traffic */
  ws.incidents.forEach((rec) => ws.tasks.push(taskForIncident(ws, rec.incident, rec.scenario)));
  for (let i = 0; i < 320; i++) {
    const agent = r.pick(ws.agents);
    const created = now - Math.pow(r.next(), 1.1) * 40 * H;
    const dur = Math.round(r.range(700, agent.avgLatencyMs * 2.2));
    const status: TaskStatus = i < 5 ? 'running' : i < 8 ? 'queued' : 'succeeded';
    const at = i < 8 ? now - r.int(3, 50) * 1000 : created;
    const title = fillDigits(r.pick(TASK_TEMPLATES[agent.kind]), r);
    ws.tasks.push({
      id: `${ws.code}-T${++ws.seq.task}`,
      customerId: customer.id,
      agentId: agent.id,
      title,
      status,
      attempts: status === 'queued' ? 0 : 1,
      incidentId: null,
      correctionId: null,
      durationMs: status === 'succeeded' ? dur : 0,
      createdAt: iso(at),
      updatedAt: iso(status === 'succeeded' ? at + dur : at),
      input: { request: title },
      output: status === 'succeeded' ? { ok: true } : null,
      attemptsLog:
        status === 'queued'
          ? []
          : [{ n: 1, status: status === 'running' ? 'running' : 'succeeded', startedAt: iso(at), durationMs: dur, note: status === 'running' ? 'In progress' : 'Completed first try', correctionApplied: null }],
    });
  }
  ws.tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  /* agent state reflects open incidents */
  const open = new Set(ws.incidents.filter((x) => ['new', 'repair_proposed', 'needs_review'].includes(x.incident.status)).map((x) => x.incident.agentId));
  ws.agents.forEach((a, i) => {
    if (open.has(a.id)) a.status = 'degraded';
    if (i === ws.agents.length - 1 && !open.has(a.id)) a.status = 'idle';
    const running = ws.tasks.find((t) => t.agentId === a.id && t.status === 'running');
    a.currentTask = running?.title ?? null;
  });

  return ws;
}
