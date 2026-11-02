import { motion } from 'motion/react';

const AGENTS = [
  { name: 'Order Router', failures: 184, repaired: 168, rate: 91.3 },
  { name: 'Invoice Clerk', failures: 156, repaired: 142, rate: 91.0 },
  { name: 'Support Desk', failures: 132, repaired: 115, rate: 87.1 },
  { name: 'Data Sync', failures: 98, repaired: 90, rate: 91.8 },
  { name: 'KYC Reviewer', failures: 76, repaired: 62, rate: 81.6 },
];

export function TopAgentsCard() {
  return (
    <div className="glass glass--strong card">
      <div className="card__head">
        <div>
          <div className="card__title">Top agents</div>
          <div className="card__sub">By failure volume</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {AGENTS.map((agent, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.5 }}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: '12px',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < AGENTS.length - 1 ? '1px solid var(--line)' : 'none',
            }}
          >
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 540, color: 'var(--text-1)' }}>{agent.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
                {agent.failures} failures · {agent.repaired} repaired
              </div>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 620, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>{agent.rate}%</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
