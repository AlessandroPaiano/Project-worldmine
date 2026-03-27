import { NavLink } from 'react-router-dom';
import { Home, Users, Map as MapIcon, GitCommit, Calendar, Globe, Flag, Swords, Compass, Sun, Moon } from 'lucide-react';

const navItems = [
    { path: '/', label: 'Overview', icon: Home },
    { path: '/entity/characters', label: 'Characters', icon: Users },
    { path: '/entity/places', label: 'Places', icon: Globe },
    { path: '/entity/factions', label: 'Factions', icon: Flag },
    { path: '/entity/events', label: 'Events', icon: Calendar },
    { path: '/map', label: 'World Map', icon: Globe },
    { path: '/dungeon', label: 'Dungeon Maps', icon: MapIcon },
    { path: '/graph', label: 'Graph View', icon: GitCommit },
    { path: '/timeline', label: 'Timeline', icon: Calendar },
];

interface SidebarProps {
    onOpenExplore: () => void;
    theme: 'dark' | 'light';
    onToggleTheme: () => void;
}

export default function Sidebar({ onOpenExplore, theme, onToggleTheme }: SidebarProps) {
    const isDark = theme === 'dark';

    return (
        <div className={`flex flex-col h-full w-full p-4 ${isDark ? 'bg-[#181a1f] text-[#8a8f98]' : 'bg-white text-[#6b7280]'}`}>
            <div className="mb-8 px-2 flex items-center space-x-3">
                <Swords className={`w-6 h-6 ${isDark ? 'text-[#74b1be]' : 'text-[#0d7c8c]'}`} />
                <h1 className={`text-xl font-bold tracking-wide ${isDark ? 'text-[#e0e3eb]' : 'text-[#1f2937]'}`}>Worldmine</h1>
            </div>

            <nav className="flex-1 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${isActive
                                ? isDark
                                    ? 'bg-[#23252a] text-[#74b1be] shadow-sm'
                                    : 'bg-[#e8eaed] text-[#0d7c8c] shadow-sm'
                                : isDark
                                    ? 'hover:bg-[#23252a] hover:text-[#e0e3eb]'
                                    : 'hover:bg-[#f3f4f6] hover:text-[#1f2937]'
                            }`
                        }
                    >
                        <item.icon className="w-4 h-4" />
                        <span className="font-medium text-sm">{item.label}</span>
                    </NavLink>
                ))}

                {/* Explore Mode Button */}
                <div className={`pt-3 mt-3 border-t ${isDark ? 'border-[#2d3036]' : 'border-[#d1d5db]'}`}>
                    <button
                        onClick={onOpenExplore}
                        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all group border ${
                            isDark
                                ? 'bg-gradient-to-r from-[#74b1be]/10 to-[#10b981]/10 hover:from-[#74b1be]/20 hover:to-[#10b981]/20 text-[#74b1be] hover:text-white border-[#74b1be]/20 hover:border-[#74b1be]/40'
                                : 'bg-gradient-to-r from-[#0d7c8c]/10 to-[#10b981]/10 hover:from-[#0d7c8c]/20 hover:to-[#10b981]/20 text-[#0d7c8c] hover:text-[#065f6b] border-[#0d7c8c]/20 hover:border-[#0d7c8c]/40'
                        }`}
                    >
                        <Compass className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
                        <span className="font-semibold text-sm">Explore Mode</span>
                    </button>
                </div>
            </nav>

            {/* Theme Toggle & Status */}
            <div className={`mt-auto py-4 px-2 border-t ${isDark ? 'border-[#2d3036]' : 'border-[#d1d5db]'} flex items-center justify-between`}>
                <div className="text-xs">
                    Status: <span className="text-emerald-500">Online</span>
                </div>
                <button
                    onClick={onToggleTheme}
                    className={`p-2 rounded-lg transition-all ${
                        isDark
                            ? 'hover:bg-[#23252a] text-[#f59e0b]'
                            : 'hover:bg-[#e8eaed] text-[#6366f1]'
                    }`}
                    title={isDark ? 'Switch to Day Mode' : 'Switch to Night Mode'}
                >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}
