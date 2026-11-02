import { motion } from 'motion/react';
import { Clock } from 'lucide-react';

const INCIDENTS = [
  { title: 'Schema mismatch in PO extraction', agent: 'Invoice Clerk', status: 'resolved', severity: 'high', time: '4m ago' },
  { title: 'Tool timeout: refund.issue', agent: 'Support Desk', status: 'verifying', severity: 'medium', time: '8m ago' },
  { title: 'Reasoning loop in order routing', agent: 'Order Router', status: 'needs_review', severity: 'critical', time: '12m ago' },
  { title: 'Ungrounded output in coverage check', agent: 'Claims Intake', status: 'resolved', severity: 'medium', time: '18m ago' },
];

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--text-1)',
  high: 'var(--text-1)',
  medium: 'var(--text-2)',
  low: 'var(--text-3)',
};

const STATUS_COLOR: Record<string, string> = {
  resolved: 'var(--text-1)',
  verifying: 'var(--text-2)',
  needs_review: 'var(--text-2)',
  investigating: 'var(--text-3)',
};

export function RecentIncidents() {
  return (
    <div className="glass glass--strong card">
      <div className="card__head">
        <div>
          <div className="card__title">Recent incidents</div>
          <div className="card__sub">Last 24 hours</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {INCIDENTS.map((incident, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            style={{
              padding: '12px',
              borderRadius: '10px',
              background: 'var(--glass-inset)',
              border: '1px solid var(--line)',
              cursor: 'pointer',
              transition: 'all 0.2s var(--ease)',
            }}
            whileHover={{ scale: 1.01, borderColor: 'var(--line-strong)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 540, color: 'var(--text-1)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {incident.title}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{incident.agent}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-3)' }}>
                <Clock size={12} />
                <span>{incident.time}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  color: SEVERITY_COLOR[incident.severity],
                  background: 'var(--glass-inset)',
                  border: '1px solid var(--line)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {incident.severity}
              </span>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  color: STATUS_COLOR[incident.status],
                  background: 'var(--glass-inset)',
                  border: '1px solid var(--line)',
                  textTransform: 'capitalize',
                }}
              >
                {incident.status.replace('_', ' ')}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
