import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './views/Dashboard';
import EntityPage from './views/EntityPage';
import MapView from './views/MapView';
import GraphView from './views/GraphView';
import TimelineView from './views/TimelineView';
import DungeonEditor from './views/DungeonEditor';
import ExplorePopup from './components/ExplorePopup';

function App() {
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('worldmine-theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('worldmine-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <div className={`flex h-screen w-full font-sans selection:text-[#0f1115] ${
      theme === 'dark'
        ? 'bg-[#0f1115] text-[#e0e3eb] selection:bg-[#74b1be]'
        : 'bg-[#f0f2f5] text-[#1f2937] selection:bg-[#0d7c8c]'
    }`}>
      {/* Draggable Title Bar for Electron */}
      <div className="absolute top-0 left-0 right-0 h-8 flex items-center px-4" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className={`text-xs font-semibold tracking-wider ${theme === 'dark' ? 'text-[#8a8f98]' : 'text-[#6b7280]'}`}>PROJECT WORLDMINE</div>
      </div>

      {/* Sidebar Navigation */}
      <div className={`mt-8 z-10 flex border-r w-64 shrink-0 shadow-lg ${
        theme === 'dark'
          ? 'border-[#2d3036] bg-[#181a1f]'
          : 'border-[#d1d5db] bg-white'
      }`}>
        <Sidebar onOpenExplore={() => setIsExploreOpen(true)} theme={theme} onToggleTheme={toggleTheme} />
      </div>

      {/* Main Content Area */}
      <div className="mt-8 flex-1 overflow-hidden relative shadow-inner">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/entity/:id" element={<EntityPage />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/dungeon" element={<DungeonEditor />} />
          <Route path="/graph" element={<GraphView />} />
          <Route path="/timeline" element={<TimelineView />} />
          <Route path="/explore/:role/:id?" element={<ExplorePopup isOpen={true} onClose={() => {}} />} />
        </Routes>
      </div>

      {/* Exploration Popup */}
      <ExplorePopup isOpen={isExploreOpen} onClose={() => setIsExploreOpen(false)} />
    </div>
  );
}

export default App;
