import { useState } from 'react';
import type { Entity, Relation } from '../../lib/api';
import { useStore } from '../../store';
import { Plus, Trash } from 'lucide-react';

interface Props {
    entity: Entity;
}

export default function EntityRelations({ entity }: Props) {
    const relations = useStore((state) => state.relations);
    const entities = useStore((state) => state.entities);
    const saveRelation = useStore((state) => state.saveRelation);
    const deleteRelation = useStore((state) => state.deleteRelation);

    const [isAdding, setIsAdding] = useState(false);
    const [targetId, setTargetId] = useState('');
    const [relationType, setRelationType] = useState('');
    const [description, setDescription] = useState('');

    const entityRelations = relations.filter(r =>
        r.source_entity_id === entity.id || r.target_entity_id === entity.id
    );

    const handleAdd = async () => {
        if (!targetId || !relationType) return;

        const newRelation: Relation = {
            id: crypto.randomUUID(),
            source_entity_id: entity.id,
            target_entity_id: targetId,
            relation_type: relationType,
            description: description
        };

        await saveRelation(newRelation);
        setIsAdding(false);
        setTargetId('');
        setRelationType('');
        setDescription('');
    };

    return (
        <div className="mt-6 border-t border-[#2d3036] pt-6 flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm uppercase text-[#8a8f98] font-semibold tracking-wider">Relations</h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center space-x-1 text-xs text-[#74b1be] hover:text-white transition"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                </button>
            </div>

            {isAdding && (
                <div className="bg-[#23252a] p-3 rounded-md mb-4 border border-[#2d3036] space-y-3">
                    <select
                        className="w-full bg-[#0f1115] border border-[#2d3036] rounded-md p-2 text-sm text-[#e0e3eb] outline-none"
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                    >
                        <option value="">Select Target Entity...</option>
                        {entities.filter(e => e.id !== entity.id).map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.type})</option>
                        ))}
                    </select>

                    <input
                        className="w-full bg-[#0f1115] border border-[#2d3036] rounded-md p-2 text-sm text-[#e0e3eb] outline-none"
                        type="text"
                        placeholder="Relation Type (e.g., enemy, ally, location)"
                        value={relationType}
                        onChange={(e) => setRelationType(e.target.value)}
                    />

                    <input
                        className="w-full bg-[#0f1115] border border-[#2d3036] rounded-md p-2 text-sm text-[#e0e3eb] outline-none"
                        type="text"
                        placeholder="Description (Optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />

                    <div className="flex justify-end space-x-2">
                        <button onClick={() => setIsAdding(false)} className="text-xs text-[#8a8f98] hover:text-white">Cancel</button>
                        <button onClick={handleAdd} className="text-xs bg-[#74b1be] text-[#0f1115] px-3 py-1 rounded-md font-semibold hover:bg-opacity-80">Save</button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2">
                {entityRelations.map(rel => {
                    const isSource = rel.source_entity_id === entity.id;
                    const otherEntityId = isSource ? rel.target_entity_id : rel.source_entity_id;
                    const otherEntity = entities.find(e => e.id === otherEntityId);

                    if (!otherEntity) return null;

                    return (
                        <div key={rel.id} className="flex justify-between items-center bg-[#0f1115] p-3 rounded border border-[#2d3036]">
                            <div>
                                <div className="text-sm font-semibold text-[#e0e3eb]">
                                    {isSource ? 'Out' : 'In'}: <span className="text-[#74b1be]">{rel.relation_type}</span> {isSource ? 'to' : 'from'} {otherEntity.name}
                                </div>
                                {rel.description && <div className="text-xs text-[#8a8f98] mt-1">{rel.description}</div>}
                            </div>
                            <button onClick={() => deleteRelation(rel.id)} className="text-[#8a8f98] hover:text-red-400 p-1">
                                <Trash className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}
                {entityRelations.length === 0 && !isAdding && (
                    <div className="text-sm text-[#4a4d5e] text-center p-4">No relations yet.</div>
                )}
            </div>
        </div>
    );
}
