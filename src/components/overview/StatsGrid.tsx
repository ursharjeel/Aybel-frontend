import { Activity, TrendingUp, TrendingDown, Wrench, Clock } from 'lucide-react';
import { animate, motion } from 'motion/react';
import { useEffect, useRef } from 'react';

interface StatCardProps {
  label: string;
  value: number;
  unit?: string;
  delta: number;
  format?: (n: number) => string;
  icon: React.ReactNode;
}

function StatCard({ label, value, unit = '', delta, format = (n) => n.toLocaleString(), icon }: StatCardProps) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const deltaRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (valueRef.current) {
      const controls = animate(0, value, {
        duration: 1.8,
        ease: [0.34, 1.56, 0.64, 1],
        onUpdate: (v) => {
          if (valueRef.current) valueRef.current.textContent = format(Math.round(v));
        },
      });
      return () => controls.stop();
    }
  }, [value, format]);

  useEffect(() => {
    if (deltaRef.current) {
      const controls = animate(0, Math.abs(delta), {
        duration: 1.5,
        ease: 'easeOut',
        onUpdate: (v) => {
          if (deltaRef.current) deltaRef.current.textContent = `${Math.round(v)}%`;
        },
      });
      return () => controls.stop();
    }
  }, [delta]);

  const isPositive = delta > 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <motion.div
      className="glass glass--strong card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ fontSize: '11.5px', fontWeight: 640, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.01em' }}>
          {icon}
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 640, color: isPositive ? 'var(--ok)' : 'var(--err)' }}>
          <TrendIcon size={13} strokeWidth={2.5} />
          <span ref={deltaRef}>0%</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '34px', fontWeight: 720, letterSpacing: '-0.042em', color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
          <span ref={valueRef}>0</span>
        </span>
        {unit && <span style={{ fontSize: '15px', fontWeight: 580, color: 'var(--text-3)' }}>{unit}</span>}
      </div>
    </motion.div>
  );
}

export function StatsGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
      <StatCard label="Tasks" value={8247} delta={12.4} icon={<Activity size={16} />} />
      <StatCard label="Failure rate" value={8.2} unit="%" delta={-2.1} format={(n) => (n / 10).toFixed(1)} icon={<Activity size={16} />} />
      <StatCard label="Auto-repaired" value={89.3} unit="%" delta={3.8} format={(n) => (n / 10).toFixed(1)} icon={<Wrench size={16} />} />
      <StatCard label="MTTR" value={4.2} unit="min" delta={-18} format={(n) => (n / 10).toFixed(1)} icon={<Clock size={16} />} />
    </div>
  );
}
