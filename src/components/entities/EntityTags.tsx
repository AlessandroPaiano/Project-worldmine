import { useState } from 'react';
import type { Entity } from '../../lib/api';
import { useStore } from '../../store';
import { X, Plus } from 'lucide-react';

interface Props {
    entity: Entity;
}

export default function EntityTags({ entity }: Props) {
    const [inputValue, setInputValue] = useState('');
    const tags = useStore(state => state.tags);
    const entityTags = useStore(state => state.entityTags);
    const addEntityTag = useStore(state => state.addEntityTag);
    const removeEntityTag = useStore(state => state.removeEntityTag);

    // Get tags currently assigned to this entity
    const assignedTagIds = entityTags.filter(et => et.entity_id === entity.id).map(et => et.tag_id);
    const assignedTags = tags.filter(t => assignedTagIds.includes(t.id));

    const handleAddTag = async (e: React.FormEvent) => {
        e.preventDefault();
        const value = inputValue.trim().toLowerCase();
        if (!value) return;

        await addEntityTag(entity.id, value);
        setInputValue('');
    };

    const handleRemoveTag = async (tagId: string) => {
        await removeEntityTag(entity.id, tagId);
    };

    return (
        <div className="mb-4">
            <label className="block text-xs uppercase text-[#8a8f98] mb-1 tracking-wider font-semibold">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
                {assignedTags.map(tag => (
                    <span key={tag.id} className="inline-flex items-center px-2 py-1 bg-[#23252a] text-[#74b1be] text-xs font-semibold rounded border border-[#2d3036]">
                        #{tag.name}
                        <button
                            onClick={() => handleRemoveTag(tag.id)}
                            className="ml-1 text-[#8a8f98] hover:text-red-400 focus:outline-none"
                            title={`Remove #${tag.name}`}
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>

            <form onSubmit={handleAddTag} className="flex relative">
                <input
                    type="text"
                    className="w-full bg-[#0f1115] border border-[#2d3036] rounded-md p-2 pl-3 pr-8 text-sm focus:border-[#74b1be] outline-none text-[#e0e3eb] placeholder-[#4a4d5e]"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder="Add a tag and press Enter..."
                />
                <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8a8f98] hover:text-[#74b1be] transition"
                    disabled={!inputValue.trim()}
                >
                    <Plus className="w-4 h-4" />
                </button>
            </form>

            {/* Tag Suggestions drop-down could go here ideally, but simple input works for MVP */}
        </div>
    );
}
