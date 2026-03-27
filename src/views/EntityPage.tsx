import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../store';
import type { Entity, Folder } from '../lib/api';
import EntityEditor from '../components/entities/EntityEditor';
import { Plus, Folder as FolderIcon, FolderOpen, FileText, ChevronRight, ChevronDown } from 'lucide-react';

export default function EntityPage() {
    const { id } = useParams(); // 'characters', 'places', etc.
    const typeMap: Record<string, Entity['type']> = {
        characters: 'character',
        places: 'place',
        factions: 'faction',
        events: 'event',
    };
    const entityType = typeMap[id || ''] || 'character';

    const entities = useStore((state) => state.entities);
    const folders = useStore((state) => state.folders);
    const fetchEntities = useStore((state) => state.fetchEntities);
    const fetchFolders = useStore((state) => state.fetchFolders);
    const saveEntity = useStore((state) => state.saveEntity);
    const saveFolder = useStore((state) => state.saveFolder);
    const deleteFolder = useStore((state) => state.deleteFolder);
    const loading = useStore((state) => state.loading);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [newFolderName, setNewFolderName] = useState<string | null>(null);

    useEffect(() => {
        fetchEntities();
        fetchFolders();
    }, [fetchEntities, fetchFolders]);

    const filteredEntities = entities.filter(e => e.type === entityType);
    const filteredFolders = folders.filter(f => f.type === entityType);
    const selectedEntity = entities.find(e => e.id === selectedId);

    const handleCreateNew = async () => {
        const newId = crypto.randomUUID();
        const newEntity: Entity = {
            id: newId,
            name: 'New ' + entityType,
            type: entityType,
            slug: newId,
        };
        try {
            await saveEntity(newEntity);
            setSelectedId(newId);
        } catch (err) {
            console.error('Failed to create new entity:', err);
        }
    };

    const handleCreateFolder = () => {
        setNewFolderName('');
    };

    const handleConfirmFolder = async () => {
        if (!newFolderName?.trim()) {
            setNewFolderName(null);
            return;
        }
        const newId = crypto.randomUUID();
        const newFolder: Folder = {
            id: newId,
            name: newFolderName.trim(),
            type: entityType,
        };
        try {
            await saveFolder(newFolder);
            toggleFolder(newId);
        } catch (err) {
            console.error('Failed to create folder:', err);
        }
        setNewFolderName(null);
    };

    const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await deleteFolder(folderId);
    };

    const toggleFolder = (folderId: string) => {
        const next = new Set(expandedFolders);
        if (next.has(folderId)) {
            next.delete(folderId);
        } else {
            next.add(folderId);
        }
        setExpandedFolders(next);
    };

    const renderEntityList = (folderId: string | undefined | null) => {
        // Group items that belong to this exact folderId (null matches unset folder_id)
        const items = filteredEntities.filter(e => {
            if (!folderId) return !e.folder_id;
            return e.folder_id === folderId;
        });

        return items.map((entity: Entity) => (
            <div
                key={entity.id}
                onClick={() => setSelectedId(entity.id)}
                className={`pl-6 pr-3 py-1.5 flex items-center gap-2 cursor-pointer rounded-md text-sm truncate transition ${selectedId === entity.id
                    ? 'bg-[#23252a] text-[#74b1be] border border-[#2d3036]'
                    : 'text-[#8a8f98] hover:bg-[#181a1f] hover:text-[#e0e3eb] border border-transparent'
                    }`}
            >
                <FileText className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <span className="truncate">{entity.name}</span>
            </div>
        ));
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* List Panel */}
            <div className="w-80 border-r border-[#2d3036] bg-[#0f1115] flex flex-col">
                <div className="p-4 border-b border-[#2d3036] flex justify-between items-center shrink-0">
                    <h2 className="text-lg font-bold text-[#e0e3eb] capitalize border-[#2d3036]">{id}</h2>
                    <div className="flex gap-2">
                        <button onClick={handleCreateFolder} className="p-1.5 bg-[#23252a] hover:bg-[#2d3036] rounded text-[#8a8f98] hover:text-[#e0e3eb] transition" title="Create Folder">
                            <FolderIcon className="w-4 h-4" />
                        </button>
                        <button onClick={handleCreateNew} className="p-1.5 bg-[#23252a] hover:bg-[#2d3036] rounded text-[#74b1be] transition" title="Create Entity">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading && <div className="text-sm text-[#4a4d5e] p-4 text-center">Loading...</div>}

                    {!loading && (
                        <>
                            {/* Inline new folder input */}
                            {newFolderName !== null && (
                                <div className="flex items-center gap-1 px-2 py-1.5 mb-1">
                                    <input
                                        autoFocus
                                        className="flex-1 bg-[#0f1115] border border-[#74b1be] rounded px-2 py-1 text-sm text-[#e0e3eb] outline-none"
                                        value={newFolderName}
                                        onChange={e => setNewFolderName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleConfirmFolder(); if (e.key === 'Escape') setNewFolderName(null); }}
                                        placeholder="Folder name..."
                                    />
                                    <button onClick={handleConfirmFolder} className="text-xs text-[#74b1be] hover:text-[#9ed0db] font-medium px-1">✓</button>
                                    <button onClick={() => setNewFolderName(null)} className="text-xs text-[#8a8f98] hover:text-red-400 font-medium px-1">✕</button>
                                </div>
                            )}

                            {/* Render Folders (Root Level) */}
                            {filteredFolders.filter(f => !f.parent_id).map(folder => {
                                const isExpanded = expandedFolders.has(folder.id);
                                return (
                                    <div key={folder.id} className="space-y-1">
                                        <div
                                            className="flex items-center justify-between px-2 py-1.5 text-sm text-[#e0e3eb] hover:bg-[#181a1f] rounded cursor-pointer group"
                                            onClick={() => toggleFolder(folder.id)}
                                        >
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-[#8a8f98]" /> : <ChevronRight className="w-4 h-4 text-[#8a8f98]" />}
                                                {isExpanded ? <FolderOpen className="w-4 h-4 text-[#74b1be]" /> : <FolderIcon className="w-4 h-4 text-[#74b1be]" />}
                                                <span className="font-medium truncate">{folder.name}</span>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteFolder(folder.id, e)}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 text-[#8a8f98] hover:text-red-400 transition"
                                                title="Delete Folder"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                        {/* Render Entities inside this folder explicitly */}
                                        {isExpanded && (
                                            <div className="pl-2 space-y-0.5 border-l border-[#2d3036] ml-4 mt-1">
                                                {renderEntityList(folder.id)}
                                                {filteredEntities.filter(e => e.folder_id === folder.id).length === 0 && (
                                                    <div className="pl-6 py-1 text-xs text-[#4a4d5e] italic">Empty</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <div className="my-2 border-t border-[#2d3036] opacity-50"></div>

                            {/* Render Unassigned Entities */}
                            <div className="text-xs font-semibold text-[#4a4d5e] px-2 pt-2 pb-1 uppercase tracking-wider">
                                Unsorted
                            </div>
                            {renderEntityList(null)}
                            {filteredEntities.filter(e => !e.folder_id).length === 0 && (
                                <div className="text-xs text-[#4a4d5e] pl-2 italic">No unsorted entities.</div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Editor Panel */}
            <div className="flex-1 bg-[#181a1f] overflow-hidden">
                {selectedEntity ? (
                    <EntityEditor entity={selectedEntity} onClose={() => setSelectedId(null)} />
                ) : (
                    <div className="h-full flex items-center justify-center text-[#4a4d5e]">
                        Select an entity or create a new one.
                    </div>
                )}
            </div>
        </div>
    );
}
