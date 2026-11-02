import { motion, type HTMLMotionProps } from 'motion/react';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type CardProps = Omit<HTMLMotionProps<'section'>, 'title'> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  lift?: boolean;
  strong?: boolean;
  /** stagger index for entrance animation */
  index?: number;
};

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { title, subtitle, actions, flush, lift, strong, index = 0, className, children, ...rest },
  ref,
) {
  return (
    <motion.section
      ref={ref}
      className={cn('glass card', flush && 'card--flush', lift && 'glass--lift', strong && 'glass--strong', className)}
      initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, delay: 0.04 + index * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
      {...rest}
    >
      {(title || actions) && (
        <header className="card__head">
          <div>
            {title && <h3 className="card__title">{title}</h3>}
            {subtitle && <p className="card__sub">{subtitle}</p>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      {children}
    </motion.section>
  );
});

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <motion.div
      className="ph"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div>
        {eyebrow && <div className="ph__eyebrow">{eyebrow}</div>}
        <h1 className="ph__title">{title}</h1>
        {description && <p className="ph__desc">{description}</p>}
      </div>
      {actions && <div className="toolbar">{actions}</div>}
    </motion.div>
  );
}
