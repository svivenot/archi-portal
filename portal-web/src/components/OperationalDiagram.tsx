'use client';

import React, { useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  useEdgesState,
  useNodesState,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

// Import custom nodes from CustomNodes
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

// Custom Namespace Group Node Component
function NamespaceGroupNode({ data }: any) {
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      padding: '12px 16px',
      borderRadius: 12,
      background: 'rgba(0, 180, 216, 0.02)',
      border: '1px dashed rgba(0, 180, 216, 0.25)',
      boxShadow: 'inset 0 0 12px rgba(0, 0, 0, 0.2)',
      pointerEvents: 'none'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-glow)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📦 {data.label}
        </h4>
      </div>
      <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {data.description}
      </p>
    </div>
  );
}

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
  namespaceGroup: NamespaceGroupNode
};

interface OperationalDiagramProps {
  services: any[];
  namespaces: any[];
  connections: any[];
}

export default function OperationalDiagram({
  services,
  namespaces,
  connections
}: OperationalDiagramProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Compute Layout Automatically when services/namespaces/connections changes
  useEffect(() => {
    if (services.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const padding = 24;
    const headerHeight = 44;
    const serviceWidth = 220;
    const serviceHeight = 80;
    const colSpacing = 40;
    const rowSpacing = 30;
    
    // Group services by namespace
    const nsGroups: Record<string, any[]> = {};
    
    // Seed with existing namespaces to preserve empty groups
    namespaces.forEach(ns => {
      nsGroups[ns.name] = [];
    });
    
    // Add services
    services.forEach(svc => {
      const ns = svc.namespace || 'Core';
      if (!nsGroups[ns]) {
        nsGroups[ns] = [];
      }
      nsGroups[ns].push(svc);
    });

    const flowNodes: Node[] = [];
    const nsList = Object.keys(nsGroups);
    const nsColsCount = nsList.length > 2 ? 2 : nsList.length;
    
    const nsXCoords: Record<string, number> = {};
    const nsYCoords: Record<string, number> = {};
    const nsWidths: Record<string, number> = {};
    const nsHeights: Record<string, number> = {};

    let currentX = 50;
    let currentY = 50;
    let maxRowHeight = 0;

    // First pass: calculate group sizes & positions
    nsList.forEach((nsName, idx) => {
      const svcs = nsGroups[nsName] || [];
      const svcCount = svcs.length;

      // Group layout dimensions (at least space for one card if empty)
      const svcCols = svcCount > 3 ? 2 : 1;
      const svcRows = svcCount === 0 ? 1 : Math.ceil(svcCount / svcCols);

      const groupWidth = svcCols * serviceWidth + (svcCols - 1) * colSpacing + padding * 2;
      const groupHeight = svcRows * serviceHeight + (svcRows - 1) * rowSpacing + padding * 2 + headerHeight;

      const colIdx = idx % nsColsCount;
      if (colIdx === 0 && idx > 0) {
        currentX = 50;
        currentY += maxRowHeight + 80;
        maxRowHeight = 0;
      }

      nsXCoords[nsName] = currentX;
      nsYCoords[nsName] = currentY;
      nsWidths[nsName] = groupWidth;
      nsHeights[nsName] = groupHeight;

      maxRowHeight = Math.max(maxRowHeight, groupHeight);
      currentX += groupWidth + 80;
    });

    // Second pass: generate group and child nodes
    nsList.forEach(nsName => {
      const nsDetail = namespaces.find(n => n.name === nsName) || { name: nsName, description: '' };
      
      // 1. Group Node
      flowNodes.push({
        id: `ns-${nsName}`,
        type: 'namespaceGroup',
        data: { 
          label: nsName, 
          description: nsDetail.description || `Namespace ${nsName}`
        },
        position: { x: nsXCoords[nsName], y: nsYCoords[nsName] },
        style: { 
          width: nsWidths[nsName], 
          height: nsHeights[nsName],
          zIndex: -1
        }
      });

      // 2. Child nodes inside namespace
      const svcs = nsGroups[nsName] || [];
      const svcCols = svcs.length > 3 ? 2 : 1;
      
      svcs.forEach((svc, sIdx) => {
        const col = sIdx % svcCols;
        const row = Math.floor(sIdx / svcCols);

        const x = padding + col * (serviceWidth + colSpacing);
        const y = padding + headerHeight + row * (serviceHeight + rowSpacing);

        // Normalize registered node type
        const typeLower = (svc.type || 'system').toLowerCase();
        const registeredType = typeLower in nodeTypes ? typeLower : 'system';

        flowNodes.push({
          id: svc.id,
          type: registeredType,
          parentNode: `ns-${nsName}`,
          extent: 'parent',
          data: {
            label: svc.name,
            type: svc.type,
            status: svc.status,
            version: svc.version,
            isEditing: false
          },
          position: { x, y }
        });
      });
    });

    // Generate edges mapping from connections configuration list
    const flowEdges: Edge[] = connections.map((conn: any, index: number) => {
      return {
        id: `e-${conn.from}-${conn.to}-${index}`,
        source: conn.from,
        target: conn.to,
        label: conn.label || '',
        animated: true,
        type: 'smoothstep',
        style: { stroke: 'var(--accent-dim)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--text-secondary)', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: 'var(--bg-card)', fillOpacity: 0.85, rx: 4, ry: 4 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: 'var(--accent-dim)',
        },
      };
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [services, namespaces, connections]);

  return (
    <div id="operational-flow-diagram" style={{ width: '100%', height: '100%', minHeight: 450, position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        maxZoom={1.5}
        minZoom={0.2}
      >
        <Background color="#333" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
