import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Compass, RotateCcw, Eye, Maximize2, Gamepad2, Move } from 'lucide-react';
import { useStore } from '../store';
import { useParams } from 'react-router-dom';
import type { Entity } from '../lib/api';

// ==========================================
// Types & Constants (mirrored from DungeonEditor)
// ==========================================

type CellType = 'empty' | 'wall' | 'floor' | 'door' | 'water';
type TokenType = 'player' | 'enemy' | 'chest' | 'teleport';

const CELL_COLORS: Record<CellType | TokenType, string> = {
    empty: 'transparent',
    wall: '#374151',
    floor: '#1f2937',
    door: '#d97706',
    water: '#2563eb',
    player: '#10b981',
    enemy: '#ef4444',
    chest: '#f59e0b',
    teleport: '#8b5cf6',
};

interface GridCell { x: number; y: number; type: CellType; label?: string; }
interface EdgeData { x: number; y: number; orientation: 'horizontal' | 'vertical'; type: 'wall' | 'door'; }
interface TokenData { id: string; x: number; y: number; type: TokenType; label?: string; characterId?: string; }
interface MapData { width: number; height: number; cells: GridCell[]; edges?: EdgeData[]; tokens?: TokenData[]; visitedCells?: string[]; fovRadius?: number; openDoors?: string[]; }

function getCellsInLine(p0: { x: number; y: number }, p1: { x: number; y: number }) {
    const points = [];
    let x0 = p0.x, y0 = p0.y;
    const x1 = p1.x, y1 = p1.y;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
        points.push({ x: x0, y: y0 });
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return points;
}

// ==========================================
// Component
// ==========================================

interface ExplorePopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ExplorePopup({ isOpen, onClose }: ExplorePopupProps) {
    const { entities, fetchEntities, saveEntity } = useStore();
    const { id: urlId, role: urlRole } = useParams();

    const role = urlRole || 'master'; // Default to master for modal view
    const isMaster = role === 'master';

    // Places that have dungeon map_data
    const dungeonPlaces = entities.filter(e => e.type === 'place' && e.map_data);

    const [selectedPlaceId, setSelectedPlaceId] = useState<string>('');
    useEffect(() => {
        if (urlId) setSelectedPlaceId(urlId);
    }, [urlId]);

    const [mapWidth, setMapWidth] = useState(30);
    const [mapHeight, setMapHeight] = useState(20);
    const cellSize = 32;

    const [cells, setCells] = useState<Record<string, GridCell>>({});
    const [edges, setEdges] = useState<Record<string, EdgeData>>({});
    const [tokens, setTokens] = useState<TokenData[]>([]);
    const [visitedCells, setVisitedCells] = useState<Set<string>>(new Set());
    const [fovRadius, setFovRadius] = useState<number>(9);
    const [openDoors, setOpenDoors] = useState<Set<string>>(new Set());
    const [knownOpenDoors, setKnownOpenDoors] = useState<Set<string>>(new Set());

    const [isTabPressed, setIsTabPressed] = useState(false);

    const [movementMode, setMovementMode] = useState<'free' | 'schematic'>('schematic');
    const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
    const [showHidden, setShowHidden] = useState(isMaster); // Master sees all by default

    // Optimization: avoid infinite loops with saveEntity
    const lastSavedRef = useRef<string>('');

    // Canvas state
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load entities on open
    useEffect(() => {
        if (isOpen && entities.length === 0) {
            fetchEntities();
        }
    }, [isOpen, entities.length, fetchEntities]);

    // Escape key & Tab listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
            if (e.key === 'Tab') {
                e.preventDefault();
                setIsTabPressed(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                setIsTabPressed(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isOpen, onClose]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setSelectedPlaceId('');
            setCells({});
            setEdges({});
            setTokens([]);
            setVisitedCells(new Set());
            setOpenDoors(new Set());
            setKnownOpenDoors(new Set());
            setScale(1);
            setOffset({ x: 0, y: 0 });
        }
    }, [isOpen]);

    // Resize observer
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                setCanvasSize({ width, height });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [isOpen]);

    // Load map from selected place
    const loadPlace = useCallback((placeId: string) => {
        const place = entities.find(e => e.id === placeId);
        if (!place?.map_data) return;

        try {
            const json = JSON.parse(place.map_data) as MapData;
            if (!json.width || !json.height || !Array.isArray(json.cells)) return;

            setMapWidth(json.width);
            setMapHeight(json.height);

            const newCells: Record<string, GridCell> = {};
            json.cells.forEach(cell => { newCells[`${cell.x},${cell.y}`] = cell; });
            setCells(newCells);

            if (json.edges && Array.isArray(json.edges)) {
                const newEdges: Record<string, EdgeData> = {};
                json.edges.forEach(edge => { newEdges[`${edge.x},${edge.y},${edge.orientation}`] = edge; });
                setEdges(newEdges);
            } else {
                setEdges({});
            }

            setTokens(json.tokens && Array.isArray(json.tokens) ? json.tokens : []);
            setVisitedCells(new Set(json.visitedCells || []));
            setFovRadius(json.fovRadius ?? 9);
            setOpenDoors(new Set(json.openDoors || []));
            setKnownOpenDoors(new Set(json.openDoors || []));
            setScale(1);
            setOffset({ x: 0, y: 0 });
        } catch { /* ignore */ }
    }, [entities]);

    useEffect(() => {
        if (selectedPlaceId) loadPlace(selectedPlaceId);
    }, [selectedPlaceId, loadPlace]);

    // ==========================================
    // Sync Logic
    // ==========================================
    
    // Auto-save Master state & Broadcast
    useEffect(() => {
        if (!isMaster || !selectedPlaceId || !isOpen) return;
        
        const currentDataObj = {
            width: mapWidth,
            height: mapHeight,
            cells: Object.values(cells),
            edges: Object.values(edges),
            tokens: tokens,
            visitedCells: Array.from(visitedCells),
            fovRadius: fovRadius,
            openDoors: Array.from(openDoors)
        };
        const currentDataStr = JSON.stringify(currentDataObj);

        if (currentDataStr === lastSavedRef.current) return;

        // INSTANT BROADCAST for real-time movement
        const channel = new BroadcastChannel('dungeon-sync');
        channel.postMessage({ placeId: selectedPlaceId, data: currentDataObj });
        channel.close();

        // DEBOUNCED DB SAVE
        const timer = setTimeout(() => {
            const place = entities.find(e => e.id === selectedPlaceId);
            if (place) {
                saveEntity({ ...place, map_data: currentDataStr });
                lastSavedRef.current = currentDataStr;
                console.log('[Sync] Master saved to DB & broadcasted');
            }
        }, 1000); 

        return () => clearTimeout(timer);
    }, [isMaster, tokens, cells, edges, mapWidth, mapHeight, selectedPlaceId, entities, saveEntity, isOpen, visitedCells, fovRadius, openDoors]);

    // BroadcastChannel Subscriber for Player View
    useEffect(() => {
        if (isMaster || !selectedPlaceId || !isOpen) return;

        const channel = new BroadcastChannel('dungeon-sync');
        
        channel.onmessage = (event) => {
            const { placeId, data } = event.data;
            if (placeId !== selectedPlaceId) return;

            // Update local state instantly from broadcast
            if (data.tokens) setTokens(data.tokens);
            if (data.visitedCells) setVisitedCells(new Set(data.visitedCells));
            if (data.fovRadius !== undefined) setFovRadius(data.fovRadius);
            if (data.openDoors) {
                setOpenDoors(new Set(data.openDoors));
                if (isMaster) setKnownOpenDoors(new Set(data.openDoors));
            }
        };

        return () => channel.close();
    }, [isMaster, selectedPlaceId, isOpen]);

    // Fallback sync when entities update (e.g. from DB)
    useEffect(() => {
        if (isMaster || !selectedPlaceId) return;
        const place = entities.find(e => e.id === selectedPlaceId);
        if (place?.map_data) {
            try {
                const json = JSON.parse(place.map_data) as MapData;
                // Only update if significantly different to avoid flickering with broadcast
                if (Math.abs((json.tokens?.length || 0) - tokens.length) > 0 || 
                    JSON.stringify(json.tokens) !== JSON.stringify(tokens)) {
                    setTokens(json.tokens || []);
                }
                if (json.visitedCells && json.visitedCells.length !== visitedCells.size) {
                    setVisitedCells(new Set(json.visitedCells));
                }
            } catch (e) { /* ignore */ }
        }
    }, [entities, isMaster, selectedPlaceId]);

    // ==========================================
    // Collision & Movement Logic
    // ==========================================
    const canMove = useCallback((tokenId: string, targetX: number, targetY: number) => {
        const token = tokens.find(t => t.id === tokenId);
        if (!token) return false;

        const curX = Math.round(token.x);
        const curY = Math.round(token.y);
        const tx = Math.round(targetX);
        const ty = Math.round(targetY);

        if (tx < 0 || tx >= mapWidth || ty < 0 || ty >= mapHeight) return false;
        if (cells[`${tx},${ty}`]?.type === 'wall') return false;

        const dx = tx - curX;
        const dy = ty - curY;

        // Check edge blocking (walls always block, doors only when closed)
        const edgeBlocks = (k: string) => {
            const e = edges[k];
            if (!e) return false;
            if (e.type === 'wall') return true;
            if (e.type === 'door' && !openDoors.has(k)) return true;
            return false;
        };

        if (dx === 1 && dy === 0) {
            if (edgeBlocks(`${tx},${ty},vertical`)) return false;
        } else if (dx === -1 && dy === 0) {
            if (edgeBlocks(`${curX},${curY},vertical`)) return false;
        } else if (dx === 0 && dy === 1) {
            if (edgeBlocks(`${tx},${ty},horizontal`)) return false;
        } else if (dx === 0 && dy === -1) {
            if (edgeBlocks(`${curX},${curY},horizontal`)) return false;
        }

        return true;
    }, [tokens, cells, edges, mapWidth, mapHeight, openDoors]);

    const triggerTeleport = useCallback((tokenId: string, x: number, y: number) => {
        const cellX = Math.floor(x);
        const cellY = Math.floor(y);

        // Find a teleport token on this cell
        const teleportAt = tokens.find(t => 
            t.type === 'teleport' && 
            Math.floor(t.x) === cellX && 
            Math.floor(t.y) === cellY
        );

        console.log('[Teleport] Checking cell', cellX, cellY, 'found teleport:', teleportAt?.label, 'all teleports:', tokens.filter(t => t.type === 'teleport').map(t => ({ id: t.id, x: t.x, y: t.y, label: t.label })));

        if (!teleportAt || !teleportAt.label) return false;

        // Find the paired teleporter (same label, different token)
        const pair = tokens.find(t => 
            t.type === 'teleport' && 
            t.label === teleportAt.label && 
            t.id !== teleportAt.id
        );

        console.log('[Teleport] Pair found:', pair?.label, 'at', pair?.x, pair?.y);

        if (!pair) return false;

        setTokens(prev => prev.map(t =>
            t.id === tokenId ? { ...t, x: pair!.x, y: pair!.y } : t
        ));
        return true;
    }, [tokens]);

    useEffect(() => {
        if (!selectedTokenId || movementMode !== 'schematic' || !isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const token = tokens.find(t => t.id === selectedTokenId);
            if (!token) return;

            let nextX = Math.round(token.x);
            let nextY = Math.round(token.y);

            const key = e.key.toLowerCase();
            if (key === 'w' || key === 'arrowup') nextY -= 1;
            else if (key === 's' || key === 'arrowdown') nextY += 1;
            else if (key === 'a' || key === 'arrowleft') nextX -= 1;
            else if (key === 'd' || key === 'arrowright') nextX += 1;
            else return;

            e.preventDefault();

            if (isTabPressed) {
                // Move all player tokens
                const players = tokens.filter(t => t.type === 'player');
                let movedAny = false;
                setTokens(prev => {
                    const next = [...prev];
                    players.forEach(p => {
                        let npx = Math.round(p.x);
                        let npy = Math.round(p.y);
                        if (key === 'w' || key === 'arrowup') npy -= 1;
                        else if (key === 's' || key === 'arrowdown') npy += 1;
                        else if (key === 'a' || key === 'arrowleft') npx -= 1;
                        else if (key === 'd' || key === 'arrowright') npx += 1;
                        
                        if (canMove(p.id, npx, npy)) {
                            const idx = next.findIndex(t => t.id === p.id);
                            if (idx > -1) {
                                next[idx] = { ...next[idx], x: npx, y: npy };
                                movedAny = true;
                                triggerTeleport(p.id, npx, npy);
                            }
                        }
                    });
                    return movedAny ? next : prev;
                });
            } else {
                if (canMove(selectedTokenId, nextX, nextY)) {
                    setTokens(prev => prev.map(t =>
                        t.id === selectedTokenId ? { ...t, x: nextX, y: nextY } : t
                    ));
                    triggerTeleport(selectedTokenId, nextX, nextY);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedTokenId, movementMode, isOpen, tokens, canMove, triggerTeleport, isTabPressed]);

    // ==========================================
    // FOV Calculation (cached with useMemo)
    // ==========================================
    const currentFOV = useMemo(() => {
        const visible = new Set<string>();
        const players = tokens.filter(t => t.type === 'player');
        if (players.length === 0) return null;

        const radius = fovRadius === 0 ? 999 : fovRadius;

        // Helper: does this edge block a ray? Walls always block. Closed doors block. Open doors don't.
        const edgeBlocksFOV = (k: string) => {
            const e = edges[k];
            if (!e) return false;
            if (e.type === 'wall') return true;
            if (e.type === 'door' && !openDoors.has(k)) return true;
            return false;
        };

        const blocksRayEdge = (x1: number, y1: number, x2: number, y2: number) => {
            if (x1 === x2 && y1 !== y2) {
                const edgeY = Math.max(y1, y2);
                if (edgeBlocksFOV(`${x1},${edgeY},horizontal`)) return true;
            } else if (y1 === y2 && x1 !== x2) {
                const edgeX = Math.max(x1, x2);
                if (edgeBlocksFOV(`${edgeX},${y1},vertical`)) return true;
            } else if (Math.abs(x1 - x2) === 1 && Math.abs(y1 - y2) === 1) {
                const ex1 = Math.max(x1, x2);
                const ey1 = Math.max(y1, y2);
                const hEdge = `${x1},${ey1},horizontal`;
                const vEdge = `${ex1},${y1},vertical`;
                const hEdge2 = `${x2},${ey1},horizontal`;
                const vEdge2 = `${ex1},${y2},vertical`;
                if ((edgeBlocksFOV(hEdge) && edgeBlocksFOV(vEdge)) || (edgeBlocksFOV(hEdge2) && edgeBlocksFOV(vEdge2))) return true;
                const c1 = cells[`${x1},${y2}`];
                const c2 = cells[`${x2},${y1}`];
                if (c1?.type === 'wall' && c2?.type === 'wall') return true;
            }
            return false;
        };

        const castRay = (px: number, py: number, targetX: number, targetY: number) => {
            const line = getCellsInLine({ x: px, y: py }, { x: targetX, y: targetY });
            for (let j = 0; j < line.length; j++) {
                const cell = line[j];
                if (Math.sqrt(Math.pow(cell.x - px, 2) + Math.pow(cell.y - py, 2)) > radius) break;
                visible.add(`${cell.x},${cell.y}`);
                if (cells[`${cell.x},${cell.y}`]?.type === 'wall') break;
                if (j < line.length - 1) {
                    const next = line[j + 1];
                    if (blocksRayEdge(cell.x, cell.y, next.x, next.y)) break;
                }
            }
        };

        players.forEach(p => {
            const px = Math.floor(p.x);
            const py = Math.floor(p.y);
            visible.add(`${px},${py}`);

            const minX = Math.max(0, px - radius);
            const maxX = Math.min(mapWidth - 1, px + radius);
            const minY = Math.max(0, py - radius);
            const maxY = Math.min(mapHeight - 1, py + radius);

            // Cast rays to all 4 edges of the bounding box
            for (let x = minX; x <= maxX; x++) {
                castRay(px, py, x, minY); // top edge
                castRay(px, py, x, maxY); // bottom edge
            }
            for (let y = minY + 1; y < maxY; y++) {
                castRay(px, py, minX, y); // left edge
                castRay(px, py, maxX, y); // right edge
            }
        });

        return visible;
    }, [tokens, cells, edges, mapWidth, mapHeight, fovRadius, openDoors]);

    // Separate knownOpenDoors update for FOG memory (players only)
    useEffect(() => {
        if (!isOpen || isMaster || !currentFOV) return;
        setKnownOpenDoors(prev => {
            const next = new Set(prev);
            let changed = false;
            Object.values(edges).forEach(edge => {
                if (edge.type !== 'door') return;
                const k = `${edge.x},${edge.y},${edge.orientation}`;
                let inFOV = false;
                if (edge.orientation === 'horizontal') {
                    inFOV = currentFOV.has(`${edge.x},${edge.y}`) || currentFOV.has(`${edge.x},${edge.y-1}`);
                } else {
                    inFOV = currentFOV.has(`${edge.x},${edge.y}`) || currentFOV.has(`${edge.x-1},${edge.y}`);
                }
                if (inFOV) {
                    const isOpenStr = openDoors.has(k);
                    if (isOpenStr !== next.has(k)) {
                        if (isOpenStr) next.add(k);
                        else next.delete(k);
                        changed = true;
                    }
                }
            });
            return changed ? next : prev;
        });
    }, [isOpen, isMaster, currentFOV, edges, openDoors]);

    // Separate visited-cells update (avoids re-render cascade in draw loop)
    useEffect(() => {
        if (!currentFOV) return;
        setVisitedCells(prev => {
            const next = new Set(prev);
            currentFOV.forEach(cell => next.add(cell));
            if (next.size === prev.size) return prev;
            return next;
        });
    }, [currentFOV]);

    // ==========================================
    // Canvas Rendering
    // ==========================================
    useEffect(() => {
        if (!isOpen || Object.keys(cells).length === 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0a0b0d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // Background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, mapWidth * cellSize, mapHeight * cellSize);

        const isVisible = (x: number, y: number) =>
            (isMaster && showHidden) || currentFOV?.has(`${x},${y}`) || visitedCells.has(`${x},${y}`);
        const isCurrentlyInFOV = (x: number, y: number) =>
            (isMaster && showHidden) || currentFOV?.has(`${x},${y}`);

        // Draw cells
        Object.values(cells).forEach(cell => {
            if (cell.type === 'empty') return;
            if (!isVisible(cell.x, cell.y)) return;
            const cx = cell.x * cellSize;
            const cy = cell.y * cellSize;
            ctx.fillStyle = CELL_COLORS[cell.type];
            ctx.fillRect(cx, cy, cellSize, cellSize);
            if (cell.type === 'wall') {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(cx, cy, cellSize, cellSize);
                ctx.strokeStyle = '#4b5563';
                ctx.lineWidth = 2;
                ctx.strokeRect(cx + 2, cy + 2, cellSize - 4, cellSize - 4);
            } else if (cell.type === 'water') {
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.beginPath();
                ctx.arc(cx + cellSize * 0.3, cy + cellSize * 0.4, 3, 0, Math.PI * 2);
                ctx.arc(cx + cellSize * 0.7, cy + cellSize * 0.6, 2, 0, Math.PI * 2);
                ctx.fill();
            }
            if (!isCurrentlyInFOV(cell.x, cell.y)) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(cx, cy, cellSize, cellSize);
            }
        });

        // Draw valid-move indicators for selected token
        if (selectedTokenId && movementMode === 'schematic') {
            const selToken = tokens.find(t => t.id === selectedTokenId);
            if (selToken) {
                const sx = Math.round(selToken.x);
                const sy = Math.round(selToken.y);
                const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
                dirs.forEach(({ dx, dy }) => {
                    const nx = sx + dx;
                    const ny = sy + dy;
                    if (canMove(selectedTokenId, nx, ny)) {
                        const cx = nx * cellSize + cellSize / 2;
                        const cy = ny * cellSize + cellSize / 2;
                        ctx.beginPath();
                        ctx.arc(cx, cy, cellSize * 0.15, 0, 2 * Math.PI);
                        ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                });
            }
        }

        // Draw tokens
        tokens.forEach(token => {
            const tx = Math.floor(token.x);
            const ty = Math.floor(token.y);
            const isPlayer = token.type === 'player';
            const isInFOV = isCurrentlyInFOV(tx, ty);

            if (!isPlayer && !isInFOV && !showHidden) return;

            const cx = token.x * cellSize;
            const cy = token.y * cellSize;

            if (!isPlayer && !isInFOV && showHidden) {
                ctx.globalAlpha = 0.4;
            }
            const centerX = cx + cellSize / 2;
            const centerY = cy + cellSize / 2;

            ctx.beginPath();
            if (token.type === 'chest') {
                ctx.rect(centerX - cellSize * 0.3, centerY - cellSize * 0.25, cellSize * 0.6, cellSize * 0.5);
                ctx.fillStyle = CELL_COLORS[token.type];
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#78350f';
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(centerX - cellSize * 0.3, centerY);
                ctx.lineTo(centerX + cellSize * 0.3, centerY);
                ctx.stroke();
            } else if (token.type === 'teleport') {
                const radius = cellSize / 3;
                ctx.beginPath();
                ctx.arc(centerX, centerY, cellSize / 2.2, 0, 2 * Math.PI);
                ctx.strokeStyle = '#8b5cf6';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 2]);
                ctx.stroke();
                ctx.setLineDash([]);
                
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                ctx.fillStyle = '#8b5cf6';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                if (token.label) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 10px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(token.label, centerX, centerY);
                }
            } else {
                const radius = cellSize / 2.5;
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                ctx.fillStyle = CELL_COLORS[token.type];
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();

                if (isPlayer && token.label) {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 16px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(token.label.charAt(0).toUpperCase(), centerX, centerY);
                }
            }

            // Highlight player being dragged or selected
            if (draggingTokenId === token.id || selectedTokenId === token.id) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, cellSize / 2, 0, 2 * Math.PI);
                ctx.strokeStyle = draggingTokenId === token.id ? '#38bdf8' : '#10b981';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            ctx.globalAlpha = 1.0;
        });

        // Draw edges
        Object.values(edges).forEach(edge => {
            const edgeKey = `${edge.x},${edge.y},${edge.orientation}`;
            const actualOpenDoors = isMaster ? openDoors : knownOpenDoors;
            const isDoorOpen = edge.type === 'door' && actualOpenDoors.has(edgeKey);

            let adjVisible = false;
            let adjInFOV = false;
            if (edge.orientation === 'horizontal') {
                if (isVisible(edge.x, edge.y) || isVisible(edge.x, edge.y - 1)) adjVisible = true;
                if (isCurrentlyInFOV(edge.x, edge.y) || isCurrentlyInFOV(edge.x, edge.y - 1)) adjInFOV = true;
            } else {
                if (isVisible(edge.x, edge.y) || isVisible(edge.x - 1, edge.y)) adjVisible = true;
                if (isCurrentlyInFOV(edge.x, edge.y) || isCurrentlyInFOV(edge.x - 1, edge.y)) adjInFOV = true;
            }
            if (!adjVisible) return;
            if (!adjInFOV) ctx.globalAlpha = 0.3;

            ctx.beginPath();
            const px = edge.x * cellSize;
            const py = edge.y * cellSize;

            if (edge.type === 'wall') {
                ctx.strokeStyle = '#1f2937';
                ctx.lineWidth = 6;
                if (edge.orientation === 'horizontal') { ctx.moveTo(px - 1, py); ctx.lineTo(px + cellSize + 1, py); }
                else { ctx.moveTo(px, py - 1); ctx.lineTo(px, py + cellSize + 1); }
                ctx.stroke();
                ctx.beginPath();
                ctx.strokeStyle = '#9ca3af';
                ctx.lineWidth = 2;
                if (edge.orientation === 'horizontal') { ctx.moveTo(px, py); ctx.lineTo(px + cellSize, py); }
                else { ctx.moveTo(px, py); ctx.lineTo(px, py + cellSize); }
                ctx.stroke();
            } else if (edge.type === 'door') {
                if (isDoorOpen) {
                    // Open door: green dashed line
                    ctx.strokeStyle = '#22c55e';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    if (edge.orientation === 'horizontal') { ctx.moveTo(px + 2, py); ctx.lineTo(px + cellSize - 2, py); }
                    else { ctx.moveTo(px, py + 2); ctx.lineTo(px, py + cellSize - 2); }
                    ctx.stroke();
                    ctx.setLineDash([]);
                } else {
                    // Closed door: solid amber line
                    ctx.strokeStyle = '#78350f';
                    ctx.lineWidth = 6;
                    if (edge.orientation === 'horizontal') { ctx.moveTo(px + 2, py); ctx.lineTo(px + cellSize - 2, py); }
                    else { ctx.moveTo(px, py + 2); ctx.lineTo(px, py + cellSize - 2); }
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.strokeStyle = '#fbbf24';
                    ctx.lineWidth = 2;
                    if (edge.orientation === 'horizontal') { ctx.moveTo(px + 2, py); ctx.lineTo(px + cellSize - 2, py); }
                    else { ctx.moveTo(px, py + 2); ctx.lineTo(px, py + cellSize - 2); }
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = 1.0;
        });

        // Fog of war blackout for unexplored
        ctx.fillStyle = '#000000';
        for (let x = 0; x < mapWidth; x++) {
            for (let y = 0; y < mapHeight; y++) {
                if (!isVisible(x, y)) {
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
        }

        ctx.restore();
    }, [isOpen, cells, edges, tokens, mapWidth, mapHeight, scale, offset, visitedCells, draggingTokenId, currentFOV, cellSize, selectedTokenId, movementMode, canMove, isMaster, showHidden, openDoors, knownOpenDoors]);

    // ==========================================
    // Mouse Handlers (pan, zoom, drag tokens)
    // ==========================================
    
    // Auto-fit view for players
    useEffect(() => {
        if (isMaster || !isOpen || !mapWidth || !mapHeight || !canvasSize.width) return;
        const scaleX = canvasSize.width / (mapWidth * cellSize);
        const scaleY = canvasSize.height / (mapHeight * cellSize);
        const fitScale = Math.min(scaleX, scaleY) * 0.95;
        setScale(fitScale);
        
        const contentW = mapWidth * cellSize * fitScale;
        const contentH = mapHeight * cellSize * fitScale;
        setOffset({
            x: (canvasSize.width - contentW) / 2,
            y: (canvasSize.height - contentH) / 2
        });
    }, [isMaster, isOpen, mapWidth, mapHeight, canvasSize, cellSize]);

    const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
        if (!isMaster) return;
        e.preventDefault();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        let newScale = scale * (1 + delta);
        newScale = Math.max(0.2, Math.min(newScale, 5));

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        const mouseWorldX = (rawX - offset.x) / scale;
        const mouseWorldY = (rawY - offset.y) / scale;
        const newOffsetX = rawX - mouseWorldX * newScale;
        const newOffsetY = rawY - mouseWorldY * newScale;

        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
    }, [scale, offset]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if ((e.button === 1 || e.button === 2) && isMaster) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        const canvasX = (rawX - offset.x) / scale;
        const canvasY = (rawY - offset.y) / scale;
        const fx = canvasX / cellSize;
        const fy = canvasY / cellSize;

        // Check if clicking on a door edge to open/close it
        const clickThreshold = 0.2; // how close to an edge line counts as a click
        for (const edgeKey of Object.keys(edges)) {
            const edge = edges[edgeKey];
            if (edge.type !== 'door') continue;
            
            // Check adjacency to player (must be next to the door to interact)
            const players = tokens.filter(t => t.type === 'player');
            const isAdjacentToPlayer = isMaster || players.some(p => {
                const px = Math.round(p.x);
                const py = Math.round(p.y);
                if (edge.orientation === 'horizontal') {
                    return (py === edge.y || py === edge.y - 1) && px === edge.x;
                } else {
                    return (px === edge.x || px === edge.x - 1) && py === edge.y;
                }
            });
            if (!isAdjacentToPlayer) continue;

            let dist = Infinity;
            if (edge.orientation === 'horizontal') {
                // Edge runs along y = edge.y, from x = edge.x to x = edge.x + 1
                const edgeMidX = edge.x + 0.5;
                const edgeMidY = edge.y;
                if (fx >= edge.x && fx <= edge.x + 1) {
                    dist = Math.abs(fy - edgeMidY);
                } else {
                    dist = Math.sqrt(Math.pow(fx - edgeMidX, 2) + Math.pow(fy - edgeMidY, 2));
                }
            } else {
                // Edge runs along x = edge.x, from y = edge.y to y = edge.y + 1
                const edgeMidX = edge.x;
                const edgeMidY = edge.y + 0.5;
                if (fy >= edge.y && fy <= edge.y + 1) {
                    dist = Math.abs(fx - edgeMidX);
                } else {
                    dist = Math.sqrt(Math.pow(fx - edgeMidX, 2) + Math.pow(fy - edgeMidY, 2));
                }
            }

            if (dist < clickThreshold) {
                // Toggle door open/closed
                setOpenDoors(prev => {
                    const next = new Set(prev);
                    if (next.has(edgeKey)) next.delete(edgeKey);
                    else next.add(edgeKey);
                    return next;
                });
                return;
            }
        }

        // Check if clicking on a player token to drag
        for (let i = tokens.length - 1; i >= 0; i--) {
            const t = tokens[i];
            const canDrag = isMaster ? (t.type === 'player' || t.type === 'enemy') : (t.type === 'player');
            if (!canDrag) continue;

            const tcx = t.x + 0.5;
            const tcy = t.y + 0.5;
            const dx = fx - tcx;
            const dy = fy - tcy;
            if (Math.sqrt(dx * dx + dy * dy) <= 0.5) {
                setDraggingTokenId(t.id);
                setSelectedTokenId(t.id);
                return;
            }
        }
        setSelectedTokenId(null);
    }, [offset, scale, tokens, cellSize, edges, isMaster, openDoors]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isPanning && isMaster) {
            setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
            return;
        }

        if (draggingTokenId) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;
            const canvasX = (rawX - offset.x) / scale;
            const canvasY = (rawY - offset.y) / scale;

            if (movementMode === 'schematic') {
                // Step-by-step: move one cell at a time toward cursor
                setTokens(prev => prev.map(t => {
                    if (t.id !== draggingTokenId) return t;
                    const targetX = Math.round((canvasX / cellSize) - 0.5);
                    const targetY = Math.round((canvasY / cellSize) - 0.5);
                    const curX = Math.round(t.x);
                    const curY = Math.round(t.y);
                    if (targetX === curX && targetY === curY) return t;

                    // Try to step one cell toward the target
                    const dx = Math.sign(targetX - curX);
                    const dy = Math.sign(targetY - curY);

                    // Prefer cardinal direction with larger delta
                    const tryMoves: { x: number; y: number }[] = [];
                    if (Math.abs(targetX - curX) >= Math.abs(targetY - curY)) {
                        if (dx !== 0) tryMoves.push({ x: curX + dx, y: curY });
                        if (dy !== 0) tryMoves.push({ x: curX, y: curY + dy });
                    } else {
                        if (dy !== 0) tryMoves.push({ x: curX, y: curY + dy });
                        if (dx !== 0) tryMoves.push({ x: curX + dx, y: curY });
                    }

                    for (const m of tryMoves) {
                        if (canMove(draggingTokenId, m.x, m.y)) {
                            return { ...t, x: m.x, y: m.y };
                        }
                    }
                    return t;
                }));
            } else {
                // Free movement
                setTokens(prev => prev.map(t => {
                    if (t.id !== draggingTokenId) return t;
                    const nx = (canvasX / cellSize) - 0.5;
                    const ny = (canvasY / cellSize) - 0.5;
                    return { ...t, x: nx, y: ny };
                }));
            }
        }
    }, [isPanning, panStart, draggingTokenId, offset, scale, cellSize, movementMode, canMove]);

    const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if ((e.button === 1 || e.button === 2) && isMaster) {
            setIsPanning(false);
            return;
        }
        if (draggingTokenId) {
            const token = tokens.find(t => t.id === draggingTokenId);
            if (token) {
                triggerTeleport(draggingTokenId, token.x, token.y);
            }
        }
        setDraggingTokenId(null);
    }, [draggingTokenId, tokens, triggerTeleport]);

    const handleMouseLeave = useCallback(() => {
        setIsPanning(false);
        setDraggingTokenId(null);
    }, []);

    if (!isOpen) return null;

    const selectedPlace = entities.find(e => e.id === selectedPlaceId);
    const hasMap = Object.keys(cells).length > 0;

    return (
        <div className="fixed inset-0 z-[9999] flex animate-explore-fadein">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

            {/* Main Container */}
            <div className="relative z-10 flex flex-col w-full h-full">
                {/* Top Bar */}
                <div className="flex items-center justify-between px-6 py-3 bg-[#0a0b0d]/90 border-b border-[#2d3036]/60 backdrop-blur-lg shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Compass className={`w-5 h-5 ${isMaster ? 'text-[#10b981]' : 'text-[#38bdf8]'}`} />
                            <h1 className="text-lg font-bold text-white tracking-wide">
                                {isMaster ? 'Master View' : 'Player View'}
                            </h1>
                        </div>
                        <div className="h-5 w-px bg-[#2d3036]" />

                        {/* Place Selector - Master Only */}
                        {isMaster ? (
                            <select
                                value={selectedPlaceId}
                                onChange={(e) => setSelectedPlaceId(e.target.value)}
                                className="bg-[#181a1f] border border-[#2d3036] text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-[#10b981] transition-colors cursor-pointer min-w-[200px]"
                            >
                                <option value="">-- Select a Dungeon --</option>
                                {dungeonPlaces.map((place: Entity) => (
                                    <option key={place.id} value={place.id}>{place.name}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="text-sm font-semibold text-[#38bdf8] bg-[#38bdf8]/10 px-3 py-1 rounded-md border border-[#38bdf8]/20">
                                {selectedPlace?.name || 'Exploring...'}
                            </div>
                        )}

                        {selectedPlace && (
                            <div className="text-xs text-[#4a4d5e]">
                                {mapWidth}×{mapHeight} • {tokens.filter(t => t.type === 'player').length} player(s)
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {hasMap && (
                            <div className="flex items-center gap-1 p-1 bg-[#181a1f] border border-[#2d3036] rounded-lg">
                                <button
                                    onClick={() => setMovementMode('free')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                        movementMode === 'free'
                                            ? 'bg-[#10b981] text-white shadow-lg shadow-[#10b981]/20'
                                            : 'text-[#8a8f98] hover:text-white hover:bg-[#2d3036]'
                                    }`}
                                    title="Free Movement"
                                >
                                    <Move className="w-3.5 h-3.5" />
                                    Free
                                </button>
                                <button
                                    onClick={() => setMovementMode('schematic')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                        movementMode === 'schematic'
                                            ? 'bg-[#10b981] text-white shadow-lg shadow-[#10b981]/20'
                                            : 'text-[#8a8f98] hover:text-white hover:bg-[#2d3036]'
                                    }`}
                                    title="Schematic (Grid) Movement"
                                >
                                    <Gamepad2 className="w-3.5 h-3.5" />
                                    Grid
                                </button>
                            </div>
                        )}

                        {hasMap && isMaster && (
                            <button
                                onClick={() => setShowHidden(!showHidden)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                                    showHidden
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-lg shadow-amber-500/5'
                                        : 'bg-[#23252a] hover:bg-[#2d3036] text-[#8a8f98] border-[#2d3036]'
                                }`}
                                title={showHidden ? "Hide Hidden Tokens" : "Show All Tokens (DM View)"}
                            >
                                <Eye className={`w-3.5 h-3.5 ${showHidden ? 'text-amber-400' : 'text-[#8a8f98]'}`} />
                                <span className="text-xs font-medium">{showHidden ? 'DM View On' : 'DM View'}</span>
                            </button>
                        )}

                        {hasMap && isMaster && (
                            <button
                                onClick={() => {
                                    // Reset FOG on launch
                                    setVisitedCells(new Set());
                                    setOpenDoors(new Set());
                                    if (selectedPlace) {
                                        const currentDataObj = { width: mapWidth, height: mapHeight, cells: Object.values(cells), edges: Object.values(edges), tokens: tokens, visitedCells: [], fovRadius: fovRadius, openDoors: [] };
                                        saveEntity({ ...selectedPlace, map_data: JSON.stringify(currentDataObj) });
                                    }

                                    // Open Master window
                                    window.open(`#/explore/master/${selectedPlaceId}`, '_blank', 'width=1200,height=800');
                                    // Open Player window after a short delay to avoid popup blockers
                                    setTimeout(() => {
                                        window.open(`#/explore/player/${selectedPlaceId}`, '_blank', 'width=1000,height=700');
                                    }, 300);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold border border-[#059669] shadow-lg shadow-[#10b981]/20 transition-all hover:scale-105"
                                title="Launch Master & Player Windows"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                                Launch Sessions
                            </button>
                        )}

                        {hasMap && isMaster && (
                            <button
                                onClick={() => setVisitedCells(new Set())}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/20 transition-colors"
                                title="Reset Fog of War"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reset FOG
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg bg-[#23252a]/80 hover:bg-[#2d3036] text-[#8a8f98] hover:text-white transition-all group"
                            title="Close (Esc)"
                        >
                            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                        </button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 overflow-hidden relative">
                    {!hasMap ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#4a4d5e]">
                            <Eye className="w-12 h-12 mb-4 opacity-30" />
                            <p className="text-lg font-medium text-[#8a8f98]">
                                {dungeonPlaces.length === 0
                                    ? 'No dungeons available'
                                    : 'Select a dungeon to explore'
                                }
                            </p>
                            <p className="text-sm mt-1">
                                {dungeonPlaces.length === 0
                                    ? 'Create a dungeon in the Map Editor and save it to a Place entity first.'
                                    : 'Choose a location from the dropdown above to start exploring.'
                                }
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Controls overlay */}
                            <div className="absolute top-4 left-4 z-10 bg-[#181a1f]/80 backdrop-blur-sm p-3 rounded-lg border border-[#2d3036] shadow-lg text-xs text-[#8a8f98] pointer-events-none">
                                <p className="font-semibold text-[#10b981] mb-1">Explorer Controls</p>
                                <ul className="space-y-0.5 text-[11px]">
                                    <li>• <span className="text-[#a0a5b0]">Drag Players</span> to explore {movementMode === 'schematic' && '(snaps to grid)'}</li>
                                    {movementMode === 'schematic' && selectedTokenId && (
                                        <li>• <span className="text-[#10b981] font-medium">WASD</span> to move selected character</li>
                                    )}
                                    <li>• <span className="text-[#a0a5b0]">Right/Middle Click + Drag</span> to pan</li>
                                    <li>• <span className="text-[#a0a5b0]">Scroll</span> to zoom</li>
                                    <li>• <span className="text-[#a0a5b0]">Esc</span> to close</li>
                                </ul>
                                {movementMode === 'schematic' && !selectedTokenId && (
                                    <p className="mt-2 text-[10px] text-amber-400/80 animate-pulse">Select a character to use WASD</p>
                                )}
                            </div>

                            {/* Reset Camera */}
                            {(scale !== 1 || offset.x !== 0 || offset.y !== 0) && (
                                <button
                                    onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
                                    className="absolute bottom-4 right-4 z-10 px-3 py-1.5 bg-[#23252a] hover:bg-[#2d3036] text-xs text-[#e0e3eb] rounded-md border border-[#2d3036] shadow-lg transition-colors cursor-pointer"
                                >
                                    Reset Camera
                                </button>
                            )}
                        </>
                    )}

                    <div
                        ref={containerRef}
                        className="w-full h-full relative overflow-hidden"
                    >
                        <canvas
                            ref={canvasRef}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseLeave}
                            onWheel={handleWheel}
                            onContextMenu={(e) => e.preventDefault()}
                            className="absolute top-0 left-0 outline-none"
                            style={{
                                cursor: isPanning ? 'grabbing' : draggingTokenId ? 'move' : 'default',
                                display: hasMap ? 'block' : 'none',
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
