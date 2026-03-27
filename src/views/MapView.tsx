import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, ImageOverlay, CircleMarker, Polygon, Popup, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStore } from '../store';
import type { MapMarker } from '../lib/api';
import { Plus, Trash2, MapPin, Layers, Upload, X, ChevronRight, PenTool, MousePointer } from 'lucide-react';

// Default world map image
const DEFAULT_MAP_IMAGE = '/maps/world_map.webp';

// Color palette for markers
const MARKER_COLORS = [
    '#74b1be', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

function getEntityColor(entityId: string | null): string {
    if (!entityId) return MARKER_COLORS[0];
    let hash = 0;
    for (let i = 0; i < entityId.length; i++) {
        hash = entityId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return MARKER_COLORS[Math.abs(hash) % MARKER_COLORS.length];
}

// Interaction modes
type MapMode = 'select' | 'marker' | 'area';

// Map interaction component
function MapClickEvents({ mode, onMapClick, onMapRightClick }: {
    mode: MapMode;
    onMapClick: (e: L.LeafletMouseEvent) => void;
    onMapRightClick: (e: L.LeafletMouseEvent) => void;
}) {
    useMapEvents({
        click: (e) => {
            if (mode !== 'select') onMapClick(e);
        },
        contextmenu: (e) => {
            onMapRightClick(e);
        },
    });
    return null;
}

// Component to reset map view when switching maps
function MapBoundsUpdater({ bounds }: { bounds: L.LatLngBoundsExpression }) {
    const map = useMap();
    useEffect(() => {
        map.fitBounds(bounds);
    }, [bounds, map]);
    return null;
}

export default function MapView() {
    const mapBounds: [number, number][] = [[0, 0], [1000, 1000]];

    const mapMarkers = useStore(state => state.mapMarkers);
    const fetchMapMarkers = useStore(state => state.fetchMapMarkers);
    const saveMapMarker = useStore(state => state.saveMapMarker);
    const deleteMapMarker = useStore(state => state.deleteMapMarker);
    const entities = useStore(state => state.entities);
    const fetchEntities = useStore(state => state.fetchEntities);

    const maps = useStore(state => state.maps);
    const fetchMaps = useStore(state => state.fetchMaps);
    const saveMap = useStore(state => state.saveMap);
    const deleteMap = useStore(state => state.deleteMap);

    const [activeMapId, setActiveMapId] = useState<string>('main');
    const [mapMode, setMapMode] = useState<MapMode>('select');
    const [showMapPanel, setShowMapPanel] = useState(true);
    const [isCreatingMap, setIsCreatingMap] = useState(false);
    const [newMapName, setNewMapName] = useState('');
    const [newMapImage, setNewMapImage] = useState('');

    // Marker placement modal
    const [isAddingMarker, setIsAddingMarker] = useState(false);
    const [newMarkerPos, setNewMarkerPos] = useState<{ x: number, y: number } | null>(null);
    const [selectedEntityId, setSelectedEntityId] = useState<string>('');

    // Area drawing state
    const [isDrawingArea, setIsDrawingArea] = useState(false);
    const [areaPoints, setAreaPoints] = useState<[number, number][]>([]);
    const [isLinkingArea, setIsLinkingArea] = useState(false);
    const [areaEntityId, setAreaEntityId] = useState<string>('');

    // Only allow placing "Places"
    const placeEntities = entities.filter(e => e.type === 'place');

    useEffect(() => {
        fetchMapMarkers();
        fetchMaps();
        fetchEntities();
    }, [fetchMapMarkers, fetchMaps, fetchEntities]);

    // Auto-create "main" map if it doesn't exist
    const saveMapRef = useRef(saveMap);
    saveMapRef.current = saveMap;
    useEffect(() => {
        if (maps.length === 0) return;
        const mainExists = maps.find(m => m.id === 'main');
        if (!mainExists) {
            saveMapRef.current({
                id: 'main',
                name: 'World Map',
                image_path: DEFAULT_MAP_IMAGE,
                level: 1,
            });
        }
    }, [maps]);

    const activeMap = maps.find(m => m.id === activeMapId);
    const activeMarkers = mapMarkers.filter(m => m.map_id === activeMapId);
    const pointMarkers = activeMarkers.filter(m => m.icon_type !== 'area');
    const areaMarkers = activeMarkers.filter(m => m.icon_type === 'area' && m.area_bounds);
    const activeMapImage = activeMap?.image_path || DEFAULT_MAP_IMAGE;

    const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
        if (mapMode === 'marker') {
            setNewMarkerPos({ x: e.latlng.lat, y: e.latlng.lng });
            setIsAddingMarker(true);
            setSelectedEntityId('');
        } else if (mapMode === 'area') {
            setIsDrawingArea(true);
            setAreaPoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
        }
    }, [mapMode]);

    const handleMapRightClick = useCallback((e: L.LeafletMouseEvent) => {
        if (mapMode === 'area' && isDrawingArea && areaPoints.length >= 3) {
            // Finish area drawing, show link dialog
            setIsDrawingArea(false);
            setIsLinkingArea(true);
            setAreaEntityId('');
        } else if (mapMode === 'select') {
            // Legacy: right-click to place marker
            setNewMarkerPos({ x: e.latlng.lat, y: e.latlng.lng });
            setIsAddingMarker(true);
            setSelectedEntityId('');
        }
    }, [mapMode, isDrawingArea, areaPoints]);

    const handleSaveMarker = async () => {
        if (!newMarkerPos || !selectedEntityId) return;

        const newMarker: MapMarker = {
            id: crypto.randomUUID(),
            map_id: activeMapId,
            entity_id: selectedEntityId,
            x: newMarkerPos.x,
            y: newMarkerPos.y,
            icon_type: 'point'
        };

        await saveMapMarker(newMarker);
        setIsAddingMarker(false);
        setNewMarkerPos(null);
    };

    const handleSaveArea = async () => {
        if (areaPoints.length < 3 || !areaEntityId) return;

        // Calculate centroid for the marker position
        const cx = areaPoints.reduce((sum, p) => sum + p[0], 0) / areaPoints.length;
        const cy = areaPoints.reduce((sum, p) => sum + p[1], 0) / areaPoints.length;

        const newMarker: MapMarker = {
            id: crypto.randomUUID(),
            map_id: activeMapId,
            entity_id: areaEntityId,
            x: cx,
            y: cy,
            icon_type: 'area',
            area_bounds: JSON.stringify(areaPoints)
        };

        await saveMapMarker(newMarker);
        setIsLinkingArea(false);
        setAreaPoints([]);
        setAreaEntityId('');
    };

    const cancelAreaDrawing = () => {
        setIsDrawingArea(false);
        setIsLinkingArea(false);
        setAreaPoints([]);
        setAreaEntityId('');
    };

    const handleDeleteMarker = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this marker?')) {
            await deleteMapMarker(id);
        }
    };

    const handleCreateMap = async () => {
        if (!newMapName.trim()) return;
        const id = crypto.randomUUID();
        await saveMap({
            id,
            name: newMapName.trim(),
            image_path: newMapImage || DEFAULT_MAP_IMAGE,
            level: 1,
        });
        setActiveMapId(id);
        setIsCreatingMap(false);
        setNewMapName('');
        setNewMapImage('');
    };

    const handleDeleteMap = async (id: string) => {
        if (id === 'main') return;
        if (!confirm('Delete this map and all its markers?')) return;
        const markersToDelete = mapMarkers.filter(m => m.map_id === id);
        for (const marker of markersToDelete) {
            await deleteMapMarker(marker.id);
        }
        await deleteMap(id);
        if (activeMapId === id) setActiveMapId('main');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            setNewMapImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleUpdateMapImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeMap) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            await saveMap({ ...activeMap, image_path: event.target?.result as string });
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="w-full h-full relative bg-[#0f1115] flex">
            {/* Maps Sidebar Panel */}
            <div className={`transition-all duration-300 ease-in-out bg-[#181a1f] border-r border-[#2d3036] flex flex-col ${showMapPanel ? 'w-72' : 'w-0 overflow-hidden'}`}>
                <div className="p-4 border-b border-[#2d3036] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#74b1be]" />
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Maps</h2>
                    </div>
                    <button
                        onClick={() => setIsCreatingMap(true)}
                        className="p-1.5 rounded-md bg-[#74b1be]/10 hover:bg-[#74b1be]/20 text-[#74b1be] transition-colors"
                        title="Create new map"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                {/* Map List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {maps.map(map => {
                        const markerCount = mapMarkers.filter(m => m.map_id === map.id).length;
                        return (
                            <div
                                key={map.id}
                                onClick={() => setActiveMapId(map.id)}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all group ${activeMapId === map.id
                                    ? 'bg-[#74b1be]/10 border border-[#74b1be]/30 text-white'
                                    : 'hover:bg-[#23252a] border border-transparent text-[#8a8f98]'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-md flex items-center justify-center ${activeMapId === map.id ? 'bg-[#74b1be]/20' : 'bg-[#23252a]'}`}>
                                    <Layers className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{map.name}</div>
                                    <div className="text-[10px] text-[#8a8f98]">{markerCount} marker{markerCount !== 1 ? 's' : ''}</div>
                                </div>
                                {map.id !== 'main' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteMap(map.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-[#8a8f98] hover:text-red-400 transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {maps.length === 0 && (
                        <div className="text-center text-[#4a4d5e] text-xs p-4">No maps yet.</div>
                    )}
                </div>

                {/* Tools Section */}
                <div className="p-3 border-t border-[#2d3036] space-y-2">
                    <h3 className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider mb-2">Tools</h3>
                    <div className="flex gap-1">
                        <button
                            onClick={() => { setMapMode('select'); cancelAreaDrawing(); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${mapMode === 'select' ? 'bg-[#74b1be]/20 text-[#74b1be] border border-[#74b1be]/30' : 'bg-[#23252a] text-[#8a8f98] hover:text-white border border-transparent'}`}
                        >
                            <MousePointer className="w-3.5 h-3.5" /> Select
                        </button>
                        <button
                            onClick={() => { setMapMode('marker'); cancelAreaDrawing(); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${mapMode === 'marker' ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30' : 'bg-[#23252a] text-[#8a8f98] hover:text-white border border-transparent'}`}
                        >
                            <MapPin className="w-3.5 h-3.5" /> Pin
                        </button>
                        <button
                            onClick={() => { setMapMode('area'); cancelAreaDrawing(); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${mapMode === 'area' ? 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30' : 'bg-[#23252a] text-[#8a8f98] hover:text-white border border-transparent'}`}
                        >
                            <PenTool className="w-3.5 h-3.5" /> Area
                        </button>
                    </div>

                    {mapMode === 'marker' && (
                        <div className="text-[10px] text-[#8a8f98] mt-1">Click on the map to place a marker dot</div>
                    )}
                    {mapMode === 'area' && !isDrawingArea && (
                        <div className="text-[10px] text-[#8a8f98] mt-1">Click to start drawing an area polygon</div>
                    )}
                    {mapMode === 'area' && isDrawingArea && (
                        <div className="space-y-1 mt-1">
                            <div className="text-[10px] text-[#f59e0b]">Drawing area... ({areaPoints.length} points)</div>
                            <div className="text-[10px] text-[#8a8f98]">Click to add points. Right-click to finish.</div>
                            <button
                                onClick={cancelAreaDrawing}
                                className="w-full py-1 text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 rounded transition-colors"
                            >
                                Cancel Drawing
                            </button>
                        </div>
                    )}
                    {mapMode === 'select' && (
                        <div className="text-[10px] text-[#8a8f98] mt-1">Right-click to quickly place a marker</div>
                    )}
                </div>

                {/* Active Map Info */}
                {activeMap && (
                    <div className="p-3 border-t border-[#2d3036] space-y-2">
                        <h3 className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider">Active Map</h3>
                        <div className="text-sm text-white font-medium">{activeMap.name}</div>
                        <label className="flex items-center gap-2 text-xs text-[#74b1be] cursor-pointer hover:text-white transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Change Image</span>
                            <input type="file" accept="image/*" onChange={handleUpdateMapImage} className="hidden" />
                        </label>
                    </div>
                )}
            </div>

            {/* Toggle Sidebar */}
            <button
                onClick={() => setShowMapPanel(!showMapPanel)}
                className="absolute top-4 z-[1000] bg-[#181a1f] p-2 rounded-r-lg border border-l-0 border-[#2d3036] text-[#8a8f98] hover:text-white transition-colors"
                style={{ left: showMapPanel ? '288px' : '0px' }}
            >
                <ChevronRight className={`w-4 h-4 transition-transform ${showMapPanel ? 'rotate-180' : ''}`} />
            </button>

            {/* Create Map Modal */}
            {isCreatingMap && (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#181a1f] border border-[#2d3036] rounded-xl p-6 w-[420px] shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-white font-bold text-lg">Create New Map</h3>
                            <button onClick={() => setIsCreatingMap(false)} className="text-[#8a8f98] hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-[#8a8f98] mb-2 uppercase tracking-wide">Map Name</label>
                                <input
                                    type="text"
                                    value={newMapName}
                                    onChange={e => setNewMapName(e.target.value)}
                                    placeholder="e.g. Aethelgard City Map"
                                    className="w-full bg-[#0f1115] border border-[#2d3036] text-white p-3 rounded-lg focus:border-[#74b1be] outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-[#8a8f98] mb-2 uppercase tracking-wide">Map Image</label>
                                {newMapImage ? (
                                    <div className="relative rounded-lg overflow-hidden border border-[#2d3036]">
                                        <img src={newMapImage} alt="Map preview" className="w-full h-32 object-cover" />
                                        <button onClick={() => setNewMapImage('')} className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#2d3036] rounded-lg cursor-pointer hover:border-[#74b1be] transition-colors text-[#8a8f98] hover:text-[#74b1be]">
                                        <Upload className="w-5 h-5" />
                                        <span className="text-sm">Upload an image</span>
                                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                    </label>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 mt-6">
                            <button onClick={() => { setIsCreatingMap(false); setNewMapName(''); setNewMapImage(''); }} className="px-4 py-2 text-[#8a8f98] hover:text-white transition text-sm">Cancel</button>
                            <button onClick={handleCreateMap} disabled={!newMapName.trim()} className="px-5 py-2 bg-[#74b1be] text-black font-semibold rounded-lg hover:bg-[#5a98a5] transition disabled:opacity-50 disabled:cursor-not-allowed text-sm">Create Map</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Marker Placement Modal */}
            {isAddingMarker && newMarkerPos && (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#181a1f] border border-[#2d3036] rounded-xl p-6 w-96 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-[#10b981]" />
                                <h3 className="text-white font-bold">Place Marker</h3>
                            </div>
                            <button onClick={() => setIsAddingMarker(false)} className="text-[#8a8f98] hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs text-[#8a8f98] mb-2 uppercase tracking-wide">Link to Place Entity</label>
                            <select
                                className="w-full bg-[#0f1115] border border-[#2d3036] text-white p-2.5 rounded-lg focus:border-[#74b1be] outline-none text-sm"
                                value={selectedEntityId}
                                onChange={(e) => setSelectedEntityId(e.target.value)}
                            >
                                <option value="" disabled>-- Select a Place --</option>
                                {placeEntities.map(place => (
                                    <option key={place.id} value={place.id}>{place.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => setIsAddingMarker(false)} className="px-4 py-2 text-[#8a8f98] hover:text-white transition text-sm">Cancel</button>
                            <button onClick={handleSaveMarker} disabled={!selectedEntityId} className="px-5 py-2 bg-[#10b981] text-black font-semibold rounded-lg hover:bg-[#059669] transition disabled:opacity-50 disabled:cursor-not-allowed text-sm">Place Marker</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Area Link Modal */}
            {isLinkingArea && (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#181a1f] border border-[#2d3036] rounded-xl p-6 w-96 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <PenTool className="w-5 h-5 text-[#f59e0b]" />
                                <h3 className="text-white font-bold">Link Area to Place</h3>
                            </div>
                            <button onClick={cancelAreaDrawing} className="text-[#8a8f98] hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="mb-2 text-xs text-[#8a8f98]">
                            Area drawn with {areaPoints.length} points
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs text-[#8a8f98] mb-2 uppercase tracking-wide">Link to Place Entity</label>
                            <select
                                className="w-full bg-[#0f1115] border border-[#2d3036] text-white p-2.5 rounded-lg focus:border-[#74b1be] outline-none text-sm"
                                value={areaEntityId}
                                onChange={(e) => setAreaEntityId(e.target.value)}
                            >
                                <option value="" disabled>-- Select a Place --</option>
                                {placeEntities.map(place => (
                                    <option key={place.id} value={place.id}>{place.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button onClick={cancelAreaDrawing} className="px-4 py-2 text-[#8a8f98] hover:text-white transition text-sm">Cancel</button>
                            <button onClick={handleSaveArea} disabled={!areaEntityId} className="px-5 py-2 bg-[#f59e0b] text-black font-semibold rounded-lg hover:bg-[#d97706] transition disabled:opacity-50 disabled:cursor-not-allowed text-sm">Save Area</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Leaflet Map */}
            <div className="flex-1 relative">
                <MapContainer
                    crs={L.CRS.Simple}
                    bounds={mapBounds as L.LatLngBoundsExpression}
                    maxZoom={4}
                    minZoom={-2}
                    className="w-full h-full leaflet-container-dark"
                    style={{ background: '#0f1115' }}
                >
                    <MapClickEvents mode={mapMode} onMapClick={handleMapClick} onMapRightClick={handleMapRightClick} />
                    <MapBoundsUpdater bounds={mapBounds as L.LatLngBoundsExpression} />
                    <ImageOverlay
                        url={activeMapImage}
                        bounds={mapBounds as L.LatLngBoundsExpression}
                    />

                    {/* Render Area Polygons */}
                    {areaMarkers.map(marker => {
                        const entity = entities.find(e => e.id === marker.entity_id);
                        const color = getEntityColor(marker.entity_id);
                        let positions: [number, number][] = [];
                        try {
                            positions = JSON.parse(marker.area_bounds!);
                        } catch { /* ignore */ }

                        if (positions.length < 3) return null;

                        return (
                            <Polygon
                                key={marker.id}
                                positions={positions}
                                pathOptions={{
                                    color: color,
                                    fillColor: color,
                                    fillOpacity: 0.15,
                                    weight: 2,
                                    dashArray: '6 4'
                                }}
                            >
                                <Tooltip sticky className="custom-tooltip">
                                    {entity?.name || 'Unknown Area'}
                                </Tooltip>
                                <Popup>
                                    <div className="text-gray-900 min-w-[160px]">
                                        <div className="font-bold text-lg border-b border-gray-200 pb-1 mb-2">
                                            {entity ? entity.name : 'Unknown Area'}
                                        </div>
                                        <div className="text-sm text-gray-600 mb-3">
                                            {entity?.summary || 'No description available.'}
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            {entity && (
                                                <button
                                                    onClick={() => window.location.hash = `#/entity/places?id=${entity.id}`}
                                                    className="text-[#74b1be] hover:text-[#5a98a5] font-semibold"
                                                >
                                                    View Entity Page →
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleDeleteMarker(marker.id, e)}
                                                className="text-red-500 hover:text-red-700 font-semibold"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </Popup>
                            </Polygon>
                        );
                    })}

                    {/* Drawing preview polygon */}
                    {isDrawingArea && areaPoints.length >= 2 && (
                        <Polygon
                            positions={areaPoints}
                            pathOptions={{
                                color: '#f59e0b',
                                fillColor: '#f59e0b',
                                fillOpacity: 0.1,
                                weight: 2,
                                dashArray: '4 4'
                            }}
                        />
                    )}

                    {/* Drawing preview points */}
                    {isDrawingArea && areaPoints.map((point, i) => (
                        <CircleMarker
                            key={`draw-${i}`}
                            center={point}
                            radius={4}
                            pathOptions={{
                                color: '#f59e0b',
                                fillColor: '#f59e0b',
                                fillOpacity: 1,
                                weight: 2,
                            }}
                        />
                    ))}

                    {/* Render Saved Markers as colored dots */}
                    {pointMarkers.map(marker => {
                        const entity = entities.find(e => e.id === marker.entity_id);
                        const color = getEntityColor(marker.entity_id);
                        return (
                            <CircleMarker
                                key={marker.id}
                                center={[marker.x, marker.y]}
                                radius={8}
                                pathOptions={{
                                    color: '#0f1115',
                                    fillColor: color,
                                    fillOpacity: 0.9,
                                    weight: 2,
                                }}
                            >
                                <Tooltip sticky className="custom-tooltip">
                                    {entity?.name || 'Unknown Location'}
                                </Tooltip>
                                <Popup>
                                    <div className="text-gray-900 min-w-[160px]">
                                        <div className="font-bold text-lg border-b border-gray-200 pb-1 mb-2">
                                            {entity ? entity.name : 'Unknown Location'}
                                        </div>
                                        <div className="text-sm text-gray-600 mb-3">
                                            {entity?.summary || 'No description available.'}
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            {entity && (
                                                <button
                                                    onClick={() => window.location.hash = `#/entity/places?id=${entity.id}`}
                                                    className="text-[#74b1be] hover:text-[#5a98a5] font-semibold"
                                                >
                                                    View Entity Page →
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleDeleteMarker(marker.id, e)}
                                                className="text-red-500 hover:text-red-700 font-semibold"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
}
