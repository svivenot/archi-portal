export const escapeXml = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

export function exportCurrentArchToDrawIo(services: any[], namespaces: any[], connections: any[]): string {
  // Layout parameters matching our visual React Flow render positions
  const padding = 30;
  const headerHeight = 50;
  const serviceWidth = 180;
  const serviceHeight = 60;
  const colSpacing = 50;
  const rowSpacing = 40;

  const nsGroups: Record<string, any[]> = {};
  
  // Initialize namespaces
  namespaces.forEach(ns => {
    nsGroups[ns.name] = [];
  });
  
  // Fill services
  services.forEach(svc => {
    const ns = svc.namespace || 'Core';
    if (!nsGroups[ns]) {
      nsGroups[ns] = [];
    }
    nsGroups[ns].push(svc);
  });

  const nsList = Object.keys(nsGroups);
  const nsColsCount = nsList.length > 2 ? 2 : nsList.length;

  const nsXCoords: Record<string, number> = {};
  const nsYCoords: Record<string, number> = {};
  const nsWidths: Record<string, number> = {};
  const nsHeights: Record<string, number> = {};

  let currentX = 50;
  let currentY = 50;
  let maxRowHeight = 0;

  // First pass: calculate dimensions
  nsList.forEach((nsName, idx) => {
    const svcs = nsGroups[nsName] || [];
    const svcCount = svcs.length;
    const svcCols = svcCount > 3 ? 2 : 1;
    const svcRows = svcCount === 0 ? 1 : Math.ceil(svcCount / svcCols);

    const groupWidth = svcCols * serviceWidth + (svcCols - 1) * colSpacing + padding * 2;
    const groupHeight = svcRows * serviceHeight + (svcRows - 1) * rowSpacing + padding * 2 + headerHeight;

    const colIdx = idx % nsColsCount;
    if (colIdx === 0 && idx > 0) {
      currentX = 50;
      currentY += maxRowHeight + 100;
      maxRowHeight = 0;
    }

    nsXCoords[nsName] = currentX;
    nsYCoords[nsName] = currentY;
    nsWidths[nsName] = groupWidth;
    nsHeights[nsName] = groupHeight;

    maxRowHeight = Math.max(maxRowHeight, groupHeight);
    currentX += groupWidth + 100;
  });

  // Construct XML mxGraphModel structure
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="ArchiPortal" modified="${new Date().toISOString()}" agent="ArchiPortal" version="1.0" type="device">
  <diagram id="Page-1" name="Architecture Actuelle">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
`;

  // Write Namespace Swimlane Groups
  nsList.forEach(nsName => {
    const w = nsWidths[nsName];
    const h = nsHeights[nsName];
    const x = nsXCoords[nsName];
    const y = nsYCoords[nsName];
    const label = escapeXml(nsName.toUpperCase());
    
    xml += `        <mxCell id="ns-${nsName}" value="${label}" style="swimlane;whiteSpace=wrap;html=1;dashed=1;dashPattern=1 2;fillColor=rgba(0,180,216,0.02);strokeColor=#00b4d8;fontColor=#00b4d8;fontStyle=1;startSize=30;borderRadius=8;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />
        </mxCell>
`;
  });

  // Write Service Cards inside Swimlane parent elements
  nsList.forEach(nsName => {
    const svcs = nsGroups[nsName] || [];
    const svcCols = svcs.length > 3 ? 2 : 1;

    svcs.forEach((svc, sIdx) => {
      const col = sIdx % svcCols;
      const row = Math.floor(sIdx / svcCols);

      const x = padding + col * (serviceWidth + colSpacing);
      const y = padding + headerHeight + row * (serviceHeight + rowSpacing);

      const label = escapeXml(`${svc.name}\n[${svc.type.toUpperCase()}]`);

      xml += `        <mxCell id="${svc.id}" value="${label}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#334155;fontColor=#ffffff;fontSize=11;fontStyle=1;arcSize=8;align=center;" vertex="1" parent="ns-${nsName}">
          <mxGeometry x="${x}" y="${y}" width="${serviceWidth}" height="${serviceHeight}" as="geometry" />
        </mxCell>
`;
    });
  });

  // Write Connection Edges at the top-level parent (mxCell 1) to enable free-routing across groups
  connections.forEach((conn, index) => {
    const label = escapeXml(conn.label || '');
    xml += `        <mxCell id="edge-${index}" value="${label}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#00b4d8;strokeWidth=2;endArrow=block;endFill=1;fontSize=10;fontColor=#94a3b8;" edge="1" parent="1" source="${conn.from}" target="${conn.to}">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
`;
  });

  xml += `      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  return xml;
}

export function exportProjectDiagramToDrawIo(nodes: any[], edges: any[]): string {
  const serviceWidth = 180;
  const serviceHeight = 60;
  const colSpacing = 100;
  const rowSpacing = 80;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="ArchiPortal" modified="${new Date().toISOString()}" agent="ArchiPortal" version="1.0" type="device">
  <diagram id="Page-1" name="Projet Architecture">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
`;

  // Grid layout for dynamic project C4 nodes
  const cols = Math.ceil(Math.sqrt(nodes.length));
  nodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = 50 + col * (serviceWidth + colSpacing);
    const y = 50 + row * (serviceHeight + rowSpacing);
    const label = escapeXml(`${node.label || node.id}\n[${(node.type || 'system').toUpperCase()}]`);

    xml += `        <mxCell id="${node.id}" value="${label}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#1e293b;strokeColor=#334155;fontColor=#ffffff;fontSize=11;fontStyle=1;arcSize=8;align=center;" vertex="1" parent="1">
          <mxGeometry x="${x}" y="${y}" width="${serviceWidth}" height="${serviceHeight}" as="geometry" />
        </mxCell>
`;
  });

  edges.forEach((edge, index) => {
    const sourceId = edge.from || edge.source;
    const targetId = edge.to || edge.target;
    const label = escapeXml(edge.label || '');
    xml += `        <mxCell id="edge-${index}" value="${label}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#00b4d8;strokeWidth=2;endArrow=block;endFill=1;fontSize=10;fontColor=#94a3b8;" edge="1" parent="1" source="${sourceId}" target="${targetId}">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
`;
  });

  xml += `      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;

  return xml;
}
