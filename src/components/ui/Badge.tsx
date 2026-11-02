import { FlaskConical } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { api, type Capabilities } from '../../api';
import { toneSoftVar, toneVar, type Tone } from '../../domain/meta';
import { cn } from '../../lib/cn';

export function Badge({ tone = 'neutral', dot, pulse, size, outline, children, className }: { tone?: Tone; dot?: boolean; pulse?: boolean; size?: 'lg'; outline?: boolean; children: ReactNode; className?: string }) {
  const style = { '--tone': toneVar(tone), '--tone-soft': toneSoftVar(tone) } as CSSProperties;
  return (
    <span className={cn('badge', size === 'lg' && 'badge--lg', outline && 'badge--outline', className)} style={style}>
      {dot && <i className={cn('dot', pulse && 'dot--pulse')} />}
      {children}
    </span>
  );
}

export function Dot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  return <i className={cn('dot', pulse && 'dot--pulse')} style={{ '--tone': toneVar(tone) } as CSSProperties} />;
}

/**
 * Marks functionality that is simulated in this build. Driven by the API's
 * capability map, so it disappears automatically once a real backend backs it.
 */
export function SimBadge({ feature, label = 'Simulated' }: { feature: keyof Capabilities; label?: string }) {
  if (api.capabilities[feature] !== 'simulated') return null;
  return (
    <span className="sim" title="This runs in-browser against mock data. No real systems are called.">
      <FlaskConical size={11} strokeWidth={2.4} />
      {label}
    </span>
  );
}
