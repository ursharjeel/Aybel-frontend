import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'glass' | 'ghost' | 'ok' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
}

export function Button({ variant = 'glass', size = 'md', icon, iconOnly, loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, iconOnly && 'btn--icon', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle size={15} className="spin" /> : icon}
      {!iconOnly && children}
    </button>
  );
}
