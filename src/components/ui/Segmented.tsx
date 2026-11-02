import { LayoutGroup, motion } from 'motion/react';
import { useId, type ReactNode } from 'react';

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** Sliding-pill segmented control (pattern from Remotion Studio's SegmentedControl). */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: SegOption<T>[]; value: T; onChange: (v: T) => void; label?: string }) {
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" className="seg__btn" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.value === value && <motion.span layoutId="pill" className="seg__pill" transition={{ type: 'spring', stiffness: 480, damping: 36 }} />}
            {o.label}
            {o.count !== undefined && <span className="seg__count">{o.count}</span>}
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}
