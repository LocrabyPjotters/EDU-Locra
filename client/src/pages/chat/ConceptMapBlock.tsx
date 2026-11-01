import React, { useState, useId } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Download, Copy, Check, GitFork } from 'lucide-react';

export interface ConceptNode {
  id?: string;
  label: string;
  detail?: string;
  color?: string;
  children?: ConceptNode[];
}

export interface ConceptMapData {
  title?: string;
  root: ConceptNode;
}

interface ConceptMapBlockProps {
  data: ConceptMapData;
  theme?: 'dark' | 'light';
}

interface RenderedNode {
  x: number;
  y: number;
  width: number;
  height: number;
  data: ConceptNode;
  depth: number;
  parentId?: string;
  id: string;
}

interface Connection {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  depth: number;
}

const DEPTH_COLORS = [
  { bg: 'rgba(99, 102, 241, 0.25)', border: '#818cf8', text: '#e0e7ff', glow: 'rgba(99, 102, 241, 0.4)' },
  { bg: 'rgba(14, 165, 233, 0.25)', border: '#38bdf8', text: '#e0f2fe', glow: 'rgba(14, 165, 233, 0.4)' },
  { bg: 'rgba(16, 185, 129, 0.25)', border: '#34d399', text: '#d1fae5', glow: 'rgba(16, 185, 129, 0.4)' },
  { bg: 'rgba(245, 158, 11, 0.25)', border: '#fbbf24', text: '#fef3c7', glow: 'rgba(245, 158, 11, 0.4)' },
  { bg: 'rgba(236, 72, 153, 0.25)', border: '#f472b6', text: '#fce7f3', glow: 'rgba(236, 72, 153, 0.4)' }
];

export default function ConceptMapBlock({ data }: ConceptMapBlockProps) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const svgId = useId();

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Layout berekening
  const renderedNodes: RenderedNode[] = [];
  const connections: Connection[] = [];

  let currentY = 40;
  const LEVEL_WIDTH = 240;
  const NODE_HEIGHT = 64;
  const NODE_WIDTH = 190;
  const VERTICAL_SPACING = 24;

  const calculateNodePositions = (node: ConceptNode, depth = 0, parent?: RenderedNode): number => {
    const nodeId = node.id || `${depth}-${node.label}-${Math.random()}`;
    const isCollapsed = collapsedNodes[nodeId];
    const x = 50 + depth * LEVEL_WIDTH;

    let nodeY: number;

    if (!node.children || node.children.length === 0 || isCollapsed) {
      nodeY = currentY;
      currentY += NODE_HEIGHT + VERTICAL_SPACING;
    } else {
      const childrenYStart = currentY;
      const childYPositions: number[] = [];
      for (const child of node.children) {
        const childY = calculateNodePositions(child, depth + 1, {
          x,
          y: 0,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          data: node,
          depth,
          id: nodeId
        });
        childYPositions.push(childY);
      }
      const firstChildY = childYPositions[0];
      const lastChildY = childYPositions[childYPositions.length - 1];
      nodeY = (firstChildY + lastChildY) / 2;
    }

    const currentRendered: RenderedNode = {
      x,
      y: nodeY,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: node,
      depth,
      parentId: parent?.id,
      id: nodeId
    };

    renderedNodes.push(currentRendered);

    if (parent) {
      connections.push({
        fromX: parent.x + parent.width,
        fromY: parent.y + parent.height / 2,
        toX: x,
        toY: nodeY + NODE_HEIGHT / 2,
        depth
      });
    }

    return nodeY;
  };

  if (data?.root) {
    calculateNodePositions(data.root, 0);
  }

  const maxX = Math.max(...renderedNodes.map(n => n.x + n.width), 600) + 60;
  const maxY = Math.max(...renderedNodes.map(n => n.y + n.height), 300) + 60;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    const svgElem = document.getElementById(svgId);
    if (!svgElem) return;
    const svgData = new XMLSerializer().serializeToString(svgElem);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${data.title || 'concept-map'}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        margin: '1.25rem 0',
        borderRadius: '16px',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden',
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? '1rem' : 'auto',
        zIndex: isFullscreen ? 9999 : 1,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Top toolbar */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              padding: '6px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <GitFork size={16} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc' }}>
              {data.title || 'Visuele Mindmap & Concept Schema'}
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Klik op een knooppunt om takken in of uit te klappen
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
            style={{
              padding: '5px 8px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem'
            }}
            title="Uitzoomen"
          >
            <ZoomOut size={13} />
          </button>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', minWidth: '40px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(2, z + 0.15))}
            style={{
              padding: '5px 8px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem'
            }}
            title="Inzoomen"
          >
            <ZoomIn size={13} />
          </button>

          <button
            type="button"
            onClick={handleDownloadSvg}
            style={{
              padding: '5px 8px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem'
            }}
            title="Download als SVG"
          >
            <Download size={13} /> SVG
          </button>

          <button
            type="button"
            onClick={handleCopyJson}
            style={{
              padding: '5px 8px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem'
            }}
            title="Kopieer structuur"
          >
            {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              padding: '5px 8px',
              borderRadius: '8px',
              background: isFullscreen ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: isFullscreen ? '#a5b4fc' : '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem'
            }}
            title={isFullscreen ? 'Sluit volledig scherm' : 'Volledig scherm'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          maxHeight: isFullscreen ? 'calc(100vh - 80px)' : '460px',
          padding: '1.5rem',
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'flex-start'
        }}
      >
        <svg
          id={svgId}
          width={maxX * zoom}
          height={maxY * zoom}
          viewBox={`0 0 ${maxX} ${maxY}`}
          style={{
            minWidth: `${maxX * zoom}px`,
            minHeight: `${maxY * zoom}px`,
            transition: 'transform 0.2s ease-out'
          }}
        >
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
            </linearGradient>
            <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.4)" />
            </filter>
          </defs>

          {/* Connectors (Bezier Curves) */}
          {connections.map((c, i) => {
            const deltaX = (c.toX - c.fromX) / 2;
            const pathD = `M ${c.fromX} ${c.fromY} C ${c.fromX + deltaX} ${c.fromY}, ${c.toX - deltaX} ${c.toY}, ${c.toX} ${c.toY}`;
            const colorMeta = DEPTH_COLORS[Math.min(c.depth, DEPTH_COLORS.length - 1)];

            return (
              <g key={`conn-${i}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke={colorMeta.border}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              </g>
            );
          })}

          {/* Nodes */}
          {renderedNodes.map(node => {
            const colorMeta = DEPTH_COLORS[Math.min(node.depth, DEPTH_COLORS.length - 1)];
            const hasChildren = node.data.children && node.data.children.length > 0;
            const isCollapsed = collapsedNodes[node.id];

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => hasChildren && toggleCollapse(node.id)}
                style={{ cursor: hasChildren ? 'pointer' : 'default' }}
                filter="url(#nodeGlow)"
              >
                {/* Node Box */}
                <rect
                  width={node.width}
                  height={node.height}
                  rx="12"
                  fill={colorMeta.bg}
                  stroke={colorMeta.border}
                  strokeWidth={node.depth === 0 ? '2' : '1.5'}
                />

                {/* Left accent bar */}
                <rect
                  x="0"
                  y="4"
                  width="4"
                  height={node.height - 8}
                  rx="2"
                  fill={colorMeta.border}
                />

                {/* Node Label */}
                <text
                  x="14"
                  y={node.data.detail ? 26 : 37}
                  fill={colorMeta.text}
                  fontSize={node.depth === 0 ? '14' : '12'}
                  fontWeight={node.depth === 0 ? '800' : '700'}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {node.data.label.length > 20 ? `${node.data.label.substring(0, 18)}…` : node.data.label}
                </text>

                {/* Node Detail */}
                {node.data.detail && (
                  <text
                    x="14"
                    y="46"
                    fill="rgba(255, 255, 255, 0.65)"
                    fontSize="10"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {node.data.detail.length > 26 ? `${node.data.detail.substring(0, 24)}…` : node.data.detail}
                  </text>
                )}

                {/* Expand / Collapse Indicator */}
                {hasChildren && (
                  <circle
                    cx={node.width}
                    cy={node.height / 2}
                    r="8"
                    fill={colorMeta.border}
                    stroke="#0f172a"
                    strokeWidth="2"
                  />
                )}
                {hasChildren && (
                  <text
                    x={node.width}
                    y={node.height / 2 + 3.5}
                    textAnchor="middle"
                    fill="#0f172a"
                    fontSize="10"
                    fontWeight="900"
                  >
                    {isCollapsed ? '+' : '−'}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * Parsed :::concept_map { JSON } ::: uit chat berichten.
 */
export function parseConceptMapBlocks(content: string): { before: string; conceptMap: ConceptMapData | null; after: string } {
  if (!content) return { before: '', conceptMap: null, after: '' };

  const mapRegex = /:::concept_map\s*([\s\S]*?)\s*:::/i;
  const match = content.match(mapRegex);

  if (!match) {
    return { before: content, conceptMap: null, after: '' };
  }

  const before = content.substring(0, match.index || 0).trim();
  const after = content.substring((match.index || 0) + match[0].length).trim();

  try {
    const cleanJson = match[1]
      .replace(/[\u200B-\u200D\u200E\u200F\u2060\u200A\uFEFF]/g, '')
      .trim();

    const parsed = JSON.parse(cleanJson);
    if (parsed && (parsed.root || parsed.label)) {
      const normalized: ConceptMapData = {
        title: parsed.title,
        root: parsed.root || parsed
      };
      return { before, conceptMap: normalized, after };
    }
  } catch (e) {
    console.warn('Kon concept_map JSON niet parsen:', e);
  }

  return { before: content, conceptMap: null, after: '' };
}

