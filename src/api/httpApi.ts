/* ==========================================================================
   HTTP API client — integration point for the real backend.
   Enable with VITE_API_MODE=http and VITE_API_BASE=https://api.example.com
   REST + SSE shape the UI expects (all routes customer-scoped):

     GET  /v1/customers
     GET  /v1/customers/:cid/overview?range=24h|7d|30d
     GET  /v1/customers/:cid/agents
     GET  /v1/customers/:cid/incidents
     GET  /v1/customers/:cid/incidents/:id
     POST /v1/customers/:cid/incidents/:id/investigate      (SSE progress)
     POST /v1/customers/:cid/incidents/:id/repair           (SSE progress)
     POST /v1/customers/:cid/incidents/:id/verify           (SSE progress)
     POST /v1/customers/:cid/incidents/:id/feedback         { verdict, comment, by }
     GET  /v1/customers/:cid/corrections
     GET  /v1/customers/:cid/tasks
     GET  /v1/customers/:cid/tasks/:id
     GET  /v1/customers/:cid/live                           (SSE LiveEvent stream)

   Streaming endpoints emit `event: progress` (WorkflowProgress JSON) and a
   final `event: done` (Incident JSON).
   ========================================================================== */
import type { AybelApi, OnProgress, WorkflowProgress } from './contract';
import { NotFoundError } from './contract';
import type { ID, Incident, LiveEvent } from '../domain/types';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';
const cid = (id: ID) => `/v1/customers/${encodeURIComponent(id)}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...init,
  });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/** POST that streams Server-Sent Events, resolving with the `done` payload. */
async function stream(path: string, onProgress?: OnProgress, body?: unknown): Promise<Incident> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = /^event: (.*)$/m.exec(chunk)?.[1] ?? 'message';
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      if (!data) continue;
      if (ev === 'progress') onProgress?.(JSON.parse(data) as WorkflowProgress);
      if (ev === 'done') return JSON.parse(data) as Incident;
    }
  }
  throw new Error('Stream ended without result');
}

const changeListeners = new Set<(c: ID) => void>();

export const httpApi: AybelApi = {
  mode: 'http',
  capabilities: { data: 'real', liveStream: 'real', investigator: 'real', repairModel: 'real', retryExecution: 'real' },

  listCustomers: () => request('/v1/customers'),
  getOverview: (c, range) => request(`${cid(c)}/overview?range=${range}`),
  listAgents: (c) => request(`${cid(c)}/agents`),
  listIncidents: (c) => request(`${cid(c)}/incidents`),
  getIncident: (c, id) => request(`${cid(c)}/incidents/${encodeURIComponent(id)}`),

  async investigate(c, id, p) {
    const r = await stream(`${cid(c)}/incidents/${encodeURIComponent(id)}/investigate`, p);
    changeListeners.forEach((l) => l(c));
    return r;
  },
  async proposeRepair(c, id, p) {
    const r = await stream(`${cid(c)}/incidents/${encodeURIComponent(id)}/repair`, p);
    changeListeners.forEach((l) => l(c));
    return r;
  },
  async applyAndVerify(c, id, p) {
    const r = await stream(`${cid(c)}/incidents/${encodeURIComponent(id)}/verify`, p);
    changeListeners.forEach((l) => l(c));
    return r;
  },
  async submitFeedback(c, id, fb) {
    const r = await request<Incident>(`${cid(c)}/incidents/${encodeURIComponent(id)}/feedback`, { method: 'POST', body: JSON.stringify(fb) });
    changeListeners.forEach((l) => l(c));
    return r;
  },

  listCorrections: (c) => request(`${cid(c)}/corrections`),
  listTasks: (c) => request(`${cid(c)}/tasks`),
  getTask: (c, id) => request(`${cid(c)}/tasks/${encodeURIComponent(id)}`),

  subscribeLive(c, onEvent) {
    const es = new EventSource(`${BASE}${cid(c)}/live`, { withCredentials: true });
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as LiveEvent;
      if (e.customerId !== c) return; // defence in depth: never surface another tenant's events
      onEvent(e);
      changeListeners.forEach((l) => l(c));
    };
    return () => es.close();
  },

  onChange(l) {
    changeListeners.add(l);
    return () => changeListeners.delete(l);
  },
};
