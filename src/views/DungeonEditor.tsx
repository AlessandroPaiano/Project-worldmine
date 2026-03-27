import { useState, useRef, useEffect } from 'react';
import { Save, Upload, Trash2, Grid, Wand2 } from 'lucide-react';
import { useStore } from '../store';

function getCellsInLine(p0: { x: number, y: number }, p1: { x: number, y: number }) {
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

function getEdgesInLine(start: { x: number, y: number, orientation: string }, end: { x: number, y: number }) {
    const edges = [];
    if (start.orientation === 'horizontal') {
        const startX = Math.min(start.x, end.x);
        const endX = Math.max(start.x, end.x);
        for (let x = startX; x <= endX; x++) {
            edges.push({ x, y: start.y, orientation: 'horizontal' as const });
        }
    } else {
        const startY = Math.min(start.y, end.y);
        const endY = Math.max(start.y, end.y);
        for (let y = startY; y <= endY; y++) {
            edges.push({ x: start.x, y, orientation: 'vertical' as const });
        }
    }
    return edges;
}

export type TokenType = 'player' | 'enemy' | 'chest' | 'teleport';
type GeneratorMode = 'dungeon' | 'city' | 'forest' | 'puzzle' | 'classic' | 'labyrinth';


// Define cell types and colors
export type CellType = 'empty' | 'wall' | 'floor' | 'door' | 'water';

export const CELL_COLORS: Record<CellType | TokenType, string> = {
    empty: 'transparent',
    wall: '#374151', // gray-700
    floor: '#1f2937', // gray-800
    door: '#d97706', // amber-600
    water: '#2563eb', // blue-600
    player: '#10b981', // emerald-500
    enemy: '#ef4444', // red-500
    chest: '#f59e0b', // amber-500
    teleport: '#8b5cf6', // violet-500
};

interface GridCell {
    x: number;
    y: number;
    type: CellType;
    label?: string;
}

export interface EdgeData {
    x: number;
    y: number;
    orientation: 'horizontal' | 'vertical';
    type: 'wall' | 'door';
}

export interface TokenData {
    id: string; // unique string id
    x: number;  // can be floats now
    y: number;
    type: TokenType;
    label?: string;
    characterId?: string;
}

interface MapData {
    width: number;
    height: number;
    cells: GridCell[];
    edges?: EdgeData[];
    tokens?: TokenData[];
    fovRadius?: number;
}

export default function DungeonEditor() {
    const [mapWidth, setMapWidth] = useState(30);
    const [mapHeight, setMapHeight] = useState(20);
    const [cellSize, setCellSize] = useState(32); // pixels
    const [showGrid, setShowGrid] = useState(true);
    const [currentTool, setCurrentTool] = useState<string>('wall');
    const [drawMode, setDrawMode] = useState<'freehand' | 'line' | 'room'>('freehand');
    const [viewMode, setViewMode] = useState<'edit' | 'explore'>('edit');
    const [visitedCells, setVisitedCells] = useState<Set<string>>(new Set());
    const [isDrawing, setIsDrawing] = useState(false);

    const { entities, fetchEntities, saveEntity } = useStore();
    const [selectedPlaceId, setSelectedPlaceId] = useState<string>('');

    useEffect(() => {
        if (entities.length === 0) {
            fetchEntities();
        }
    }, [entities.length, fetchEntities]);

    const places = entities.filter(e => e.type === 'place');

    type TargetCoordinates =
        | { type: 'edge'; x: number; y: number; orientation: 'horizontal' | 'vertical' }
        | { type: 'cell'; x: number; y: number }
        | { type: 'token'; id: string; x: number; y: number }
        | null;

    const [hoverTarget, setHoverTarget] = useState<TargetCoordinates>(null);
    const [dragStart, setDragStart] = useState<TargetCoordinates>(null);

    // Zoom and Pan
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Store map state
    const [cells, setCells] = useState<Record<string, GridCell>>({});
    const [edges, setEdges] = useState<Record<string, EdgeData>>({});
    const [tokens, setTokens] = useState<TokenData[]>([]);

    const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
    const [generationMode, setGenerationMode] = useState<GeneratorMode>('dungeon');
    const [fovRadius, setFovRadius] = useState<number>(9); // 0 = infinite vision

    // Real-time synchronization for players
    useEffect(() => {
        if (!selectedPlaceId) return;

        const currentDataObj = {
            width: mapWidth,
            height: mapHeight,
            cells: Object.values(cells),
            edges: Object.values(edges),
            tokens: tokens,
            visitedCells: Array.from(visitedCells),
            fovRadius: fovRadius
        };

        const channel = new BroadcastChannel('dungeon-sync');
        channel.postMessage({ placeId: selectedPlaceId, data: currentDataObj });
        channel.close();
    }, [selectedPlaceId, cells, edges, tokens, visitedCells, fovRadius, mapWidth, mapHeight]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

    // Ensure intrinsic canvas dimension matches container 1:1
    useResizeObserver(containerRef, (entry) => {
        const { width, height } = entry.contentRect;
        if (width !== canvasSize.width || height !== canvasSize.height) {
            setCanvasSize({ width, height });
        }
    });

    // Redraw canvas whenever cells or settings change
    useEffect(() => {
        if (viewMode === 'explore') {
            const currentFOV = calculateFOV();
            if (currentFOV) {
                setVisitedCells(prev => {
                    const next = new Set(prev);
                    currentFOV.forEach(cell => next.add(cell));
                    if (next.size === prev.size) return prev;
                    return next;
                });
            }
        }
        drawMap();
    }, [cells, edges, tokens, mapWidth, mapHeight, cellSize, showGrid, hoverTarget, currentTool, isDrawing, dragStart, drawMode, scale, offset, canvasSize, viewMode, draggingTokenId]);

    const calculateFOV = () => {
        const visible = new Set<string>();
        const players = tokens.filter(t => t.type === 'player');
        if (players.length === 0) return null; // No players = see everything or see nothing? We'll return null to see everything (or empty set to see nothing). Let's return empty set if explore mode, but we'll handle that logic in render.

        const radius = fovRadius === 0 ? 999 : fovRadius;

        // Helper to check if a ray hits a wall/door edge
        const blocksRayEdge = (x1: number, y1: number, x2: number, y2: number) => {
            if (x1 === x2 && y1 !== y2) {
                // Moving vertical across horizontal edge
                const edgeY = Math.max(y1, y2);
                const edgeKey1 = `${x1},${edgeY},horizontal`;
                if (edges[edgeKey1]?.type === 'wall' || edges[edgeKey1]?.type === 'door') return true;
            } else if (y1 === y2 && x1 !== x2) {
                // Moving horizontal across vertical edge
                const edgeX = Math.max(x1, x2);
                const edgeKey1 = `${edgeX},${y1},vertical`;
                if (edges[edgeKey1]?.type === 'wall' || edges[edgeKey1]?.type === 'door') return true;
            } else if (Math.abs(x1 - x2) === 1 && Math.abs(y1 - y2) === 1) {
                // Diagonal move: block if edges are walls OR if two diagonal blocks are present
                const ex1 = Math.max(x1, x2);
                const ey1 = Math.max(y1, y2);

                const hEdge = `${x1},${ey1},horizontal`;
                const vEdge = `${ex1},${y1},vertical`;
                const hEdge2 = `${x2},${ey1},horizontal`;
                const vEdge2 = `${ex1},${y2},vertical`;

                if ((edges[hEdge] && edges[vEdge]) || (edges[hEdge2] && edges[vEdge2])) return true;

                // Check diagonal tiles: if both (x1, y2) and (x2, y1) are walls, block diagonal traversal
                const c1 = cells[`${x1},${y2}`];
                const c2 = cells[`${x2},${y1}`];
                if (c1?.type === 'wall' && c2?.type === 'wall') return true;
            }
            return false;
        };

        players.forEach(p => {
            const px = Math.floor(p.x);
            const py = Math.floor(p.y);
            visible.add(`${px},${py}`); // Always see own square

            // Cast rays to perimeter of 18x18 box
            const minX = Math.max(0, px - radius);
            const maxX = Math.min(mapWidth - 1, px + radius);
            const minY = Math.max(0, py - radius);
            const maxY = Math.min(mapHeight - 1, py + radius);

            const castRaysToLine = (x0: number, y0: number, dx: number, dy: number, length: number) => {
                for (let i = 0; i <= length; i++) {
                    const targetX = x0 + dx * i;
                    const targetY = y0 + dy * i;
                    const line = getCellsInLine({ x: px, y: py }, { x: targetX, y: targetY });

                    for (let j = 0; j < line.length; j++) {
                        const cell = line[j];

                        // Distance check (circle approximation instead of square box)
                        if (Math.sqrt(Math.pow(cell.x - px, 2) + Math.pow(cell.y - py, 2)) > radius) {
                            break;
                        }

                        visible.add(`${cell.x},${cell.y}`);

                        // Stop if we hit a wall cell
                        if (cells[`${cell.x},${cell.y}`]?.type === 'wall') {
                            break;
                        }

                        // Stop if the edge between this cell and next cell is blocked
                        if (j < line.length - 1) {
                            const next = line[j + 1];
                            if (blocksRayEdge(cell.x, cell.y, next.x, next.y)) {
                                break;
                            }
                        }
                    }
                }
            };

            // Top edge
            castRaysToLine(minX, minY, 1, 0, maxX - minX);
            // Bottom edge
            castRaysToLine(minX, maxY, 1, 0, maxX - minX);
            // Left edge
            castRaysToLine(minX, minY, 0, 1, maxY - minY);
            // Right edge
            castRaysToLine(maxX, minY, 0, 1, maxY - minY);
        });

        return visible;
    };

    const drawMap = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background
        ctx.fillStyle = '#0f1115'; // Match app background
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Apply Zoom and Pan
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        const visibleCells = viewMode === 'explore' ? calculateFOV() : null;

        // Base background
        ctx.fillStyle = viewMode === 'explore' ? '#000000' : '#181a1f';
        ctx.fillRect(0, 0, mapWidth * cellSize, mapHeight * cellSize);

        // If in explore mode and nothing visible/visited, stop
        if (viewMode === 'explore' && (!visibleCells || visibleCells.size === 0) && visitedCells.size === 0) {
            ctx.restore();
            return;
        }

        // Helper to check visibility
        const isVisible = (x: number, y: number) => {
            if (viewMode === 'edit') return true;
            return visibleCells?.has(`${x},${y}`) || visitedCells.has(`${x},${y}`);
        };

        const isCurrentlyInFOV = (x: number, y: number) => {
            if (viewMode === 'edit') return true;
            return visibleCells?.has(`${x},${y}`);
        };

        // Draw cells
        Object.values(cells).forEach((cell) => {
            if (cell.type === 'empty') return;
            if (!isVisible(cell.x, cell.y)) return;

            const cx = cell.x * cellSize;
            const cy = cell.y * cellSize;

            ctx.fillStyle = CELL_COLORS[cell.type];
            ctx.fillRect(cx, cy, cellSize, cellSize);

            // Add simple inner shadow/texture for walls and floors
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

            // Dim if not in current FOV
            if (viewMode === 'explore' && !isCurrentlyInFOV(cell.x, cell.y)) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(cx, cy, cellSize, cellSize);
            }
        });

        // Draw tokens
        tokens.forEach((token) => {
            const tx = Math.floor(token.x);
            const ty = Math.floor(token.y);

            // Tokens are ONLY visible if in current FOV, unless they are players
            if (viewMode === 'explore' && token.type !== 'player' && !isCurrentlyInFOV(tx, ty)) {
                return;
            }

            const cx = token.x * cellSize;
            const cy = token.y * cellSize;

            ctx.beginPath();
            const centerX = cx + cellSize / 2;
            const centerY = cy + cellSize / 2;

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
                // Outer ring
                ctx.beginPath();
                ctx.arc(centerX, centerY, cellSize / 2.2, 0, 2 * Math.PI);
                ctx.strokeStyle = '#8b5cf6';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 2]); // Dotted spiral effect
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Inner circle
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                ctx.fillStyle = '#8b5cf6';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw label if exists
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
            }

            // Highlight selected/hovered token
            if (draggingTokenId === token.id || (hoverTarget && hoverTarget.type === 'token' && hoverTarget.id === token.id && currentTool === 'select')) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, cellSize / 2, 0, 2 * Math.PI);
                ctx.strokeStyle = '#38bdf8'; // sky-400
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        });

        // Draw grid
        if (showGrid && viewMode === 'edit') {
            ctx.strokeStyle = '#2d3036'; // Match app border color
            ctx.lineWidth = 1;

            for (let x = 0; x <= mapWidth; x++) {
                ctx.beginPath();
                ctx.moveTo(x * cellSize, 0);
                ctx.lineTo(x * cellSize, mapHeight * cellSize);
                ctx.stroke();
            }

            for (let y = 0; y <= mapHeight; y++) {
                ctx.beginPath();
                ctx.moveTo(0, y * cellSize);
                ctx.lineTo(mapWidth * cellSize, y * cellSize);
                ctx.stroke();
            }
        }



        // Draw edges
        Object.values(edges).forEach(edge => {
            if (viewMode === 'explore') {
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

                // Dim if not in active FOV
                if (!adjInFOV) {
                    ctx.globalAlpha = 0.3;
                }
            }

            ctx.beginPath();

            const px = edge.x * cellSize;
            const py = edge.y * cellSize;

            if (edge.type === 'wall') {
                ctx.strokeStyle = '#1f2937'; // outline
                ctx.lineWidth = 6;
                if (edge.orientation === 'horizontal') {
                    ctx.moveTo(px - 1, py); ctx.lineTo(px + cellSize + 1, py);
                } else {
                    ctx.moveTo(px, py - 1); ctx.lineTo(px, py + cellSize + 1);
                }
                ctx.stroke();

                ctx.beginPath();
                ctx.strokeStyle = '#9ca3af'; // inner wall
                ctx.lineWidth = 2;
            } else if (edge.type === 'door') {
                ctx.strokeStyle = '#78350f'; // outline
                ctx.lineWidth = 6;
                if (edge.orientation === 'horizontal') {
                    ctx.moveTo(px + 2, py); ctx.lineTo(px + cellSize - 2, py);
                } else {
                    ctx.moveTo(px, py + 2); ctx.lineTo(px, py + cellSize - 2);
                }
                ctx.stroke();

                ctx.beginPath();
                ctx.strokeStyle = '#fbbf24'; // inner door
                ctx.lineWidth = 2;
            }

            if (edge.orientation === 'horizontal') {
                if (edge.type === 'door') {
                    ctx.moveTo(px + 2, py); ctx.lineTo(px + cellSize - 2, py);
                } else {
                    ctx.moveTo(px, py); ctx.lineTo(px + cellSize, py);
                }
            } else {
                if (edge.type === 'door') {
                    ctx.moveTo(px, py + 2); ctx.lineTo(px, py + cellSize - 2);
                } else {
                    ctx.moveTo(px, py); ctx.lineTo(px, py + cellSize);
                }
            }
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        });

        // Draw hover preview
        let previewTargets: typeof hoverTarget[] = [];
        if (hoverTarget && viewMode === 'edit') {
            if (isDrawing && dragStart) {
                if (drawMode === 'line') {
                    if (dragStart.type === 'cell' && hoverTarget.type === 'cell') {
                        previewTargets = getCellsInLine(dragStart, hoverTarget).map(p => ({ type: 'cell' as const, ...p }));
                    } else if (dragStart.type === 'edge' && hoverTarget.type === 'edge') {
                        previewTargets = getEdgesInLine(dragStart as any, hoverTarget as any).map(p => ({ type: 'edge' as const, ...p }));
                    } else {
                        previewTargets = [hoverTarget];
                    }
                } else if (drawMode === 'room') {
                    if (dragStart.type === 'cell' && hoverTarget.type === 'cell') {
                        const minX = Math.min(dragStart.x, hoverTarget.x);
                        const maxX = Math.max(dragStart.x, hoverTarget.x);
                        const minY = Math.min(dragStart.y, hoverTarget.y);
                        const maxY = Math.max(dragStart.y, hoverTarget.y);

                        for (let x = minX; x <= maxX; x++) {
                            for (let y = minY; y <= maxY; y++) {
                                // Draw walls on outer rim, floors inside
                                if (currentTool === 'wall' || currentTool === 'floor' || currentTool === 'empty') {
                                    previewTargets.push({ type: 'cell' as const, x, y });
                                }
                            }
                        }
                    } else {
                        previewTargets = [hoverTarget];
                    }
                } else {
                    previewTargets = [hoverTarget];
                }
            } else {
                previewTargets = [hoverTarget];
            }
        }

        if (previewTargets.length > 0) {
            ctx.globalAlpha = 0.5;
            previewTargets.forEach(target => {
                if (!target) return;
                if (target.type === 'edge') {
                    ctx.beginPath();
                    if (currentTool === 'empty') {
                        ctx.strokeStyle = '#ef4444';
                        ctx.lineWidth = 6;
                    } else if (currentTool === 'edge-wall') {
                        ctx.strokeStyle = '#9ca3af';
                        ctx.lineWidth = 4;
                    } else if (currentTool === 'edge-door') {
                        ctx.strokeStyle = '#fbbf24';
                        ctx.lineWidth = 4;
                    }

                    const px = target.x * cellSize;
                    const py = target.y * cellSize;

                    if (target.orientation === 'horizontal') {
                        ctx.moveTo(px, py);
                        ctx.lineTo(px + cellSize, py);
                    } else {
                        ctx.moveTo(px, py);
                        ctx.lineTo(px, py + cellSize);
                    }
                    ctx.stroke();
                } else if (target.type === 'cell') {
                    const color = currentTool === 'empty' ? '#ef4444' : CELL_COLORS[currentTool as CellType];
                    if (color) {
                        ctx.fillStyle = color;
                        ctx.fillRect(
                            target.x * cellSize,
                            target.y * cellSize,
                            cellSize,
                            cellSize
                        );
                    }
                }
            });

            if (currentTool === 'player' || currentTool === 'enemy' || currentTool === 'chest' || currentTool === 'teleport') {
                if (hoverTarget && hoverTarget.type === 'cell') {
                    const cx = hoverTarget.x * cellSize;
                    const cy = hoverTarget.y * cellSize;
                    const centerX = cx + cellSize / 2;
                    const centerY = cy + cellSize / 2;
                    ctx.globalAlpha = 0.5;
                    ctx.beginPath();
                    if (currentTool === 'chest') {
                        ctx.rect(centerX - cellSize * 0.3, centerY - cellSize * 0.25, cellSize * 0.6, cellSize * 0.5);
                    } else {
                        const radius = cellSize / 2.5;
                        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                    }
                    ctx.fillStyle = CELL_COLORS[currentTool as TokenType];
                    ctx.fill();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#ffffff';
                    ctx.stroke();
                    ctx.globalAlpha = 1.0;
                }
            }

            ctx.globalAlpha = 1.0;
        }

        // Draw Fog Of War Cover Layer (Absolute Blackout for unexplored)
        if (viewMode === 'explore') {
            ctx.fillStyle = '#000000';
            for (let x = 0; x < mapWidth; x++) {
                for (let y = 0; y < mapHeight; y++) {
                    if (!isVisible(x, y)) {
                        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    }
                }
            }
        }

        ctx.restore();
    };

    const getTargetCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.WheelEvent<HTMLCanvasElement>): TargetCoordinates => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();

        // Adjust coordinate calculation based on pan and zoom
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;

        // Convert screen coordinates to canvas world coordinates
        const canvasX = (rawX - offset.x) / scale;
        const canvasY = (rawY - offset.y) / scale;

        const fx = canvasX / cellSize;
        const fy = canvasY / cellSize;

        const cx = Math.floor(fx);
        const cy = Math.floor(fy);

        if (fx < 0 || fx > mapWidth || fy < 0 || fy > mapHeight) return null;

        if (currentTool === 'select' || currentTool === 'empty' || currentTool === 'player' || currentTool === 'enemy' || currentTool === 'chest' || currentTool === 'teleport') {
            // Check if clicking on token
            for (let i = tokens.length - 1; i >= 0; i--) {
                const t = tokens[i];
                // token is at t.x, t.y -> center is t.x + 0.5, t.y + 0.5
                const tcx = t.x + 0.5;
                const tcy = t.y + 0.5;
                const dx = fx - tcx;
                const dy = fy - tcy;
                if (Math.sqrt(dx * dx + dy * dy) <= 0.5) { // Check if within token radius (approx 0.5 cell)
                    return { type: 'token', id: t.id, x: t.x, y: t.y }; // Return token's actual coordinates
                }
            }
            if (currentTool === 'select') return null; // select only targets tokens for hover
        }

        const dx = fx - cx;
        const dy = fy - cy;

        const distLeft = dx;
        const distRight = 1 - dx;
        const distTop = dy;
        const distBottom = 1 - dy;

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);

        let edgeX = cx;
        let edgeY = cy;
        let orientation: 'horizontal' | 'vertical' = 'vertical';

        if (minDist === distLeft) {
            orientation = 'vertical';
            edgeX = cx;
            edgeY = cy;
        } else if (minDist === distRight) {
            orientation = 'vertical';
            edgeX = cx + 1;
            edgeY = cy;
        } else if (minDist === distTop) {
            orientation = 'horizontal';
            edgeX = cx;
            edgeY = cy;
        } else if (minDist === distBottom) {
            orientation = 'horizontal';
            edgeX = cx;
            edgeY = cy + 1;
        }

        const isTokenTool = currentTool === 'player' || currentTool === 'enemy' || currentTool === 'chest' || currentTool === 'teleport';
        const isEdgeTool = currentTool.startsWith('edge-');
        const isTargetingEdge = !isTokenTool && (isEdgeTool || (currentTool === 'empty' && minDist < 0.25));

        if (isTargetingEdge) {
            if (orientation === 'horizontal' && (edgeX < 0 || edgeX >= mapWidth || edgeY < 0 || edgeY > mapHeight)) return null;
            if (orientation === 'vertical' && (edgeX < 0 || edgeX > mapWidth || edgeY < 0 || edgeY >= mapHeight)) return null;

            return { type: 'edge' as const, x: edgeX, y: edgeY, orientation };
        } else {
            // Prevent drawing if completely outside canvas visually
            // but allow some slack for panning
            return { type: 'cell' as const, x: cx, y: cy };
        }
    };

    const applyBulk = (targets: TargetCoordinates[]) => {
        const newCellsObj: Record<string, GridCell | null> = {};
        const newEdgesObj: Record<string, EdgeData | null> = {};
        const tokensToAdd: TokenData[] = [];
        const tokenIdsToRemove: Set<string> = new Set();

        targets.forEach(target => {
            if (!target) return;

            if (target.type === 'token') {
                if (currentTool === 'empty') {
                    tokenIdsToRemove.add(target.id);
                }
                return; // Tokens are handled separately, not as cells or edges
            }

            if (currentTool === 'player' || currentTool === 'enemy' || currentTool === 'chest' || currentTool === 'teleport') {
                if (target.type === 'cell') {
                    // Check if a token already exists at this cell, if so, remove it first
                    const existingToken = tokens.find(t => Math.floor(t.x) === target.x && Math.floor(t.y) === target.y);
                    if (existingToken) {
                        tokenIdsToRemove.add(existingToken.id);
                    }

                    let label: string | undefined;
                    if (currentTool === 'teleport') {
                        // Auto-assign pair label: find unpaired teleporter or create new pair
                        const existingTeleports = tokens.filter(t => t.type === 'teleport' && !tokenIdsToRemove.has(t.id));
                        // Count how many teleporters share each label
                        const labelCounts: Record<string, number> = {};
                        existingTeleports.forEach(t => {
                            if (t.label) labelCounts[t.label] = (labelCounts[t.label] || 0) + 1;
                        });
                        // Find unpaired label (count === 1)
                        const unpairedLabel = Object.entries(labelCounts).find(([, count]) => count === 1)?.[0];
                        if (unpairedLabel) {
                            label = unpairedLabel;
                        } else {
                            // Generate next letter
                            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                            const usedLabels = new Set(Object.keys(labelCounts));
                            label = alphabet.split('').find(l => !usedLabels.has(l)) || `T${existingTeleports.length + 1}`;
                        }
                    }

                    tokensToAdd.push({
                        id: Date.now().toString() + Math.random(),
                        x: target.x,
                        y: target.y,
                        type: currentTool as TokenType,
                        label
                    });
                }
                return;
            }

            // Additional bounds check before applying
            if (target.x < 0 || target.x >= mapWidth || target.y < 0 || target.y >= mapHeight) {
                if (target.type === 'edge') {
                    if (target.orientation === 'horizontal' && (target.x >= mapWidth || target.y > mapHeight)) return;
                    if (target.orientation === 'vertical' && (target.x > mapWidth || target.y >= mapHeight)) return;
                } else {
                    return;
                }
            }
            if (target.type === 'edge') {
                const key = `${target.x},${target.y},${target.orientation}`;
                if (currentTool === 'empty') {
                    newEdgesObj[key] = null;
                } else if (currentTool === 'edge-wall') {
                    newEdgesObj[key] = { x: target.x, y: target.y, orientation: target.orientation, type: 'wall' };
                } else if (currentTool === 'edge-door') {
                    newEdgesObj[key] = { x: target.x, y: target.y, orientation: target.orientation, type: 'door' };
                }
            } else { // target.type === 'cell'
                const key = `${target.x},${target.y}`;
                if (currentTool === 'empty') {
                    newCellsObj[key] = null;
                } else if (!currentTool.startsWith('edge-')) { // Only apply cell types, not edge types
                    newCellsObj[key] = { x: target.x, y: target.y, type: currentTool as CellType };
                }
            }
        });

        if (Object.keys(newCellsObj).length > 0) {
            setCells(prev => {
                const copy = { ...prev };
                for (const [key, val] of Object.entries(newCellsObj)) {
                    if (val === null) delete copy[key];
                    else copy[key] = val;
                }
                return copy;
            });
        }

        if (Object.keys(newEdgesObj).length > 0) {
            setEdges(prev => {
                const copy = { ...prev };
                for (const [key, val] of Object.entries(newEdgesObj)) {
                    if (val === null) delete copy[key];
                    else copy[key] = val;
                }
                return copy;
            });
        }

        if (tokensToAdd.length > 0 || tokenIdsToRemove.size > 0) {
            setTokens(prev => {
                let updatedTokens = prev.filter(t => !tokenIdsToRemove.has(t.id));
                updatedTokens = [...updatedTokens, ...tokensToAdd];
                return updatedTokens;
            });
        }
    };

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();

        // Adjust scale
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        let newScale = scale * (1 + delta);
        newScale = Math.max(0.2, Math.min(newScale, 5)); // Limit zoom

        // Calculate offset to zoom into cursor
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;

        // Current distance of mouse from origin
        const mouseWorldX = (rawX - offset.x) / scale;
        const mouseWorldY = (rawY - offset.y) / scale;

        // New offset required to keep mouse in same screen space
        const newOffsetX = rawX - mouseWorldX * newScale;
        const newOffsetY = rawY - mouseWorldY * newScale;

        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button === 1 || e.button === 2) { // Middle or Right click to pan
            setIsPanning(true);
            setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
            return;
        }

        const target = getTargetCoordinates(e);
        if (!target) return;

        // In explore mode, only select is allowed
        const activeTool = viewMode === 'explore' ? 'select' : currentTool;

        if (activeTool === 'select' && target.type === 'token') {
            setDraggingTokenId(target.id);
            return;
        }

        if (viewMode === 'explore') return; // Disable all other interactions in explore mode

        if (activeTool === 'empty' && target.type === 'token') {
            applyBulk([target]); // Delete token
            return;
        }

        setIsDrawing(true);
        if (drawMode === 'line' || drawMode === 'room') {
            setDragStart(target);
        } else {
            applyBulk([target]);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isPanning) {
            setOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
            return;
        }

        const target = getTargetCoordinates(e);

        if (draggingTokenId) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;
            const canvasX = (rawX - offset.x) / scale;
            const canvasY = (rawY - offset.y) / scale;

            // Move token directly to mouse, snapping to cell center for visual consistency
            setTokens(prev => prev.map(t => t.id === draggingTokenId ? { ...t, x: (canvasX / cellSize) - 0.5, y: (canvasY / cellSize) - 0.5 } : t));
            return; // don't draw or update hover target while dragging
        }

        // Update hover state if it's different to trigger re-renders
        if (JSON.stringify(target) !== JSON.stringify(hoverTarget)) {
            setHoverTarget(target);
        }

        if (!isDrawing) return;

        if (drawMode === 'freehand' && target) {
            applyBulk([target]);
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (e.button === 1 || e.button === 2) {
            setIsPanning(false);
            return;
        }

        if (isDrawing && (drawMode === 'line' || drawMode === 'room') && dragStart && hoverTarget) {
            let targets: TargetCoordinates[] = [];

            if (drawMode === 'line') {
                if (dragStart.type === 'cell' && hoverTarget.type === 'cell') {
                    targets = getCellsInLine(dragStart, hoverTarget).map(p => ({ type: 'cell' as const, ...p }));
                } else if (dragStart.type === 'edge' && hoverTarget.type === 'edge') {
                    targets = getEdgesInLine(dragStart as any, hoverTarget as any).map(p => ({ type: 'edge' as const, ...p }));
                } else {
                    targets = [hoverTarget];
                }
            } else if (drawMode === 'room') {
                if (dragStart.type === 'cell' && hoverTarget.type === 'cell') {
                    const minX = Math.min(dragStart.x, hoverTarget.x);
                    const maxX = Math.max(dragStart.x, hoverTarget.x);
                    const minY = Math.min(dragStart.y, hoverTarget.y);
                    const maxY = Math.max(dragStart.y, hoverTarget.y);

                    for (let x = minX; x <= maxX; x++) {
                        for (let y = minY; y <= maxY; y++) {
                            // If tool is wall, build a hollow room. If floor/empty, fill solid.
                            if (currentTool === 'wall') {
                                if (x === minX || x === maxX || y === minY || y === maxY) {
                                    targets.push({ type: 'cell' as const, x, y });
                                } else {
                                    // Automatically fill inside with floor if creating a wall room? Optional.
                                }
                            } else {
                                targets.push({ type: 'cell' as const, x, y });
                            }
                        }
                    }
                } else {
                    targets = [hoverTarget];
                }
            }

            if (targets.length > 0) applyBulk(targets);
        }
        setIsDrawing(false);
        setDragStart(null);
        setHoverTarget(null);
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (viewMode !== 'edit') return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        const canvasX = (rawX - offset.x) / scale;
        const canvasY = (rawY - offset.y) / scale;
        const cx = canvasX / cellSize;
        const cy = canvasY / cellSize;

        // Find clicked token
        for (let i = tokens.length - 1; i >= 0; i--) {
            const t = tokens[i];
            const tcx = t.x + 0.5;
            const tcy = t.y + 0.5;
            const dx = cx - tcx;
            const dy = cy - tcy;
            // Token radius is ~0.4 cell size, distance check:
            if (Math.sqrt(dx * dx + dy * dy) <= 0.5) {
                if (t.type === 'player' || t.type === 'enemy') {
                    setCurrentTool('select');
                    setDraggingTokenId(t.id);
                }
                return;
            }
        }
    };

    const handleMouseLeave = () => {
        setHoverTarget(null);
        setIsDrawing(false);
        setDragStart(null);
        setIsPanning(false);
        setDraggingTokenId(null);
    };

    const resetView = () => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
    };

    const handleClear = () => {
        if (confirm('Are you sure you want to clear the map?')) {
            setCells({});
            setEdges({});
            setTokens([]);
            setVisitedCells(new Set());
        }
    };

    const exportMap = () => {
        const mapData: MapData = {
            width: mapWidth,
            height: mapHeight,
            cells: Object.values(cells),
            edges: Object.values(edges),
            tokens: tokens
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mapData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "dungeon_map.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const importMap = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string) as MapData;
                if (json.width && json.height && Array.isArray(json.cells)) {
                    setMapWidth(json.width);
                    setMapHeight(json.height);

                    const newCells: Record<string, GridCell> = {};
                    json.cells.forEach(cell => {
                        newCells[`${cell.x},${cell.y}`] = cell;
                    });
                    setCells(newCells);

                    if (json.edges && Array.isArray(json.edges)) {
                        const newEdges: Record<string, EdgeData> = {};
                        json.edges.forEach(edge => {
                            newEdges[`${edge.x},${edge.y},${edge.orientation}`] = edge;
                        });
                        setEdges(newEdges);
                    } else {
                        setEdges({});
                    }

                    if (json.tokens && Array.isArray(json.tokens)) {
                        setTokens(json.tokens);
                    } else {
                        setTokens([]);
                    }
                } else {
                    alert('Invalid map format.');
                }
            } catch (err) {
                console.error('Failed to import map:', err);
                alert('Failed to parse map file.');
            }
        };
        reader.readAsText(file);

        // Reset input so the same file can be selected again
        e.target.value = '';
    };

    const handleSaveToPlace = async () => {
        if (!selectedPlaceId) return;
        const place = entities.find(e => e.id === selectedPlaceId);
        if (!place) return;

        const mapData: MapData = {
            width: mapWidth,
            height: mapHeight,
            cells: Object.values(cells),
            edges: Object.values(edges),
            tokens: tokens,
            fovRadius: fovRadius
        };

        const confirmSave = confirm(`Are you sure you want to overwrite ${place.name}'s map?`);
        if (!confirmSave) return;

        try {
            await saveEntity({
                ...place,
                map_data: JSON.stringify(mapData)
            });
            alert('Map saved to ' + place.name);
        } catch (err) {
            console.error('Failed to save to place', err);
            alert('Error saving to place');
        }
    };

    const handleLoadFromPlace = () => {
        // ... existing handleLoadFromPlace implementation (keep it as is)
        if (!selectedPlaceId) return;
        const place = entities.find(e => e.id === selectedPlaceId);
        if (!place) return;

        if (!place.map_data) {
            alert('No map data found for this place.');
            return;
        }

        try {
            const json = JSON.parse(place.map_data) as MapData;
            if (json.width && json.height && Array.isArray(json.cells)) {
                setMapWidth(json.width);
                setMapHeight(json.height);

                const newCells: Record<string, GridCell> = {};
                json.cells.forEach(cell => {
                    newCells[`${cell.x},${cell.y}`] = cell;
                });
                setCells(newCells);

                if (json.edges && Array.isArray(json.edges)) {
                    const newEdges: Record<string, EdgeData> = {};
                    json.edges.forEach(edge => {
                        newEdges[`${edge.x},${edge.y},${edge.orientation}`] = edge;
                    });
                    setEdges(newEdges);
                } else {
                    setEdges({});
                }

                if (json.tokens && Array.isArray(json.tokens)) {
                    setTokens(json.tokens);
                } else {
                    setTokens([]);
                }
                setFovRadius(json.fovRadius ?? 9);
                setVisitedCells(new Set());

                alert('Map loaded from ' + place.name);
            } else {
                alert('Invalid map format in entity data.');
            }
        } catch (err) {
            console.error('Failed to parse map_data:', err);
            alert('Failed to parse map data from entity.');
        }
    };

    const generateRandomMap = () => {
        if (!confirm(`This will clear the current map and generate a ${generationMode}. Continue?`)) return;

        const newCells: Record<string, GridCell> = {};
        const newEdges: Record<string, EdgeData> = {};
        const newTokens: TokenData[] = [];

        const createRoom = (rx: number, ry: number, rw: number, rh: number) => {
            for (let x = rx; x < rx + rw; x++) {
                for (let y = ry; y < ry + rh; y++) {
                    newCells[`${x},${y}`] = { x, y, type: 'floor' };
                }
            }
        };

        const createCorridor = (x1: number, y1: number, x2: number, y2: number) => {
            let cx = x1;
            let cy = y1;
            while (cx !== x2) {
                newCells[`${cx},${cy}`] = { x: cx, y: cy, type: 'floor' };
                cx += (x2 > cx ? 1 : -1);
            }
            while (cy !== y2) {
                newCells[`${cx},${cy}`] = { x: cx, y: cy, type: 'floor' };
                cy += (y2 > cy ? 1 : -1);
            }
        };

        const findSafeTile = (prefX?: number, prefY?: number, prefW?: number, prefH?: number): { x: number; y: number } | null => {
            const candidates: { x: number; y: number }[] = [];
            const startX = prefX ?? 0;
            const startY = prefY ?? 0;
            const endX = (prefX !== undefined && prefW !== undefined) ? prefX + prefW : mapWidth;
            const endY = (prefY !== undefined && prefH !== undefined) ? prefY + prefH : mapHeight;

            for (let x = startX; x < endX; x++) {
                for (let y = startY; y < endY; y++) {
                    const key = `${x},${y}`;
                    if (newCells[key]?.type === 'floor' || newCells[key]?.type === 'water') {
                        const occupied = newTokens.some(t => Math.round(t.x) === x && Math.round(t.y) === y);
                        if (!occupied) candidates.push({ x, y });
                    }
                }
            }
            return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
        };

        if (generationMode === 'city') {
            const streetWidth = 2;
            const blockWidth = 5;
            for (let x = 0; x < mapWidth; x++) {
                for (let y = 0; y < mapHeight; y++) {
                    const isStreetX = x % (blockWidth + streetWidth) < streetWidth;
                    const isStreetY = y % (blockWidth + streetWidth) < streetWidth;
                    if (isStreetX || isStreetY) {
                        newCells[`${x},${y}`] = { x, y, type: 'floor' };
                    } else {
                        if (Math.random() > 0.3) {
                            newCells[`${x},${y}`] = { x, y, type: 'wall' };
                        } else {
                            newCells[`${x},${y}`] = { x, y, type: 'floor' };
                        }
                    }
                }
            }
            const numChests = Math.floor((mapWidth * mapHeight) / 200);
            for (let i = 0; i < numChests; i++) {
                const pos = findSafeTile();
                if (pos) newTokens.push({ id: `chest-${i}`, x: pos.x, y: pos.y, type: 'chest' });
            }
            const pPos = findSafeTile();
            if (pPos) newTokens.push({ id: 'player-start', x: pPos.x, y: pPos.y, type: 'player' });

        } else if (generationMode === 'forest') {
            const density = 0.75;
            for (let x = 0; x < mapWidth; x++) {
                for (let y = 0; y < mapHeight; y++) {
                    newCells[`${x},${y}`] = { x, y, type: 'floor' };
                    if (Math.random() > density) {
                        newCells[`${x},${y}`] = { x, y, type: 'wall' };
                    }
                }
            }
            const numEnemies = Math.floor((mapWidth * mapHeight) / 100);
            for (let i = 0; i < numEnemies; i++) {
                const pos = findSafeTile();
                if (pos) newTokens.push({ id: `enemy-${i}`, x: pos.x, y: pos.y, type: 'enemy' });
            }
            const pPos = findSafeTile();
            if (pPos) newTokens.push({ id: 'player-start', x: pPos.x, y: pPos.y, type: 'player' });

        } else if (generationMode === 'puzzle') {
            const numRooms = 8 + Math.floor(Math.random() * 5);
            const margin = 2;
            const rooms: { x: number; y: number; w: number; h: number; zone: number }[] = [];

            for (let attempt = 0; attempt < 300 && rooms.length < numRooms; attempt++) {
                const w = 4 + Math.floor(Math.random() * 5);
                const h = 4 + Math.floor(Math.random() * 4);
                const x = margin + Math.floor(Math.random() * Math.max(1, mapWidth - w - margin * 2));
                const y = margin + Math.floor(Math.random() * Math.max(1, mapHeight - h - margin * 2));
                if (!rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) {
                    rooms.push({ x, y, w, h, zone: -1 });
                }
            }
            rooms.forEach(r => createRoom(r.x, r.y, r.w, r.h));

            const corridors: { from: number; to: number; midX: number; midY: number }[] = [];
            const connected = new Set<number>([0]);
            const unconnected = new Set<number>(rooms.map((_, i) => i).filter(i => i > 0));
            while (unconnected.size > 0) {
                let bestDist = Infinity, bestFrom = 0, bestTo = 0;
                for (const ci of connected) {
                    for (const ui of unconnected) {
                        const dist = Math.abs(rooms[ui].x - rooms[ci].x) + Math.abs(rooms[ui].y - rooms[ci].y);
                        if (dist < bestDist) { bestDist = dist; bestFrom = ci; bestTo = ui; }
                    }
                }
                connected.add(bestTo);
                unconnected.delete(bestTo);
                const r1 = rooms[bestFrom], r2 = rooms[bestTo];
                const sx = Math.floor(r1.x + r1.w / 2), sy = Math.floor(r1.y + r1.h / 2);
                const ex = Math.floor(r2.x + r2.w / 2), ey = Math.floor(r2.y + r2.h / 2);
                createCorridor(sx, sy, ex, ey);
                corridors.push({ from: bestFrom, to: bestTo, midX: ex, midY: sy });
            }

            const solutionPath: number[] = [0];
            const remaining = new Set(rooms.map((_, i) => i).filter(i => i > 0));
            while (remaining.size > 0) {
                const arr = Array.from(remaining);
                const next = arr[Math.floor(Math.random() * arr.length)];
                remaining.delete(next);
                solutionPath.push(next);
            }

            const numZones = Math.max(3, Math.floor(rooms.length / 2));
            const zoneSize = Math.ceil(rooms.length / numZones);
            solutionPath.forEach((ri, i) => rooms[ri].zone = Math.floor(i / zoneSize));
            const maxZone = rooms.reduce((max, r) => Math.max(max, r.zone), 0);

            corridors.forEach(cor => {
                if (rooms[cor.from].zone !== rooms[cor.to].zone) {
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            newCells[`${cor.midX + dx},${cor.midY + dy}`] = { x: cor.midX + dx, y: cor.midY + dy, type: 'wall' };
                        }
                    }
                }
            });

            let tpLabel = 0;
            for (let z = 0; z < maxZone; z++) {
                const zr1 = solutionPath.filter(ri => rooms[ri].zone === z);
                const zr2 = solutionPath.filter(ri => rooms[ri].zone === z + 1);
                if (zr1.length && zr2.length) {
                    const r1 = rooms[zr1[Math.floor(Math.random() * zr1.length)]];
                    const r2 = rooms[zr2[Math.floor(Math.random() * zr2.length)]];
                    const p1 = findSafeTile(r1.x, r1.y, r1.w, r1.h), p2 = findSafeTile(r2.x, r2.y, r2.w, r2.h);
                    if (p1 && p2) {
                        const label = String.fromCharCode(65 + (tpLabel % 26)); tpLabel++;
                        newTokens.push({ id: `sol-${tpLabel}a`, x: p1.x, y: p1.y, type: 'teleport', label });
                        newTokens.push({ id: `sol-${tpLabel}b`, x: p2.x, y: p2.y, type: 'teleport', label });
                    }
                }
            }

            for (let d = 0; d < 4; d++) {
                const z1 = 1 + Math.floor(Math.random() * maxZone), z2 = Math.floor(Math.random() * z1);
                const r1s = solutionPath.filter(ri => rooms[ri].zone === z1), r2s = solutionPath.filter(ri => rooms[ri].zone === z2);
                if (r1s.length && r2s.length) {
                    const p1 = findSafeTile(rooms[r1s[0]].x, rooms[r1s[0]].y, rooms[r1s[0]].w, rooms[r1s[0]].h);
                    const p2 = findSafeTile(rooms[r2s[0]].x, rooms[r2s[0]].y, rooms[r2s[0]].w, rooms[r2s[0]].h);
                    if (p1 && p2) {
                        const label = String.fromCharCode(65 + (tpLabel % 26)); tpLabel++;
                        newTokens.push({ id: `decoy-${d}a`, x: p1.x, y: p1.y, type: 'teleport', label });
                        newTokens.push({ id: `decoy-${d}b`, x: p2.x, y: p2.y, type: 'teleport', label });
                    }
                }
            }

            rooms.forEach(r => {
                if (Math.random() > 0.7) {
                    const wPos = findSafeTile(r.x, r.y, r.w, r.h);
                    if (wPos) newCells[`${wPos.x},${wPos.y}`] = { x: wPos.x, y: wPos.y, type: 'water' };
                }
                if (r.zone > 0 && r.zone < maxZone && Math.random() > 0.5) {
                    const ePos = findSafeTile(r.x, r.y, r.w, r.h);
                    if (ePos) newTokens.push({ id: `enemy-${Math.random()}`, x: ePos.x, y: ePos.y, type: 'enemy' });
                }
            });

            const sRoom = rooms[solutionPath[0]], gRoom = rooms[solutionPath[solutionPath.length - 1]];
            const sPos = findSafeTile(sRoom.x, sRoom.y, sRoom.w, sRoom.h), gPos = findSafeTile(gRoom.x, gRoom.y, gRoom.w, gRoom.h);
            if (sPos) newTokens.push({ id: 'player-start', x: sPos.x, y: sPos.y, type: 'player' });
            if (gPos) newTokens.push({ id: 'goal', x: gPos.x, y: gPos.y, type: 'chest' });

        } else if (generationMode === 'classic') {
            // Classic Single-Floor Dungeon
            const numRooms = 10 + Math.floor(Math.random() * 5);
            const margin = 2;
            const rooms: { x: number; y: number; w: number; h: number }[] = [];

            // Random room scatter
            for (let attempt = 0; attempt < 300 && rooms.length < numRooms; attempt++) {
                const w = 4 + Math.floor(Math.random() * 6);
                const h = 4 + Math.floor(Math.random() * 6);
                const x = margin + Math.floor(Math.random() * Math.max(1, mapWidth - w - margin * 2));
                const y = margin + Math.floor(Math.random() * Math.max(1, mapHeight - h - margin * 2));
                if (!rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) {
                    rooms.push({ x, y, w, h });
                }
            }
            rooms.forEach(r => createRoom(r.x, r.y, r.w, r.h));

            // Connect rooms with MST corridors
            const connected = new Set<number>([0]);
            const unconnected = new Set<number>(rooms.map((_, i) => i).filter(i => i > 0));
            while (unconnected.size > 0) {
                let bestDist = Infinity, bestFrom = 0, bestTo = 0;
                for (const ci of connected) {
                    for (const ui of unconnected) {
                        const dist = Math.abs(rooms[ui].x - rooms[ci].x) + Math.abs(rooms[ui].y - rooms[ci].y);
                        if (dist < bestDist) { bestDist = dist; bestFrom = ci; bestTo = ui; }
                    }
                }
                connected.add(bestTo);
                unconnected.delete(bestTo);
                const r1 = rooms[bestFrom], r2 = rooms[bestTo];
                const sx = Math.floor(r1.x + r1.w / 2), sy = Math.floor(r1.y + r1.h / 2);
                const ex = Math.floor(r2.x + r2.w / 2), ey = Math.floor(r2.y + r2.h / 2);
                createCorridor(sx, sy, ex, ey);
            }
            
            // Spawn tokens
            const numEnemies = Math.floor(rooms.length * 0.5);
            for (let i = 0; i < numEnemies; i++) {
                const r = rooms[Math.floor(Math.random() * rooms.length)];
                const ePos = findSafeTile(r.x, r.y, r.w, r.h);
                if (ePos) newTokens.push({ id: `enemy-${Math.random()}`, x: ePos.x, y: ePos.y, type: 'enemy' });
            }

            const startRoom = rooms[0];
            const endRoom = rooms[rooms.length - 1];
            
            const sPos = findSafeTile(startRoom.x, startRoom.y, startRoom.w, startRoom.h);
            if (sPos) newTokens.push({ id: 'player-start', x: sPos.x, y: sPos.y, type: 'player' });

            const gPos = findSafeTile(endRoom.x, endRoom.y, endRoom.w, endRoom.h);
            if (gPos) newTokens.push({ id: 'goal', x: gPos.x, y: gPos.y, type: 'chest', label: 'Goal' });

        } else if (generationMode === 'labyrinth') {
            // Labyrinth: Dense Cyclic Dungeon
            // Normal-sized rooms packed extremely tight, with lots of shortcut loops
            
            const numRooms = 25; // Try to pack up to 25 rooms
            const margin = 1; // Extremely dense packing
            const rooms: { x: number; y: number; w: number; h: number }[] = [];

            for (let attempt = 0; attempt < 1500 && rooms.length < numRooms; attempt++) {
                // Normal room sizes
                const w = 4 + Math.floor(Math.random() * 5); // 4-8 width
                const h = 4 + Math.floor(Math.random() * 5); // 4-8 height
                
                const maxX = Math.max(0, mapWidth - w - margin * 2);
                const maxY = Math.max(0, mapHeight - h - margin * 2);
                
                const x = margin + Math.floor(Math.random() * maxX);
                const y = margin + Math.floor(Math.random() * maxY);

                // Check for overlap + margin
                if (!rooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) {
                    rooms.push({ x, y, w, h });
                    createRoom(x, y, w, h);
                }
            }

            // MST Connection to guarantee reachability
            const connected = new Set<number>([0]);
            const unconnected = new Set<number>(rooms.map((_, i) => i).filter(i => i > 0));
            const edgesCreated: Record<string, boolean> = {};

            const getDist = (r1: any, r2: any) => Math.abs((r1.x + r1.w/2) - (r2.x + r2.w/2)) + Math.abs((r1.y + r1.h/2) - (r2.y + r2.h/2));

            while (unconnected.size > 0) {
                let bestDist = Infinity, bestFrom = 0, bestTo = 0;
                for (const ci of connected) {
                    for (const ui of unconnected) {
                        const dist = getDist(rooms[ui], rooms[ci]);
                        if (dist < bestDist) { bestDist = dist; bestFrom = ci; bestTo = ui; }
                    }
                }
                connected.add(bestTo);
                unconnected.delete(bestTo);
                
                const r1 = rooms[bestFrom], r2 = rooms[bestTo];
                const sx = Math.floor(r1.x + r1.w / 2), sy = Math.floor(r1.y + r1.h / 2);
                const ex = Math.floor(r2.x + r2.w / 2), ey = Math.floor(r2.y + r2.h / 2);
                createCorridor(sx, sy, ex, ey);
                
                edgesCreated[`${Math.min(bestFrom, bestTo)}-${Math.max(bestFrom, bestTo)}`] = true;
            }

            // Add Labyrinthine Loops (cycles)
            // Heavily interconnect rooms that are physically close to each other
            for (let i = 0; i < rooms.length; i++) {
                for (let j = i + 1; j < rooms.length; j++) {
                    if (!edgesCreated[`${i}-${j}`]) {
                        // Check if they are close enough
                        const dist = getDist(rooms[i], rooms[j]);
                        // If they are physically close (e.g. adjacent or almost adjacent), high chance to connect
                        if (dist < 12 && Math.random() < 0.45) {
                            const sx = Math.floor(rooms[i].x + rooms[i].w / 2);
                            const sy = Math.floor(rooms[i].y + rooms[i].h / 2);
                            const ex = Math.floor(rooms[j].x + rooms[j].w / 2);
                            const ey = Math.floor(rooms[j].y + rooms[j].h / 2);
                            createCorridor(sx, sy, ex, ey);
                        }
                    }
                }
            }

            // Tokens
            const numEnemies = Math.floor(rooms.length * 0.8); // High enemy count
            for (let i = 0; i < numEnemies; i++) {
                const r = rooms[Math.floor(Math.random() * rooms.length)];
                const ePos = findSafeTile(r.x, r.y, r.w, r.h);
                if (ePos) newTokens.push({ id: `enemy-${Math.random()}`, x: ePos.x, y: ePos.y, type: 'enemy' });
            }

            // Start in first room, goal in last room
            const startRoom = rooms[0] || {x: 1, y: 1, w: 1, h: 1};
            const endRoom = rooms[rooms.length - 1] || {x: 1, y: 1, w: 1, h: 1};

            const sPos = findSafeTile(startRoom.x, startRoom.y, startRoom.w, startRoom.h) || { x: 1, y: 1 };
            newTokens.push({ id: 'player-start', x: sPos.x, y: sPos.y, type: 'player' });

            const gPos = findSafeTile(endRoom.x, endRoom.y, endRoom.w, endRoom.h) || { x: 1, y: 1 };
            newTokens.push({ id: 'goal', x: gPos.x, y: gPos.y, type: 'chest', label: 'Goal' });

        } else {
            // Multi-floor Dungeon
            const splitX = Math.floor(mapWidth / 2);
            const floorRooms: { x: number, y: number, w: number, h: number, f: number }[] = [];
            for (let f = 0; f < 2; f++) {
                const offX = f * splitX;
                for (let i = 0; i < 5; i++) {
                    const w = 4 + Math.floor(Math.random() * 4), h = 4 + Math.floor(Math.random() * 4);
                    const x = offX + 1 + Math.floor(Math.random() * (splitX - w - 2)), y = 1 + Math.floor(Math.random() * (mapHeight - h - 2));
                    if (!floorRooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) {
                        floorRooms.push({ x, y, w, h, f });
                        createRoom(x, y, w, h);
                    }
                }
                const cf = floorRooms.filter(r => r.f === f);
                for (let i = 0; i < cf.length - 1; i++) createCorridor(cf[i].x + 2, cf[i].y + 2, cf[i+1].x + 2, cf[i+1].y + 2);
            }
            const f0 = floorRooms.find(r => r.f === 0), f1 = floorRooms.find(r => r.f === 1);
            if (f0 && f1) {
                const p0 = findSafeTile(f0.x, f0.y, f0.w, f0.h), p1 = findSafeTile(f1.x, f1.y, f1.w, f1.h);
                if (p0 && p1) {
                    newTokens.push({ id: 'tp-f0', x: p0.x, y: p0.y, type: 'teleport', label: 'STAIRS' });
                    newTokens.push({ id: 'tp-f1', x: p1.x, y: p1.y, type: 'teleport', label: 'STAIRS' });
                }
            }
            const startR = floorRooms.find(r => r.f === 0);
            if (startR) {
                const sPos = findSafeTile(startR.x, startR.y, startR.w, startR.h);
                if (sPos) newTokens.push({ id: 'player-start', x: sPos.x, y: sPos.y, type: 'player' });
            }
        }

        // Auto-Walls pass
        Object.keys(newCells).forEach(key => {
            const [x, y] = key.split(',').map(Number);
            if (newCells[key].type === 'floor') {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        const nx = x + dx, ny = y + dy;
                        if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight && !newCells[`${nx},${ny}`]) {
                            newCells[`${nx},${ny}`] = { x: nx, y: ny, type: 'wall' };
                        }
                    }
                }
            }
        });

        setCells(newCells);
        setEdges(newEdges);
        setTokens(newTokens);
        setVisitedCells(new Set());
    };

    const tools: { id: string; label: string; icon?: React.ReactNode }[] = [
        { id: 'select', label: 'Select Tool' },
        { id: 'wall', label: 'Tile Wall' },
        { id: 'edge-wall', label: 'Line Wall' },
        { id: 'floor', label: 'Floor' },
        { id: 'door', label: 'Tile Door' },
        { id: 'edge-door', label: 'Line Door' },
        { id: 'water', label: 'Water' },
        { id: 'player', label: 'Player' },
        { id: 'enemy', label: 'Enemy' },
        { id: 'chest', label: 'Chest' },
        { id: 'teleport', label: 'Teleport' },
        { id: 'empty', label: 'Eraser' },
    ];

    return (
        <div className="flex h-full w-full bg-[#0f1115] overflow-hidden">
            {/* Sidebar / Tools */}
            <div className="w-64 bg-[#181a1f] border-r border-[#2d3036] flex flex-col pt-4">
                <div className="p-4 border-b border-[#2d3036]">
                    <h2 className="text-xl font-bold text-[#e0e3eb] flex items-center gap-2">
                        <Grid className="w-5 h-5 text-[#74b1be]" />
                        Map Editor
                    </h2>
                </div>

                {/* View Mode Toggle */}
                <div className="p-4 border-b border-[#2d3036]">
                    <div className="flex rounded-md overflow-hidden border border-[#2d3036] bg-[#0f1115]">
                        <button
                            onClick={() => { setViewMode('edit'); setCurrentTool('wall'); setVisitedCells(new Set()); }}
                            className={`flex-[1.5] py-2 text-xs font-semibold tracking-wider transition-colors ${viewMode === 'edit' ? 'bg-[#74b1be] text-[#0f1115]' : 'text-[#8a8f98] hover:bg-[#23252a]'}`}
                        >
                            EDIT MODE
                        </button>
                        <button
                            onClick={() => { setViewMode('explore'); setCurrentTool('select'); }}
                            className={`flex-[1.5] py-2 text-xs font-semibold tracking-wider transition-colors flex items-center justify-center gap-1 ${viewMode === 'explore' ? 'bg-[#10b981] text-[#0f1115]' : 'text-[#8a8f98] hover:bg-[#23252a]'}`}
                        >
                            EXPLORE MODE
                        </button>
                    </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    {viewMode === 'edit' ? (
                        <>
                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-[#8a8f98] uppercase tracking-wider mb-3">Tools</h3>

                                <div className="mb-4 flex rounded-md overflow-hidden border border-[#2d3036] bg-[#0f1115]">
                                    <button
                                        onClick={() => setDrawMode('freehand')}
                                        className={`flex-1 py-1.5 text-xs font-medium tracking-wider transition-colors ${drawMode === 'freehand' ? 'bg-[#74b1be] text-[#0f1115]' : 'text-[#8a8f98] hover:bg-[#23252a]'}`}
                                    >
                                        Freehand
                                    </button>
                                    <button
                                        onClick={() => setDrawMode('line')}
                                        className={`flex-1 py-1.5 text-xs font-medium tracking-wider transition-colors ${drawMode === 'line' ? 'bg-[#74b1be] text-[#0f1115]' : 'text-[#8a8f98] hover:bg-[#23252a]'}`}
                                    >
                                        Line
                                    </button>
                                    <button
                                        onClick={() => setDrawMode('room')}
                                        className={`flex-1 py-1.5 text-xs font-medium tracking-wider transition-colors ${drawMode === 'room' ? 'bg-[#74b1be] text-[#0f1115]' : 'text-[#8a8f98] hover:bg-[#23252a]'}`}
                                    >
                                        Room
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {tools.map(tool => (
                                        <button
                                            key={tool.id}
                                            onClick={() => setCurrentTool(tool.id)}
                                            className={`px-3 py-2 text-sm rounded-md flex items-center justify-center border transition-colors ${currentTool === tool.id
                                                ? 'bg-[#74b1be]/10 border-[#74b1be] text-[#74b1be]'
                                                : 'border-[#2d3036] text-[#8a8f98] hover:bg-[#23252a] hover:text-[#e0e3eb]'
                                                }`}
                                        >
                                            {tool.id === 'empty' ? 'Eraser' : (
                                                <div className="flex items-center gap-2">
                                                    {tool.id !== 'empty' && tool.id !== 'select' && (
                                                        <div
                                                            className={`w-3 h-3 rounded-sm border border-black/20 ${tool.id.startsWith('edge-') ? 'h-[2px] w-4 my-auto' : ''}`}
                                                            style={{ backgroundColor: tool.id === 'edge-wall' ? '#9ca3af' : tool.id === 'edge-door' ? '#fbbf24' : CELL_COLORS[tool.id as CellType | TokenType] }}
                                                        />
                                                    )}
                                                    {tool.label.split(' ')[0]}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Token Settings */}
                            {currentTool === 'select' && draggingTokenId && (
                                <div className="mb-6 p-3 bg-[#0f1115] border border-[#2d3036] rounded-lg">
                                    <h3 className="text-sm font-medium text-[#e0e3eb] mb-3">Token Settings</h3>
                                    <div className="space-y-4">
                                        {(() => {
                                            const token = tokens.find(t => t.id === draggingTokenId);
                                            if (!token) return null;
                                            
                                            return (
                                                <>
                                                    {(token.type === 'player' || token.type === 'enemy') && (
                                                        <div>
                                                            <label className="text-xs text-[#8a8f98] block mb-1">Linked Character</label>
                                                            <select
                                                                value={token.characterId || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    const char = entities.find(ent => ent.id === val);
                                                                    setTokens(prev => prev.map(t => 
                                                                        t.id === draggingTokenId ? { 
                                                                            ...t, 
                                                                            characterId: val || undefined,
                                                                            label: char ? char.name.substring(0, 2).toUpperCase() : t.label
                                                                        } : t
                                                                    ));
                                                                }}
                                                                className="w-full bg-[#181a1f] border border-[#2d3036] rounded px-2 py-1.5 text-sm text-[#e0e3eb] outline-none focus:border-[#74b1be]"
                                                            >
                                                                <option value="">-- No Link --</option>
                                                                {entities.filter(ent => ent.type === 'character').map(char => (
                                                                    <option key={char.id} value={char.id}>{char.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                    
                                                    <div>
                                                        <label className="text-xs text-[#8a8f98] block mb-1">
                                                            {token.type === 'teleport' ? 'Pair ID' : 'Label / Initial'}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={token.label || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setTokens(prev => prev.map(t => 
                                                                    t.id === draggingTokenId ? { ...t, label: val } : t
                                                                ));
                                                            }}
                                                            className="w-full bg-[#181a1f] border border-[#2d3036] rounded px-2 py-1.5 text-sm text-[#e0e3eb] outline-none focus:border-[#74b1be]"
                                                            placeholder={token.type === 'teleport' ? "e.g. A, 1, Exit..." : "e.g. M, Bo..."}
                                                        />
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-[#8a8f98] uppercase tracking-wider mb-3">Settings</h3>

                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[#e0e3eb]">Width</label>
                                        <input
                                            type="number"
                                            value={mapWidth}
                                            onChange={e => setMapWidth(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-16 bg-[#0f1115] border border-[#2d3036] rounded px-2 py-1 text-right text-[#e0e3eb] outline-none focus:border-[#74b1be]"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[#e0e3eb]">Height</label>
                                        <input
                                            type="number"
                                            value={mapHeight}
                                            onChange={e => setMapHeight(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-16 bg-[#0f1115] border border-[#2d3036] rounded px-2 py-1 text-right text-[#e0e3eb] outline-none focus:border-[#74b1be]"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[#e0e3eb]">Cell Size</label>
                                        <input
                                            type="number"
                                            value={cellSize}
                                            onChange={e => setCellSize(Math.max(10, parseInt(e.target.value) || 10))}
                                            className="w-16 bg-[#0f1115] border border-[#2d3036] rounded px-2 py-1 text-right text-[#e0e3eb] outline-none focus:border-[#74b1be]"
                                        />
                                    </div>

                                    <label className="flex items-center gap-2 mt-4 cursor-pointer text-[#e0e3eb]">
                                        <input
                                            type="checkbox"
                                            checked={showGrid}
                                            onChange={e => setShowGrid(e.target.checked)}
                                            className="rounded border-[#2d3036] bg-[#0f1115] text-[#74b1be] focus:ring-[#74b1be]"
                                        />
                                        Show Grid
                                    </label>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-xs text-[#8a8f98] mb-4">
                            <p className="mb-2 uppercase text-[#e0e3eb] font-semibold">Explore Mode</p>
                            <p className="mb-2">Player vision is limited to a 9-block radius. Drag players to explore the map.</p>
                            <p className="mb-4">Everything you discover remains visible, but dimmed outside your line of sight.</p>

                            <button
                                onClick={() => setVisitedCells(new Set())}
                                className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-md transition-colors text-[10px]"
                            >
                                RESET FOG OF WAR
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-[#2d3036] space-y-2">
                    <button
                        onClick={exportMap}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#23252a] hover:bg-[#2d3036] text-[#e0e3eb] rounded-md transition-colors"
                    >
                        <Save className="w-4 h-4" /> Save JSON
                    </button>

                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-[#8a8f98] uppercase px-1">Player Vision Radius</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={fovRadius === 0 ? 50 : fovRadius}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setFovRadius(val >= 50 ? 0 : val);
                                }}
                                className="flex-1 h-1.5 accent-[#74b1be] cursor-pointer"
                            />
                            <span className="text-xs font-bold text-[#74b1be] w-8 text-right">
                                {fovRadius === 0 ? '∞' : fovRadius}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-medium text-[#8a8f98] uppercase px-1">Generation Mode</label>
                        <select
                            value={generationMode}
                            onChange={(e) => setGenerationMode(e.target.value as GeneratorMode)}
                            className="w-full bg-[#181a1f] border border-[#2d3036] rounded px-2 py-1.5 text-xs text-[#e0e3eb] outline-none focus:border-[#74b1be] mb-2"
                        >
                            <option value="classic">Classic Dungeon</option>
                            <option value="labyrinth">Labyrinth Dungeon</option>
                            <option value="dungeon">Multi-floor Dungeon</option>
                            <option value="city">Procedural City</option>
                            <option value="forest">Mystic Forest</option>
                            <option value="puzzle">Teleport Puzzle</option>
                        </select>
                        <button
                            onClick={generateRandomMap}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#74b1be]/10 hover:bg-[#74b1be]/20 text-[#74b1be] border border-[#74b1be]/20 rounded-md transition-colors"
                        >
                            <Wand2 className="w-4 h-4" /> Auto-Generate
                        </button>
                    </div>

                    <label className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#23252a] hover:bg-[#2d3036] text-[#e0e3eb] rounded-md transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" /> Load JSON
                        <input
                            type="file"
                            accept=".json"
                            onChange={importMap}
                            className="hidden"
                        />
                    </label>

                    <div className="pt-4 border-t border-[#2d3036] space-y-2 mt-4">
                        <h3 className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider mb-2">Linked Place</h3>
                        <select
                            value={selectedPlaceId}
                            onChange={(e) => setSelectedPlaceId(e.target.value)}
                            className="w-full bg-[#0f1115] border border-[#2d3036] rounded px-2 py-2 text-sm text-[#e0e3eb] outline-none focus:border-[#74b1be]"
                        >
                            <option value="">-- Select a Place --</option>
                            {places.map(place => (
                                <option key={place.id} value={place.id}>{place.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleSaveToPlace}
                            disabled={!selectedPlaceId}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" /> Save to Entity
                        </button>
                        <button
                            onClick={handleLoadFromPlace}
                            disabled={!selectedPlaceId}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#74b1be]/10 hover:bg-[#74b1be]/20 text-[#74b1be] border border-[#74b1be]/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Upload className="w-4 h-4" /> Load from Entity
                        </button>
                    </div>

                    <button
                        onClick={handleClear}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-md transition-colors mt-4"
                    >
                        <Trash2 className="w-4 h-4" /> Clear Map
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 overflow-hidden bg-[#0a0a0c] relative flex items-center justify-center">
                {/* Overlay instructions */}
                <div className="absolute top-4 left-4 z-10 bg-[#181a1f]/80 backdrop-blur-sm p-3 rounded-md border border-[#2d3036] shadow-lg text-xs text-[#8a8f98] pointer-events-none">
                    <p className="font-semibold text-[#e0e3eb] mb-1">Controls</p>
                    <ul className="space-y-1">
                        <li>• <span className="text-[#a0a5b0]">Left Click</span> to draw/erase</li>
                        <li>• <span className="text-[#a0a5b0]">Right/Middle Click + Drag</span> to pan camera</li>
                        <li>• <span className="text-[#a0a5b0]">Scroll Wheel</span> to zoom</li>
                    </ul>
                </div>

                {scale !== 1 || offset.x !== 0 || offset.y !== 0 ? (
                    <button
                        onClick={resetView}
                        className="absolute bottom-4 right-4 z-10 px-3 py-1.5 bg-[#23252a] hover:bg-[#2d3036] text-xs text-[#e0e3eb] rounded-md border border-[#2d3036] shadow-lg transition-colors cursor-pointer"
                    >
                        Reset Camera
                    </button>
                ) : null}

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
                        onDoubleClick={handleDoubleClick}
                        onWheel={handleWheel}
                        onContextMenu={(e) => e.preventDefault()}
                        className="absolute top-0 left-0 outline-none"
                        style={{ cursor: isPanning ? 'grabbing' : currentTool === 'empty' ? 'cell' : 'crosshair' }}
                    />
                </div>
            </div>
        </div>
    );
}

// Ensure the physical element maps to its actual dimensions, preventing css distortion.
// We can use a simple generic hook up top or put logic within component. Just using Effect:
function useResizeObserver(ref: React.RefObject<HTMLElement | null>, callback: (entry: ResizeObserverEntry) => void) {
    useEffect(() => {
        if (!ref.current) return;
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) callback(entries[0]);
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ref, callback]);
}
