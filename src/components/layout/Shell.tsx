import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, Boxes, CheckCircle2, FileWarning, Layers } from 'lucide-react';

interface ShellProps {
  children: ReactNode;
}

const NAV = [
  { path: '/overview', label: 'Overview', Icon: Activity },
  { path: '/agents', label: 'Agents', Icon: Boxes },
  { path: '/tasks', label: 'Tasks', Icon: Layers },
  { path: '/incidents', label: 'Incidents', Icon: FileWarning },
  { path: '/corrections', label: 'Corrections', Icon: CheckCircle2 },
];

export function Shell({ children }: ShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__inner">
          <div className="sidebar__brand">
            <div className="brand">
              <div className="brand__mark" />
              <span className="brand__name">Aybel</span>
            </div>
          </div>

          <nav className="sidebar__nav">
            {NAV.map(({ path, label, Icon }) => (
              <NavLink key={path} to={path} className="nav-link">
                {({ isActive }) => (
                  <>
                    <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <main className="shell__main">
        <div className="shell__content">{children}</div>
      </main>
    </div>
  );
}
