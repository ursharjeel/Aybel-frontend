import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { Overview } from './pages/Overview';
import { Agents } from './pages/Agents';
import { Tasks } from './pages/Tasks';
import { Incidents } from './pages/Incidents';
import { Corrections } from './pages/Corrections';
import { Wallpaper } from './components/layout/Wallpaper';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

export default function App() {
  return (
    <BrowserRouter>
      <Wallpaper />
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/corrections" element={<Corrections />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
