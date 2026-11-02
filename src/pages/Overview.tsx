import { Player } from '@remotion/player';
import { StatsGrid } from '../components/overview/StatsGrid';
import { FunnelChart } from '../components/overview/FunnelChart';
import { TimelineChart } from '../components/overview/TimelineChart';
import { ActivityChart } from '../components/overview/ActivityChart';
import { TaskBreakdown } from '../components/overview/TaskBreakdown';
import { TopAgentsCard } from '../components/overview/TopAgentsCard';
import { RecentIncidents } from '../components/overview/RecentIncidents';

export function Overview() {
  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph__eyebrow">
            <span>Workspace</span>
            <span className="sim">Mock data</span>
          </div>
          <h1 className="ph__title">Overview</h1>
          <p className="ph__desc">
            Real-time monitoring of agentic workflows, auto-repair performance, and failure patterns.
          </p>
        </div>
      </div>

      <StatsGrid />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
        <TimelineChart />
        <TaskBreakdown />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        <ActivityChart />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
        <FunnelChart />
        <TopAgentsCard />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        <RecentIncidents />
      </div>
    </div>
  );
}
