import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Calendar, Save } from 'lucide-react';

export default function TimelineView() {
    const fetchEvents = useStore(state => state.fetchEvents);
    const apiEvents = useStore(state => state.events);
    const saveEventDate = useStore(state => state.saveEventDate);

    // We also need entities to show events that don't have a date yet
    const entities = useStore(state => state.entities);
    const eventEntities = entities.filter(e => e.type === 'event');

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState<string>('');

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const handleSaveDate = async (entityId: string) => {
        const num = parseInt(editDate, 10);
        if (!isNaN(num)) {
            await saveEventDate(entityId, num);
        }
        setEditingId(null);
    };

    // Merge entity data with timeline dates and sort
    const timelineItems = eventEntities.map(entity => {
        const dbEvent = apiEvents.find(e => e.entity_id === entity.id);
        return {
            ...entity,
            numeric_date: dbEvent?.numeric_date ?? null
        };
    }).sort((a, b) => {
        const dateA = a.numeric_date ?? Number.MAX_SAFE_INTEGER;
        const dateB = b.numeric_date ?? Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
    });

    return (
        <div className="w-full h-full p-8 overflow-y-auto bg-[#0f1115]">
            <header className="mb-12">
                <h1 className="text-3xl font-bold text-[#e0e3eb]">Historical Timeline</h1>
                <p className="text-[#8a8f98]">Chronological view of your world's history.</p>
            </header>

            <div className="max-w-3xl mx-auto">
                {timelineItems.length === 0 ? (
                    <div className="text-center p-12 border border-[#2d3036] rounded-xl bg-[#181a1f]">
                        <Calendar className="w-12 h-12 text-[#4a4d5e] mx-auto mb-4" />
                        <h3 className="text-xl font-medium text-[#e0e3eb] mb-2">No Events Found</h3>
                        <p className="text-[#8a8f98]">Create entities of type 'Event' to populate the timeline.</p>
                    </div>
                ) : (
                    <div className="relative border-l-2 border-[#2d3036] pl-8 space-y-12 ml-4">
                        {timelineItems.map((evt) => (
                            <div key={evt.id} className="relative group">
                                <div className={`absolute -left-[41px] w-5 h-5 bg-[#23252a] border-4 border-[#0f1115] rounded-full transition-colors shadow-sm ${evt.numeric_date !== null ? 'group-hover:bg-[#74b1be]' : ''}`} />
                                <div className="bg-[#181a1f] border border-[#2d3036] rounded-xl p-6 shadow-md transition-all group-hover:-translate-y-1 group-hover:border-[#4a4d5e]">

                                    <div className="flex justify-between items-start mb-2">
                                        {/* Date Display / Edit */}
                                        {editingId === evt.id ? (
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="number"
                                                    value={editDate}
                                                    onChange={e => setEditDate(e.target.value)}
                                                    placeholder="Year (e.g. 1000)"
                                                    className="bg-[#0f1115] border border-[#74b1be] text-white px-2 py-1 rounded text-sm w-32 outline-none"
                                                    autoFocus
                                                />
                                                <button onClick={() => handleSaveDate(evt.id)} className="text-[#74b1be] hover:text-white">
                                                    <Save className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div
                                                className="text-xs font-bold text-[#74b1be] uppercase tracking-wider cursor-pointer hover:text-white"
                                                onClick={() => {
                                                    setEditingId(evt.id);
                                                    setEditDate(evt.numeric_date ? evt.numeric_date.toString() : '');
                                                }}
                                                title="Click to edit year"
                                            >
                                                {evt.numeric_date !== null ? `Year ${evt.numeric_date}` : 'Set Date...'}
                                            </div>
                                        )}

                                        {/* Entity Link */}
                                        <button
                                            onClick={() => window.location.hash = `#/entity/events?id=${evt.id}`}
                                            className="text-xs text-[#8a8f98] hover:text-[#74b1be]"
                                        >
                                            View Entity
                                        </button>
                                    </div>

                                    <h3 className="text-xl font-bold text-[#e0e3eb] mb-2">{evt.name}</h3>
                                    <p className="text-[#8a8f98] text-sm leading-relaxed">
                                        {evt.summary || 'No summary available.'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
