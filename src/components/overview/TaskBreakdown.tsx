import { motion } from 'motion/react';

const CATEGORIES = [
  { label: 'Invoice processing', value: 1847, percentage: 28 },
  { label: 'Order routing', value: 1524, percentage: 23 },
  { label: 'Support tickets', value: 1314, percentage: 20 },
  { label: 'Data sync', value: 1051, percentage: 16 },
  { label: 'KYC reviews', value: 856, percentage: 13 },
];

export function TaskBreakdown() {
  return (
    <div className="glass glass--strong card">
      <div className="card__head">
        <div>
          <div className="card__title">Task breakdown</div>
          <div className="card__sub">By workflow type</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 0' }}>
        {CATEGORIES.map((cat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 540, color: 'var(--text-2)' }}>{cat.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                  {cat.value.toLocaleString()}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 640, color: 'var(--text-1)', minWidth: '38px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {cat.percentage}%
                </span>
              </div>
            </div>
            <div style={{ height: '6px', background: 'var(--glass-inset)', borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--line)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${cat.percentage}%` }}
                transition={{ delay: i * 0.06 + 0.15, duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                style={{
                  height: '100%',
                  background: 'var(--text-1)',
                  borderRadius: '999px',
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
