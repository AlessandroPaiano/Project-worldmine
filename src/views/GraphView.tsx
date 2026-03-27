import { useCallback, useEffect, useState, useRef, Suspense, lazy } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    BackgroundVariant,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../store';

// Lazily load ForceGraph2D to bypass Vite's static analysis of CJS/ESM exports
const ForceGraph2D = lazy(() => import('react-force-graph-2d'));

// Define a minimal interface for the methods we use to avoid named export issues
interface ForceGraphMethods {
    zoomToFit: (duration?: number, padding?: number) => void;
}

export default function GraphView() {
    const fetchEntities = useStore(state => state.fetchEntities);
    const fetchRelations = useStore(state => state.fetchRelations);
    const entities = useStore(state => state.entities);
    const relations = useStore(state => state.relations);

    const [isDynamic, setIsDynamic] = useState(false);
    const fgRef = useRef<ForceGraphMethods | any>(null);
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        fetchEntities();
        fetchRelations();
    }, [fetchEntities, fetchRelations]);

    useEffect(() => {
        const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- React Flow State (Static) ---
    const reactFlowNodes: Node[] = entities.map((entity, i) => ({
        id: entity.id,
        position: { x: (i % 5) * 200, y: Math.floor(i / 5) * 150 },
        data: { label: entity.name },
        type: 'default',
        style: {
            background: '#181a1f',
            color: '#e0e3eb',
            border: '1px solid #2d3036',
            borderRadius: '8px',
            padding: '10px 15px',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        }
    }));

    const reactFlowEdges: Edge[] = relations.map(r => ({
        id: r.id,
        source: r.source_entity_id,
        target: r.target_entity_id,
        label: r.relation_type,
        animated: true,
        style: { stroke: '#74b1be', strokeWidth: 2 },
        labelStyle: { fill: '#8a8f98', fontWeight: 'bold' }
    }));

    const [nodes, , onNodesChange] = useNodesState(reactFlowNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(reactFlowEdges);

    const onConnect = useCallback(
        (params: any) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#74b1be' } }, eds)),
        [setEdges],
    );

    // --- Force Graph Data (Dynamic) ---
    const graphData = {
        nodes: entities.map(e => ({ id: e.id, name: e.name, val: 5 })),
        links: relations.map(r => ({
            source: r.source_entity_id,
            target: r.target_entity_id,
            name: r.relation_type
        }))
    };

    return (
        <div className="w-full h-full relative" style={{ background: '#0f1115' }}>
            <div className="absolute top-4 left-4 z-10 bg-[#181a1f] p-3 rounded-lg border border-[#2d3036] shadow-lg flex flex-col gap-2">
                <div>
                    <h2 className="text-white font-bold tracking-wider">Entity Relations</h2>
                    <p className="text-[#8a8f98] text-sm mt-1">Explore connections</p>
                </div>
                <button
                    onClick={() => setIsDynamic(!isDynamic)}
                    className="mt-2 px-3 py-1.5 bg-[#2d3036] hover:bg-[#3a3d45] text-[#e0e3eb] text-sm font-medium rounded transition"
                >
                    Switch to {isDynamic ? "Static Mode" : "Dynamic Mode"}
                </button>
            </div>

            {isDynamic ? (
                // ForceGraph expects to fill its container, so we provide dimensions explicitly
                <div className="w-full h-full overflow-hidden">
                    <Suspense fallback={<div className="flex h-full items-center justify-center text-[#4a4d5e]">Loading Dynamic Graph Engine...</div>}>
                        <ForceGraph2D
                            ref={fgRef}
                            graphData={graphData}
                            width={dimensions.width - 64} // Adjust for sidebar approx width
                            height={dimensions.height}
                            nodeLabel="name"
                            nodeColor={() => '#74b1be'}
                            nodeRelSize={6}
                            linkColor={() => 'rgba(116, 177, 190, 0.5)'}
                            linkWidth={2}
                            backgroundColor="#0f1115"
                            linkDirectionalParticles={2}
                            linkDirectionalParticleSpeed={0.01}
                            d3AlphaDecay={0.02}
                            d3VelocityDecay={0.3}
                            onEngineStop={() => fgRef.current?.zoomToFit(400)}
                        />
                    </Suspense>
                </div>
            ) : (
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    colorMode="dark"
                    fitView
                >
                    <Controls
                        style={{ backgroundColor: '#181a1f', borderBottom: '1px solid #2d3036', color: '#e0e3eb' }}
                    />
                    <MiniMap
                        nodeColor="#2d3036"
                        maskColor="rgba(0, 0, 0, 0.7)"
                        style={{ backgroundColor: '#181a1f' }}
                    />
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#2d3036" />
                </ReactFlow>
            )}
        </div>
    );
}
