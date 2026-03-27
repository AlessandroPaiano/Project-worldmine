import { Users, Globe, Flag, Calendar, Clock, ArrowRight } from 'lucide-react';
import { useStore } from '../store';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
    const entities = useStore(state => state.entities);
    const fetchEntities = useStore(state => state.fetchEntities);

    useEffect(() => {
        fetchEntities();
    }, [fetchEntities]);

    const characters = entities.filter(e => e.type === 'character').length;
    const places = entities.filter(e => e.type === 'place').length;
    const factions = entities.filter(e => e.type === 'faction').length;
    const events = entities.filter(e => e.type === 'event').length;

    // Sort by updated_at (newest first). Handle missing updated_at gracefully
    const recentEntities = [...entities].sort((a, b) => {
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return timeB - timeA;
    }).slice(0, 5);

    return (
        <div className="p-8 h-full overflow-y-auto bg-[#0f1115]">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-[#e0e3eb] mb-2">Welcome to your World</h1>
                <p className="text-[#8a8f98]">Here is an overview of what you've built so far.</p>
            </header>

            <div className="grid grid-cols-4 gap-6 mb-12">
                <StatCard title="Characters" count={characters} icon={Users} color="text-emerald-400" />
                <StatCard title="Places" count={places} icon={Globe} color="text-blue-400" />
                <StatCard title="Factions" count={factions} icon={Flag} color="text-red-400" />
                <StatCard title="Events" count={events} icon={Calendar} color="text-purple-400" />
            </div>

            <div className="grid grid-cols-2 gap-8">
                <div className="bg-[#181a1f] border border-[#2d3036] rounded-xl p-6 shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 text-[#e0e3eb]">Recently Edited</h2>
                    <div className="space-y-3">
                        {recentEntities.length === 0 ? (
                            <div className="text-[#8a8f98] text-sm">No recent entities found.</div>
                        ) : (
                            recentEntities.map(entity => (
                                <Link
                                    key={entity.id}
                                    to={`/entity/${entity.type}s?id=${entity.id}`}
                                    className="flex items-center justify-between p-3 rounded bg-[#23252a] hover:bg-[#2d3036] transition border border-transparent hover:border-[#74b1be] group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-[#181a1f] flex items-center justify-center text-[#74b1be]">
                                            {entity.type === 'character' && <Users className="w-4 h-4" />}
                                            {entity.type === 'place' && <Globe className="w-4 h-4" />}
                                            {entity.type === 'faction' && <Flag className="w-4 h-4" />}
                                            {entity.type === 'event' && <Calendar className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <div className="text-[#e0e3eb] font-medium">{entity.name}</div>
                                            <div className="text-[#8a8f98] text-xs capitalize">{entity.type}</div>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-[#4a4d5e] group-hover:text-[#74b1be] transition" />
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-[#181a1f] border border-[#2d3036] rounded-xl p-6 shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 text-[#e0e3eb]">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <Link to="/map" className="p-4 rounded-lg bg-[#23252a] hover:bg-[#2d3036] border border-[#2d3036] hover:border-[#74b1be] transition flex flex-col items-center justify-center gap-2 group">
                            <Globe className="w-6 h-6 text-[#4a4d5e] group-hover:text-[#74b1be]" />
                            <span className="text-[#e0e3eb] text-sm font-medium">Interactive Map</span>
                        </Link>
                        <Link to="/graph" className="p-4 rounded-lg bg-[#23252a] hover:bg-[#2d3036] border border-[#2d3036] hover:border-[#74b1be] transition flex flex-col items-center justify-center gap-2 group">
                            <Users className="w-6 h-6 text-[#4a4d5e] group-hover:text-[#74b1be]" />
                            <span className="text-[#e0e3eb] text-sm font-medium">Relations Graph</span>
                        </Link>
                        <Link to="/timeline" className="p-4 rounded-lg bg-[#23252a] hover:bg-[#2d3036] border border-[#2d3036] hover:border-[#74b1be] transition flex flex-col items-center justify-center gap-2 group">
                            <Clock className="w-6 h-6 text-[#4a4d5e] group-hover:text-[#74b1be]" />
                            <span className="text-[#e0e3eb] text-sm font-medium">Timeline View</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, count, icon: Icon, color }: any) {
    return (
        <div className="bg-[#181a1f] border border-[#2d3036] rounded-xl p-5 shadow-sm transition hover:border-[#74b1be] flex items-center shrink-0 group">
            <div className={`p-3 rounded-lg bg-[#23252a] ${color} mr-4 group-hover:bg-[#2d3036] transition-colors`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-[#8a8f98] text-sm font-medium">{title}</p>
                <p className="text-2xl font-bold text-[#e0e3eb]">{count}</p>
            </div>
        </div>
    );
}
