import { motion } from 'motion/react';
import { useMemo } from 'react';

export function ActivityChart() {
  const data = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      label: `${i * 2}:00`,
      value: Math.floor(Math.random() * 80 + 20),
    }));
  }, []);

  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="glass glass--strong card">
      <div className="card__head">
        <div>
          <div className="card__title">Activity timeline</div>
          <div className="card__sub">Task volume last 24 hours</div>
        </div>
      </div>

      <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '0 4px' }}>
        {data.map((d, i) => {
          const height = (d.value / max) * 100;

          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <motion.div
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                style={{
                  height: `${height}%`,
                  width: '100%',
                  background: 'linear-gradient(180deg, var(--text-1) 0%, rgba(0, 0, 0, 0.3) 100%)',
                  borderRadius: '6px 6px 0 0',
                  transformOrigin: 'bottom',
                  position: 'relative',
                  border: '1px solid var(--line)',
                  borderBottom: 'none',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    opacity: 0.8,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {d.value}
                </div>
              </motion.div>
              <div style={{ fontSize: '10px', color: 'var(--text-4)', fontWeight: 500 }}>{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
