import { motion } from 'motion/react';
import { useMemo } from 'react';

export function TimelineChart() {
  const stats = [
    { label: 'Success rate', value: 89.3, target: 95 },
    { label: 'Uptime', value: 99.7, target: 99.9 },
    { label: 'Avg response', value: 847, unit: 'ms', max: 1000 },
  ];

  return (
    <div className="glass glass--strong card">
      <div className="card__head">
        <div>
          <div className="card__title">Performance metrics</div>
          <div className="card__sub">Real-time system health</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', padding: '16px 0' }}>
        {stats.map((stat, i) => {
          const percentage = stat.max ? ((stat.max - stat.value) / stat.max) * 100 : stat.value;
          const circumference = 2 * Math.PI * 45;
          const offset = circumference - (percentage / 100) * circumference;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
            >
              <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="var(--glass-inset)" strokeWidth="8" />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="var(--text-1)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ delay: i * 0.1 + 0.2, duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                    {stat.value}
                    {stat.unit || '%'}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 540, color: 'var(--text-2)', textAlign: 'center' }}>{stat.label}</div>
                {stat.target && (
                  <div style={{ fontSize: '11px', color: 'var(--text-4)', textAlign: 'center', marginTop: '2px' }}>Target: {stat.target}%</div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
