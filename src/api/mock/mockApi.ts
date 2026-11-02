/* ==========================================================================
   Mock API (SIMULATED). Implements the full contract in-browser so the demo
   runs with no backend. Workflow steps stream progress with realistic delays.
   ========================================================================== */
import type { AybelApi, OnProgress } from '../contract';
import { NotFoundError } from '../contract';
import type {
  Agent,
  FailureCategory,
  ID,
  Incident,
  IncidentSummary,
  LiveEvent,
  Overview,
  RangeKey,
  VerificationCheck,
} from '../../domain/types';
import { hash, rng, sleep } from '../../lib/random';
import {
  CUSTOMERS,
  correctionFrom,
  getWorkspace,
  materialize,
  newIncident,
  proposalFor,
  rootCauseFor,
  taskForIncident,
  type IncidentRecord,
  type Workspace,
} from './workspace';

const clone = <T,>(v: T): T => structuredClone(v);
const latency = () => sleep(140 + Math.random() * 220);

/* ---------- change bus ---------- */
const listeners = new Set<(c: ID) => void>();
const emit = (customerId: ID) => listeners.forEach((l) => l(customerId));

function ws(customerId: ID): Workspace {
  const w = getWorkspace(customerId);
  if (!w) throw new NotFoundError('Customer');
  return w;
}

function rec(w: Workspace, incidentId: ID): IncidentRecord {
  const r = w.incidents.find((x) => x.incident.id === incidentId);
  if (!r) throw new NotFoundError(`Incident ${incidentId}`);
  return r;
}

const summarize = ({ trace: _t, investigationLog: _l, rootCause: _r, proposal: _p, verification: _v, feedback: _f, ...s }: Incident): IncidentSummary => s;

function syncTask(w: Workspace, r: IncidentRecord) {
  const i = w.tasks.findIndex((t) => t.id === r.incident.taskId);
  const t = taskForIncident(w, r.incident, r.scenario);
  if (i >= 0) w.tasks[i] = t;
  else w.tasks.unshift(t);
  w.tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function storeCorrection(w: Workspace, r: IncidentRecord) {
  const c = correctionFrom(w, r);
  r.incident.correctionId = c.id;
  w.corrections.unshift(c);
}

/* ---------- overview aggregation ---------- */
const RANGE: Record<RangeKey, { buckets: number; ms: number }> = {
  '24h': { buckets: 24, ms: 3600e3 },
  '7d': { buckets: 28, ms: 6 * 3600e3 },
  '30d': { buckets: 30, ms: 24 * 3600e3 },
};

function overview(w: Workspace, range: RangeKey): Overview {
  const { buckets, ms } = RANGE[range];
  const now = Date.now();
  const end = Math.ceil(now / ms) * ms;
  const start = end - buckets * ms;
  const r = rng(hash(w.customer.id + range));
  const points: string[] = [];
  const tasks: number[] = [];
  const failures = new Array<number>(buckets).fill(0);
  const auto = new Array<number>(buckets).fill(0);
  const ttrSum = new Array<number>(buckets).fill(0);
  const ttrN = new Array<number>(buckets).fill(0);

  for (let b = 0; b < buckets; b++) {
    const t = start + b * ms;
    points.push(new Date(t).toISOString());
    const hours = ms / 3600e3;
    const hourOfDay = new Date(t).getHours();
    const wave = hours <= 6 ? 1 + 0.38 * Math.sin(((hourOfDay - 8) / 24) * Math.PI * 2) : 1 + 0.12 * Math.sin(b / 1.7);
    const partial = t + ms > now ? (now - t) / ms : 1;
    tasks.push(Math.round(w.ratePerHour * hours * wave * r.range(0.88, 1.12) * partial));
  }

  const inRange = w.incidents.map((x) => x.incident).filter((i) => new Date(i.detectedAt).getTime() >= start);
  for (const i of inRange) {
    const b = Math.min(buckets - 1, Math.floor((new Date(i.detectedAt).getTime() - start) / ms));
    failures[b]++;
    if (i.status === 'resolved') {
      if (!i.feedback) auto[b]++;
      ttrSum[b] += new Date(i.resolvedAt ?? now).getTime() - new Date(i.detectedAt).getTime();
      ttrN[b]++;
    }
  }

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const totalTasks = sum(tasks);
  const totalFail = inRange.length;
  const resolved = inRange.filter((i) => i.status === 'resolved');
  const autoN = resolved.filter((i) => !i.feedback).length;
  const mttr = resolved.length ? sum(ttrSum) / resolved.length : 0;

  const cats = new Map<FailureCategory, number>();
  inRange.forEach((i) => cats.set(i.category, (cats.get(i.category) ?? 0) + 1));

  const byAgent = new Map<ID, { failures: number; repaired: number }>();
  inRange.forEach((i) => {
    const a = byAgent.get(i.agentId) ?? { failures: 0, repaired: 0 };
    a.failures++;
    if (i.status === 'resolved') a.repaired++;
    byAgent.set(i.agentId, a);
  });

  let lastRate = 0.9;
  return {
    range,
    points,
    series: { tasks, failures, autoRepaired: auto },
    kpis: {
      tasks: totalTasks,
      tasksDelta: r.range(-3, 14),
      failureRate: totalTasks ? totalFail / totalTasks : 0,
      failureRateDelta: r.range(-28, 6),
      autoRepairRate: totalFail ? autoN / totalFail : 0,
      autoRepairDelta: r.range(1, 9),
      mttrMs: mttr,
      mttrDelta: r.range(-34, -4),
      awaitingReview: w.incidents.filter((x) => x.incident.status === 'needs_review').length,
    },
    sparks: {
      tasks,
      failureRate: tasks.map((t, b) => (t ? failures[b] / t : 0)),
      autoRepair: failures.map((f, b) => (lastRate = f ? auto[b] / f : lastRate)),
      mttr: ttrN.map((n, b) => (n ? ttrSum[b] / n : 0)),
    },
    categories: [...cats.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    topAgents: w.agents
      .map((a) => ({ agentId: a.id, name: a.name, ...(byAgent.get(a.id) ?? { failures: 0, repaired: 0 }) }))
      .sort((a, b) => b.failures - a.failures),
    funnel: [
      { stage: 'Detected', count: totalFail },
      { stage: 'Root cause found', count: inRange.filter((i) => i.rootCause).length },
      { stage: 'Repair generated', count: inRange.filter((i) => i.proposal).length },
      { stage: 'Verified', count: inRange.filter((i) => i.verification?.status === 'passed').length },
      { stage: 'Stored', count: resolved.length },
    ],
    recent: w.incidents.slice(0, 6).map((x) => summarize(x.incident)),
  };
}

/* ---------- live simulator ---------- */
function liveTick(w: Workspace, emitEvent: (e: LiveEvent) => void) {
  const r = w.rand;
  const agent: Agent = r.pick(w.agents.filter((a) => a.status !== 'paused'));
  const now = Date.now();
  const roll = r.next();
  const base = { id: `ev-${now}-${r.int(0, 1e6)}`, customerId: w.customer.id, agentId: agent.id, agentName: agent.name, at: new Date(now).toISOString() };
  agent.lastActiveAt = base.at;

  if (roll < 0.06) {
    const created = newIncident(w, agent, now, r);
    w.incidents.unshift(created);
    syncTask(w, created);
    agent.status = 'degraded';
    w.taskTotal++;
    emitEvent({ ...base, type: 'failure_detected', message: created.incident.title, incidentId: created.incident.id });
    // Autonomous pipeline picks it up unless a human starts working on it first.
    setTimeout(() => {
      if (created.incident.status !== 'new') return;
      const human = created.incident.requiresHuman;
      materialize(created, human ? 'needs_review' : 'resolved', r, { resolvedAt: Date.now() });
      if (!human) storeCorrection(w, created);
      syncTask(w, created);
      if (!human && !w.incidents.some((x) => x.incident.agentId === agent.id && ['new', 'repair_proposed', 'needs_review'].includes(x.incident.status))) agent.status = 'running';
      emitEvent({
        ...base,
        id: base.id + '-2',
        at: new Date().toISOString(),
        type: human ? 'review_requested' : 'auto_repaired',
        message: human ? `Repair verified — waiting for approval (${created.incident.id})` : `Repaired & verified in ${Math.round((Date.now() - now) / 1000)} s — ${created.incident.title}`,
        incidentId: created.incident.id,
      });
      emit(w.customer.id);
    }, 5200 + r.int(0, 3000));
  } else if (roll < 0.58) {
    const t = w.tasks.find((x) => x.agentId === agent.id && x.status === 'running');
    if (t) {
      t.status = 'succeeded';
      t.updatedAt = base.at;
      t.durationMs = now - new Date(t.createdAt).getTime();
      t.attemptsLog = [{ n: 1, status: 'succeeded', startedAt: t.createdAt, durationMs: t.durationMs, note: 'Completed first try', correctionApplied: null }];
    }
    agent.tasksToday++;
    w.taskTotal++;
    agent.currentTask = null;
    if (agent.status === 'idle') agent.status = 'running';
    emitEvent({ ...base, type: 'task_succeeded', message: t ? t.title : `Task completed in ${(agent.avgLatencyMs / 1000).toFixed(1)} s` });
  } else {
    const kindTitle = w.tasks.find((x) => x.agentId === agent.id && !x.incidentId)?.title ?? 'New task';
    const title = kindTitle.replace(/\d{4,}/, () => String(r.int(10000, 99999)));
    const id = `${w.code}-T${++w.seq.task}`;
    w.tasks.unshift({
      id,
      customerId: w.customer.id,
      agentId: agent.id,
      title,
      status: 'running',
      attempts: 1,
      incidentId: null,
      correctionId: null,
      durationMs: 0,
      createdAt: base.at,
      updatedAt: base.at,
      input: { request: title },
      output: null,
      attemptsLog: [{ n: 1, status: 'running', startedAt: base.at, durationMs: 0, note: 'In progress', correctionApplied: null }],
    });
    agent.currentTask = title;
    if (agent.status === 'idle') agent.status = 'running';
    emitEvent({ ...base, type: 'task_started', message: title });
  }
  emit(w.customer.id);
}

/* ---------- API ---------- */
export const mockApi: AybelApi = {
  mode: 'mock',
  capabilities: { data: 'simulated', liveStream: 'simulated', investigator: 'simulated', repairModel: 'simulated', retryExecution: 'simulated' },

  async listCustomers() {
    await latency();
    return clone(CUSTOMERS);
  },

  async getOverview(customerId, range) {
    await latency();
    return clone(overview(ws(customerId), range));
  },

  async listAgents(customerId) {
    await latency();
    return clone(ws(customerId).agents);
  },

  async listIncidents(customerId) {
    await latency();
    return ws(customerId).incidents.map((x) => clone(summarize(x.incident)));
  },

  async getIncident(customerId, incidentId) {
    await latency();
    return clone(rec(ws(customerId), incidentId).incident);
  },

  async investigate(customerId, incidentId, onProgress?: OnProgress) {
    const w = ws(customerId);
    const r = rec(w, incidentId);
    r.incident.status = 'investigating';
    r.incident.investigationLog = [];
    emit(customerId);
    for (const line of r.scenario.investigationLog) {
      await sleep(380 + Math.random() * 420);
      r.incident.investigationLog.push(line);
      onProgress?.({ type: 'log', line });
    }
    await sleep(500);
    r.incident.rootCause = rootCauseFor(r.incident, r.scenario);
    emit(customerId);
    return clone(r.incident);
  },

  async proposeRepair(customerId, incidentId, onProgress?: OnProgress) {
    const w = ws(customerId);
    const r = rec(w, incidentId);
    if (!r.incident.rootCause) r.incident.rootCause = rootCauseFor(r.incident, r.scenario);
    const proposal = proposalFor(r.incident, r.scenario, r.attempt, r.incident.feedback?.verdict === 'changes_requested' ? r.incident.feedback.comment : undefined);
    await sleep(700);
    for (let i = 0; i < proposal.diff.length; i++) {
      await sleep(90 + Math.random() * 140);
      onProgress?.({ type: 'diff', lineIndex: i });
    }
    r.incident.proposal = proposal;
    r.incident.verification = null;
    r.incident.status = 'repair_proposed';
    emit(customerId);
    return clone(r.incident);
  },

  async applyAndVerify(customerId, incidentId, onProgress?: OnProgress) {
    const w = ws(customerId);
    const r = rec(w, incidentId);
    const inc = r.incident;
    if (!inc.proposal) throw new Error('No repair proposal to apply');
    inc.status = 'verifying';
    emit(customerId);

    r.attempt++;
    const passed = rng(hash(inc.id + ':' + r.attempt)).next() < r.scenario.passRate || r.attempt > 1;
    const started = Date.now();
    const checks: VerificationCheck[] = r.scenario.checks.map((c, i) => ({ id: `${inc.id}-c${i}`, label: c.label, status: 'pending' }));
    for (let i = 0; i < checks.length; i++) {
      checks[i] = { ...checks[i], status: 'running' };
      onProgress?.({ type: 'check', check: clone(checks[i]) });
      await sleep(650 + Math.random() * 650);
      const fail = !passed && i === checks.length - 1;
      checks[i] = { ...checks[i], status: fail ? 'failed' : 'passed', detail: fail ? 'Regression detected on replay set' : r.scenario.checks[i].detail };
      onProgress?.({ type: 'check', check: clone(checks[i]) });
    }

    inc.verification = { status: passed ? 'passed' : 'failed', checks, ranAt: new Date().toISOString(), retryDurationMs: Date.now() - started };
    if (passed && !inc.requiresHuman) {
      inc.status = 'resolved';
      inc.resolvedAt = new Date().toISOString();
      storeCorrection(w, r);
    } else {
      inc.status = 'needs_review';
    }
    syncTask(w, r);
    emit(customerId);
    return clone(inc);
  },

  async submitFeedback(customerId, incidentId, fb) {
    const w = ws(customerId);
    const r = rec(w, incidentId);
    const inc = r.incident;
    await sleep(450);
    inc.feedback = { ...fb, at: new Date().toISOString() };
    if (fb.verdict === 'approved') {
      inc.status = 'resolved';
      inc.resolvedAt = inc.feedback.at;
      storeCorrection(w, r);
    } else if (fb.verdict === 'rejected') {
      inc.status = 'failed';
      inc.resolvedAt = inc.feedback.at;
      storeCorrection(w, r);
    } else {
      inc.status = 'repair_proposed';
      inc.verification = null;
      inc.proposal = proposalFor(inc, r.scenario, r.attempt, fb.comment);
    }
    syncTask(w, r);
    emit(customerId);
    return clone(inc);
  },

  async listCorrections(customerId) {
    await latency();
    return clone(ws(customerId).corrections);
  },

  async listTasks(customerId) {
    await latency();
    const w = ws(customerId);
    return { total: w.taskTotal, items: w.tasks.slice(0, 500).map(({ input: _i, output: _o, attemptsLog: _a, ...t }) => clone(t)) };
  },

  async getTask(customerId, taskId) {
    await latency();
    const t = ws(customerId).tasks.find((x) => x.id === taskId);
    if (!t) throw new NotFoundError(`Task ${taskId}`);
    return clone(t);
  },

  subscribeLive(customerId, onEvent) {
    const w = ws(customerId);
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (!alive) return;
      liveTick(w, (e) => alive && onEvent(e));
      timer = setTimeout(loop, 1100 + Math.random() * 1400);
    };
    timer = setTimeout(loop, 600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  },

  onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
