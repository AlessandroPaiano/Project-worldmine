import { useState, useEffect, useRef } from 'react';
import type { Entity } from '../../lib/api';
import { useStore } from '../../store';
import { Trash, BookOpen, ScrollText } from 'lucide-react';
import TiptapEditor from '../editor/TiptapEditor';
import EntityRelations from './EntityRelations';
import EntityTags from './EntityTags';
import CharacterSheet from './CharacterSheet';

interface Props {
    entity: Entity;
    onClose: () => void;
}

type EditorTab = 'lore' | 'sheet';

// Compare entities ignoring DB-managed timestamp fields
function entityChanged(a: Entity, b: Entity): boolean {
    const { updated_at: _a, ...restA } = a as any;
    const { updated_at: _b, ...restB } = b as any;
    return JSON.stringify(restA) !== JSON.stringify(restB);
}

export default function EntityEditor({ entity: initialEntity, onClose }: Props) {
    const [entity, setEntity] = useState<Entity>(initialEntity);
    const saveEntity = useStore((state) => state.saveEntity);
    const deleteEntity = useStore((state) => state.deleteEntity);
    const folders = useStore((state) => state.folders);

    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<EditorTab>('lore');

    const isCharacter = entity.type === 'character';

    // Use a ref to track the "saved" version so store refetches don't re-trigger saves
    const savedEntityRef = useRef(initialEntity);

    // Only update local state if the initialEntity *id* changes
    useEffect(() => {
        setEntity(initialEntity);
        savedEntityRef.current = initialEntity;
        setActiveTab('lore');
    }, [initialEntity.id]);

    // Keep the ref up-to-date when the store refreshes (but don't trigger re-renders)
    useEffect(() => {
        savedEntityRef.current = initialEntity;
    }, [initialEntity]);

    // Debounced auto-save — only depends on entity, NOT on initialEntity
    useEffect(() => {
        if (!entityChanged(entity, savedEntityRef.current)) {
            return;
        }

        setIsSaving(true);
        const timeoutId = setTimeout(async () => {
            await saveEntity(entity);
            // After save, update the ref so subsequent comparisons succeed
            savedEntityRef.current = entity;
            setIsSaving(false);
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [entity, saveEntity]);

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this entity?')) {
            await deleteEntity(entity.id);
            onClose();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#181a1f] text-[#e0e3eb]">
            {/* Top Bar */}
            <div className="flex justify-between items-center px-6 pt-6 pb-2">
                <input
                    className="text-3xl font-bold bg-transparent border-none outline-none text-[#e0e3eb] placeholder-[#4a4d5e] w-full"
                    value={entity.name}
                    onChange={(e) => setEntity({ ...entity, name: e.target.value })}
                    placeholder="Entity Name"
                />
                <div className="flex items-center space-x-3 shrink-0">
                    {isSaving && <span className="text-xs text-[#8a8f98] font-medium tracking-wider animate-pulse">Saving...</span>}
                    <button onClick={handleDelete} className="p-2 border border-[#2d3036] rounded-md hover:bg-[#23252a] hover:text-red-400 transition" title="Delete Entity">
                        <Trash className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Tabs (only for characters) */}
            {isCharacter && (
                <div className="flex gap-1 px-6 pb-2">
                    <button
                        onClick={() => setActiveTab('lore')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'lore'
                            ? 'bg-[#23252a] text-[#74b1be] border border-[#74b1be]/30'
                            : 'text-[#8a8f98] hover:text-[#e0e3eb] hover:bg-[#23252a] border border-transparent'
                            }`}
                    >
                        <BookOpen className="w-4 h-4" />
                        Lore
                    </button>
                    <button
                        onClick={() => setActiveTab('sheet')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'sheet'
                            ? 'bg-[#23252a] text-[#74b1be] border border-[#74b1be]/30'
                            : 'text-[#8a8f98] hover:text-[#e0e3eb] hover:bg-[#23252a] border border-transparent'
                            }`}
                    >
                        <ScrollText className="w-4 h-4" />
                        Scheda D&D
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'sheet' && isCharacter ? (
                    <CharacterSheet entity={entity} onChange={setEntity} />
                ) : (
                    <div className="flex flex-col h-full px-6 pb-6 overflow-y-auto">
                        <div className="mb-4 flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs uppercase text-[#8a8f98] mb-1 tracking-wider font-semibold">Summary</label>
                                <textarea
                                    className="w-full bg-[#0f1115] border border-[#2d3036] rounded-md p-3 text-sm focus:border-[#74b1be] outline-none min-h-[80px]"
                                    value={entity.summary || ''}
                                    onChange={(e) => setEntity({ ...entity, summary: e.target.value })}
                                    placeholder="Brief summary..."
                                />
                            </div>
                            <div className="w-1/3">
                                <label className="block text-xs uppercase text-[#8a8f98] mb-1 tracking-wider font-semibold">Folder</label>
                                <select
                                    className="w-full bg-[#0f1115] border border-[#2d3036] rounded-md p-3 text-sm focus:border-[#74b1be] outline-none text-[#e0e3eb]"
                                    value={entity.folder_id || ''}
                                    onChange={(e) => setEntity({ ...entity, folder_id: e.target.value || undefined })}
                                >
                                    <option value="">Unsorted</option>
                                    {folders
                                        .filter(f => f.type === entity.type)
                                        .map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        <EntityTags entity={entity} />

                        <div className="mb-4 flex-1 flex flex-col">
                            <label className="block text-xs uppercase text-[#8a8f98] mb-1 tracking-wider font-semibold">Content</label>
                            <div className="flex-1 border border-[#2d3036] rounded-md bg-[#0f1115] p-3 overflow-hidden">
                                <TiptapEditor
                                    content={entity.content || ''}
                                    onChange={(html) => setEntity({ ...entity, content: html })}
                                />
                            </div>
                        </div>

                        <div className="h-64 flex-shrink-0 flex flex-col mt-4">
                            <EntityRelations entity={entity} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

