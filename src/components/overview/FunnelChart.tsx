import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

const STEPS = [
  { stage: 'Detect', label: 'Failure detected', count: 680 },
  { stage: 'Investigate', label: 'Root cause analysis', count: 672 },
  { stage: 'Repair', label: 'Fix generated', count: 652 },
  { stage: 'Verify', label: 'Test & validate', count: 607 },
  { stage: 'Review', label: 'Human review', count: 74 },
  { stage: 'Store', label: 'Saved for training', count: 607 },
];

export function FunnelChart() {
  return (
    <div className="glass glass--strong card">
      <div className="card__head">
        <div>
          <div className="card__title">Repair workflow</div>
          <div className="card__sub">Auto-recovery pipeline stages</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 0' }}>
        {STEPS.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                border: '1.5px solid var(--line-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11.5px',
                fontWeight: 700,
                color: 'var(--text-1)',
                background: 'var(--glass-inset)',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 540, color: 'var(--text-1)' }}>{step.stage}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '1px' }}>{step.label}</div>
            </div>

            <div
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-2)',
                fontVariantNumeric: 'tabular-nums',
                minWidth: '48px',
                textAlign: 'right',
              }}
            >
              {step.count.toLocaleString()}
            </div>

            {i < STEPS.length - 1 && (
              <ArrowRight size={14} strokeWidth={2} style={{ color: 'var(--text-4)', marginLeft: '-4px', marginRight: '-4px' }} />
            )}
          </motion.div>
        ))}
      </div>

      <div
        style={{
          marginTop: '12px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'var(--glass-inset)',
          border: '1px solid var(--line)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: 'var(--text-2)',
        }}
      >
        <CheckCircle2 size={15} strokeWidth={2} />
        <span>
          <strong style={{ fontWeight: 600, color: 'var(--text-1)' }}>89.3%</strong> auto-repair success rate
        </span>
      </div>
    </div>
  );
}
