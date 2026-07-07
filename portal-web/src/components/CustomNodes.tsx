'use client';

import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import * as LucideIcons from 'lucide-react';

interface NodeProps {
  data: {
    label: string;
    type?: string;
    status?: string;
  };
}

// Default icons mapping (used as fallback or loaded state)
let dynamicIconsMap: Record<string, string> = {
  "user": "User",
  "browser": "Laptop",
  "client": "Laptop",
  "gateway": "Shuffle",
  "api_gateway": "Shuffle",
  "microservice": "Cpu",
  "service": "Cpu",
  "backend": "Cpu",
  "database": "Database",
  "db": "Database",
  "queue": "Shuffle",
  "broker": "Shuffle",
  "cache": "Zap",
  "server": "HardDrive",
  "folder": "FolderGit2",
  "git": "FolderGit2",
  "third-party": "Cloud",
  "external": "Cloud",
  "system": "Box",
  "aws": "/icons/aws/generic.svg",
  "azure": "/icons/azure/generic.svg",
  "kubernetes": "/icons/k8s/generic.svg",
  "k8s": "/icons/k8s/generic.svg",
  
  // AWS Library
  "aws-lambda": "/icons/aws/lambda.svg",
  "aws-step-functions": "/icons/aws/step-functions.svg",
  "aws-s3": "/icons/aws/s3.svg",
  "aws-dynamodb": "/icons/aws/dynamodb.svg",
  "aws-sqs": "/icons/aws/sqs.svg",
  "aws-rds": "/icons/aws/rds.svg",
  "aws-ecs": "/icons/aws/ecs.svg",
  "aws-eks": "/icons/aws/eks.svg",
  "aws-api-gateway": "/icons/aws/api-gateway.svg",
  
  // Azure Library
  "azure-function": "/icons/azure/function.svg",
  "azure-blob-storage": "/icons/azure/blob-storage.svg",
  "azure-cosmosdb": "/icons/azure/cosmosdb.svg",
  "azure-service-bus": "/icons/azure/service-bus.svg",
  "azure-app-service": "/icons/azure/app-service.svg",
  "azure-sql": "/icons/azure/sql.svg",
  
  // Kubernetes Library
  "k8s-pod": "/icons/k8s/pod.svg",
  "k8s-deployment": "/icons/k8s/deployment.svg",
  "k8s-service": "/icons/k8s/service.svg",
  "k8s-ingress": "/icons/k8s/ingress.svg",
  "k8s-job": "/icons/k8s/job.svg",
  "k8s-configmap": "/icons/k8s/configmap.svg",
  "k8s-secret": "/icons/k8s/secret.svg"
};

// Global setter to allow updating from app state
export const setDynamicIconsMap = (map: Record<string, string>) => {
  dynamicIconsMap = { ...dynamicIconsMap, ...map };
};

// Helper to get raw dynamic map (for dashboard configuration)
export const getDynamicIconsMap = () => {
  return dynamicIconsMap;
};

// In-memory cache for loaded SVG strings to avoid multiple fetch requests
const svgCache: Record<string, string> = {};

function SvgIcon({ src, size }: { src: string; size: number }) {
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    if (!src) return;
    
    // Fallback to basic image rendering if it is not an SVG file
    if (src.startsWith('data:image/') || !src.endsWith('.svg')) {
      setSvgContent(`<img src="${src}" style="width: 100%; height: 100%; object-fit: contain;" />`);
      return;
    }

    if (svgCache[src]) {
      setSvgContent(svgCache[src]);
      return;
    }

    fetch(src)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch SVG");
        return res.text();
      })
      .then(text => {
        const svgStartIndex = text.indexOf('<svg');
        const cleanText = svgStartIndex !== -1 ? text.substring(svgStartIndex) : text;
        svgCache[src] = cleanText;
        setSvgContent(cleanText);
      })
      .catch(err => {
        console.error("Failed to load SVG icon:", src, err);
        // Graceful fallback to img tag if file cannot be retrieved
        setSvgContent(`<img src="${src}" style="width: 100%; height: 100%; object-fit: contain;" />`);
      });
  }, [src]);

  if (!svgContent) {
    return <div style={{ width: size, height: size, background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }} />;
  }

  // Adjust container size and dynamically strip fixed width/height inside loaded SVG tag
  return (
    <div 
      style={{ 
        width: size, 
        height: size, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexShrink: 0
      }}
      dangerouslySetInnerHTML={{ 
        __html: svgContent
          .replace(/<svg([^>]*)(width="[^"]*")/gi, '<svg$1width="100%"')
          .replace(/<svg([^>]*)(height="[^"]*")/gi, '<svg$1height="100%"')
      }}
    />
  );
}

// Icon mapper for component types
export const getIcon = (type: string) => {
  const iconSize = 22;
  const style = { color: 'var(--accent-glow)' };

  const typeLower = type?.toLowerCase() || 'system';
  const iconName = dynamicIconsMap[typeLower] || 'HelpCircle';
  
  // Detect if iconName is a URL or a Base64 string
  const isUrlOrImage = 
    iconName.startsWith('http://') || 
    iconName.startsWith('https://') || 
    iconName.startsWith('/') || 
    iconName.startsWith('data:image/');

  if (isUrlOrImage) {
    return <SvgIcon src={iconName} size={iconSize} />;
  }

  // Resolve icon component dynamically from Lucide namespace
  const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.HelpCircle;
  
  // Keep original rotation for queue nodes if using Shuffle
  if ((typeLower === 'queue' || typeLower === 'broker') && iconName === 'Shuffle') {
    return <IconComponent size={iconSize} style={{ ...style, transform: 'rotate(90deg)' }} />;
  }
  
  return <IconComponent size={iconSize} style={style} />;
};

const CustomNodeBase: React.FC<NodeProps & { className?: string }> = ({ data, className = '' }) => {
  const nodeType = data.type || 'system';
  const status = data.status || 'active';
  const isEditing = (data as any).isEditing;

  const handleStyle = isEditing
    ? { width: 8, height: 8, background: 'var(--accent-glow)', border: '2px solid #fff', borderRadius: '50%', cursor: 'crosshair', opacity: 1 }
    : { opacity: 0 };

  return (
    <div className={`architecture-node ${nodeType}-node ${className}`}>
      <Handle type="target" position={Position.Top} id="top-target" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={handleStyle} />
      <Handle type="target" position={Position.Left} id="left-target" style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right-source" style={handleStyle} />

      <div className="node-content">
        <div className="node-icon-wrapper">
          {getIcon(nodeType)}
        </div>
        <div className="node-details">
          <span className="node-label">{data.label}</span>
          <span className="node-sublabel">{nodeType.toUpperCase()}</span>
        </div>
        {status === 'active' && <div className="status-indicator active" title="Active" />}
      </div>
    </div>
  );
};

export const UserNode = (props: NodeProps) => <CustomNodeBase {...props} className="user-node-style" />;
export const BrowserNode = (props: NodeProps) => <CustomNodeBase {...props} className="browser-node-style" />;
export const GatewayNode = (props: NodeProps) => <CustomNodeBase {...props} className="gateway-node-style" />;
export const ServiceNode = (props: NodeProps) => <CustomNodeBase {...props} className="service-node-style" />;
export const DatabaseNode = (props: NodeProps) => <CustomNodeBase {...props} className="database-node-style" />;
export const QueueNode = (props: NodeProps) => <CustomNodeBase {...props} className="queue-node-style" />;
export const CacheNode = (props: NodeProps) => <CustomNodeBase {...props} className="cache-node-style" />;
export const ServerNode = (props: NodeProps) => <CustomNodeBase {...props} className="server-node-style" />;
export const FolderNode = (props: NodeProps) => <CustomNodeBase {...props} className="folder-node-style" />;
export const ExternalNode = (props: NodeProps) => <CustomNodeBase {...props} className="external-node-style" />;
export const SystemNode = (props: NodeProps) => <CustomNodeBase {...props} className="system-node-style" />;
