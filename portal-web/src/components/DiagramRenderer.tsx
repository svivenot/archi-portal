'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

// Import custom nodes
import {
  UserNode,
  BrowserNode,
  GatewayNode,
  ServiceNode,
  DatabaseNode,
  QueueNode,
  CacheNode,
  ServerNode,
  FolderNode,
  ExternalNode,
  SystemNode,
} from './CustomNodes';

// Register node types for React Flow
const nodeTypes = {
  user: UserNode,
  browser: BrowserNode,
  client: BrowserNode,
  gateway: GatewayNode,
  api_gateway: GatewayNode,
  microservice: ServiceNode,
  service: ServiceNode,
  backend: ServiceNode,
  database: DatabaseNode,
  db: DatabaseNode,
  queue: QueueNode,
  broker: QueueNode,
  cache: CacheNode,
  server: ServerNode,
  folder: FolderNode,
  git: FolderNode,
  'third-party': ExternalNode,
  external: ExternalNode,
  system: SystemNode,
};

const nodeWidth = 220;
const nodeHeight = 80;

interface DiagramRendererProps {
  initialNodes: any[];
  initialEdges: any[];
  isEditing?: boolean;
  onAddNode?: (label: string, type: string) => void;
  onAddEdge?: (source: string, target: string, label: string) => void;
  groupedTypes?: Record<string, { type: string, label: string }[]>;
}

function DiagramContent({ 
  initialNodes, 
  initialEdges, 
  isEditing = false, 
  onAddNode, 
  onAddEdge, 
  groupedTypes = {
    "Générique": [
      { type: "service", label: "Service / API" },
      { type: "database", label: "Base de Données" },
      { type: "browser", label: "Navigateur Client" }
    ]
  }
}: DiagramRendererProps) {
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [direction, setDirection] = useState<'TB' | 'LR'>('LR');

  // Floating controls panel state
  const [localTab, setLocalTab] = useState<'node' | 'edge'>('node');
  const [localNodeLabel, setLocalNodeLabel] = useState('');
  const [localNodeType, setLocalNodeType] = useState('service');
  const [localEdgeSource, setLocalEdgeSource] = useState('');
  const [localEdgeTarget, setLocalEdgeTarget] = useState('');
  const [localEdgeLabel, setLocalEdgeLabel] = useState('');

  // Synchronize dynamic types choice
  useEffect(() => {
    const firstType = Object.values(groupedTypes)[0]?.[0]?.type || 'service';
    const flatTypes = Object.values(groupedTypes).flatMap(list => list.map(item => item.type));
    if (flatTypes.length > 0 && !flatTypes.includes(localNodeType)) {
      setLocalNodeType(firstType);
    }
  }, [groupedTypes, localNodeType]);

  const layoutedElements = useMemo(() => {
    if (initialNodes.length === 0) return { nodes: [], edges: [] };

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, ranksep: 60, nodesep: 40 });

    // 1. Map nodes (propagating edit state to node handles)
    const graphNodes: Node[] = initialNodes.map((n) => {
      const typeLower = (n.type || 'system').toLowerCase();
      const registeredType = typeLower in nodeTypes ? typeLower : 'system';
      return {
        id: n.id,
        type: registeredType,
        data: { 
          label: n.label || n.id,
          type: n.type || 'system',
          status: n.status || 'active',
          isEditing: isEditing
        },
        position: { x: 0, y: 0 },
      };
    });

    // 2. Map edges
    const graphEdges: Edge[] = initialEdges.map((e, index) => {
      const sourceId = e.from || e.source;
      const targetId = e.to || e.target;
      return {
        id: `e-${sourceId}-${targetId}-${index}`,
        source: sourceId,
        target: targetId,
        label: e.label || '',
        animated: true,
        type: 'smoothstep',
        style: { stroke: 'var(--accent-dim)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 },
        labelBgStyle: { fill: 'var(--bg-card)', fillOpacity: 0.8 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: 'var(--accent-dim)',
        },
      };
    });

    // 3. Populate dagre
    graphNodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    graphEdges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // 4. Calculate layout
    dagre.layout(dagreGraph);

    // 5. Build positioned elements
    const positionedNodes = graphNodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      const isHorizontal = direction === 'LR';

      node.targetPosition = isHorizontal ? Position.Left : Position.Top;
      node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

      node.position = {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      };

      return node;
    });

    return { nodes: positionedNodes, edges: graphEdges };
  }, [initialNodes, initialEdges, direction, isEditing]);

  useEffect(() => {
    setNodes(layoutedElements.nodes);
    setEdges(layoutedElements.edges);
    
    // Fit view after a slight timeout to let render finalize
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
    }, 100);
  }, [layoutedElements, setNodes, setEdges, reactFlowInstance]);

  // Handle visual connection dragging on canvas
  const onConnect = (connection: any) => {
    if (isEditing && onAddEdge && connection.source && connection.target) {
      const label = window.prompt("Description de la liaison (optionnelle) :", "") || "";
      onAddEdge(connection.source, connection.target, label);
    }
  };

  return (
    <div className="diagram-container" style={{ position: 'relative' }}>
      <div className="diagram-controls-bar">
        <span className="diagram-title">Schéma Auto-Layout</span>
        <div className="direction-buttons">
          <button 
            className={`control-btn ${direction === 'LR' ? 'active' : ''}`}
            onClick={() => setDirection('LR')}
            title="Disposition Horizontale"
          >
            Horizontal (L → R)
          </button>
          <button 
            className={`control-btn ${direction === 'TB' ? 'active' : ''}`}
            onClick={() => setDirection('TB')}
            title="Disposition Verticale"
          >
            Vertical (T → B)
          </button>
        </div>
      </div>

      {/* Floating Canvas UI Schema Modification Widget */}
      {isEditing && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: 20,
          zIndex: 10,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          padding: 16,
          width: 270,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: 'var(--heading-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚙️ Assistant de Dessin
          </h4>
          
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: 6, gap: 10 }}>
            <button
              type="button"
              className="control-btn"
              onClick={() => setLocalTab('node')}
              style={{ flex: 1, fontSize: '0.75rem', padding: '6px 0', border: 'none', background: localTab === 'node' ? 'rgba(139, 92, 246, 0.1)' : 'transparent', color: localTab === 'node' ? 'var(--color-service)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}
            >
              Composant
            </button>
            <button
              type="button"
              className="control-btn"
              onClick={() => {
                if (nodes.length > 0) {
                  setLocalEdgeSource(nodes[0].id);
                  setLocalEdgeTarget(nodes[nodes.length - 1].id);
                }
                setLocalTab('edge');
              }}
              style={{ flex: 1, fontSize: '0.75rem', padding: '6px 0', border: 'none', background: localTab === 'edge' ? 'rgba(139, 92, 246, 0.1)' : 'transparent', color: localTab === 'edge' ? 'var(--color-service)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}
            >
              Liaison
            </button>
          </div>

          {localTab === 'node' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                className="search-input-field"
                placeholder="Nom (ex: Service Auth)..."
                value={localNodeLabel}
                onChange={(e) => setLocalNodeLabel(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '6px 10px', height: 32, background: 'var(--bg-primary)' }}
              />
              <select
                className="project-select"
                value={localNodeType}
                onChange={(e) => setLocalNodeType(e.target.value)}
                style={{ fontSize: '0.8rem', height: 32, padding: '0 8px', background: 'var(--bg-primary)' }}
              >
                {Object.entries(groupedTypes).map(([groupName, items]) => (
                  <optgroup key={groupName} label={groupName}>
                    {items.map((item) => (
                      <option key={item.type} value={item.type}>
                        {item.label} ({item.type})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (onAddNode && localNodeLabel.trim()) {
                    onAddNode(localNodeLabel, localNodeType);
                    setLocalNodeLabel('');
                  }
                }}
                disabled={!localNodeLabel.trim()}
                style={{ fontSize: '0.75rem', height: 32, padding: 0, cursor: 'pointer' }}
              >
                Ajouter Composant
              </button>
            </div>
          )}

          {localTab === 'edge' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select
                className="project-select"
                value={localEdgeSource}
                onChange={(e) => setLocalEdgeSource(e.target.value)}
                style={{ fontSize: '0.8rem', height: 32, padding: '0 8px', background: 'var(--bg-primary)' }}
              >
                <option value="">-- Source --</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.data?.label || n.id}
                  </option>
                ))}
              </select>
              <select
                className="project-select"
                value={localEdgeTarget}
                onChange={(e) => setLocalEdgeTarget(e.target.value)}
                style={{ fontSize: '0.8rem', height: 32, padding: '0 8px', background: 'var(--bg-primary)' }}
              >
                <option value="">-- Cible --</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.data?.label || n.id}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="search-input-field"
                placeholder="Description (ex: HTTPS)..."
                value={localEdgeLabel}
                onChange={(e) => setLocalEdgeLabel(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '6px 10px', height: 32, background: 'var(--bg-primary)' }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (onAddEdge && localEdgeSource && localEdgeTarget) {
                    onAddEdge(localEdgeSource, localEdgeTarget, localEdgeLabel);
                    setLocalEdgeLabel('');
                  }
                }}
                disabled={!localEdgeSource || !localEdgeTarget}
                style={{ fontSize: '0.75rem', height: 32, padding: 0, cursor: 'pointer' }}
              >
                Relier Composants
              </button>
            </div>
          )}
        </div>
      )}

      <div className="diagram-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="var(--accent-glow)" gap={16} size={1} />
          <Controls showInteractive={false} className="custom-flow-controls" />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function DiagramRenderer(props: DiagramRendererProps) {
  return (
    <ReactFlowProvider>
      <DiagramContent {...props} />
    </ReactFlowProvider>
  );
}
