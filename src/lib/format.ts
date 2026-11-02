export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

export const fmtCompact = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : fmtInt(n);

export const fmtPct = (r: number, d = 1) => (r * 100).toFixed(d) + '%';

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtAgo(iso: string, now = Date.now()): string {
  const d = Math.max(0, now - new Date(iso).getTime()) / 1000;
  if (d < 45) return 'just now';
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso: string, withTime = true): string {
  const d = new Date(iso);
  const date = `${d.getDate()} ${MON[d.getMonth()]}`;
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export function fmtAxis(iso: string, range: '24h' | '7d' | '30d'): string {
  const d = new Date(iso);
  if (range === '24h') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}

export const signed = (n: number, d = 1) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d);
