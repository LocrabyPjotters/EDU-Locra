import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface DidacticMarkdownRendererProps {
  content?: string;
  compact?: boolean;
  className?: string;
}

function extractNodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join(' ');
  if (React.isValidElement(node) && (node.props as any)?.children) {
    return extractNodeText((node.props as any).children);
  }
  return '';
}

function preprocessMarkdownAlerts(raw: string): string {
  // Zet GitHub alert syntax (> [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT]) netjes om in icoon-prefixed blokken
  return raw
    .replace(/> \[!NOTE\]\s*/gi, '> 💡 **Kernbegrip:** ')
    .replace(/> \[!TIP\]\s*/gi, '> 🔍 **Casus & Praktijk:** ')
    .replace(/> \[!WARNING\]\s*/gi, '> ⚠️ **Veelgemaakte Denkfout:** ')
    .replace(/> \[!CAUTION\]\s*/gi, '> ⚠️ **Let op:** ')
    .replace(/> \[!IMPORTANT\]\s*/gi, '> 🎯 **Leerdoel:** ');
}

interface CalloutTheme {
  label: string;
  icon: string;
  bg: string;
  border: string;
  labelColor: string;
}

function detectCalloutTheme(text: string): CalloutTheme {
  const lower = text.toLowerCase();

  if (text.includes('🎯') || lower.includes('leerdoel') || lower.includes('samenvatting')) {
    return {
      label: 'LEERDOEL & KERN',
      icon: '🎯',
      bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14), rgba(6, 182, 212, 0.08))',
      border: 'rgba(52, 211, 153, 0.5)',
      labelColor: '#6ee7b7'
    };
  }
  if (text.includes('⚠️') || lower.includes('denkfout') || lower.includes('misconceptie') || lower.includes('let op') || lower.includes('valkuil')) {
    return {
      label: 'LET OP — VEELGEMAAKTE DENKFOUT',
      icon: '⚠️',
      bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.08))',
      border: 'rgba(251, 191, 36, 0.55)',
      labelColor: '#fcd34d'
    };
  }
  if (text.includes('🔍') || lower.includes('casus') || lower.includes('historische bron') || lower.includes('bron') || lower.includes('praktijkvoorbeeld') || lower.includes('voorbeeld')) {
    return {
      label: 'CASUS & BRON',
      icon: '🔍',
      bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(124, 92, 252, 0.09))',
      border: 'rgba(192, 132, 252, 0.5)',
      labelColor: '#d8b4fe'
    };
  }
  if (text.includes('💡') || lower.includes('kernbegrip') || lower.includes('definitie') || lower.includes('wist je dat')) {
    return {
      label: 'KERNBEGRIP & DEFINITIE',
      icon: '💡',
      bg: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(59, 130, 246, 0.09))',
      border: 'rgba(56, 189, 248, 0.5)',
      labelColor: '#7dd3fc'
    };
  }

  return {
    label: 'INFORMATIEBLOK',
    icon: '📌',
    bg: 'rgba(124, 92, 252, 0.1)',
    border: 'rgba(124, 92, 252, 0.4)',
    labelColor: '#c4b5fd'
  };
}

export default function DidacticMarkdownRenderer({
  content,
  compact = false,
  className
}: DidacticMarkdownRendererProps) {
  if (!content) return null;

  const processed = preprocessMarkdownAlerts(content);
  const baseFontSize = compact ? '0.94rem' : '1.14rem';
  const listFontSize = compact ? '0.92rem' : '1.08rem';

  return (
    <div
      className={className}
      style={{
        lineHeight: 1.65,
        textAlign: 'left',
        width: '100%',
        color: 'rgba(255, 255, 255, 0.92)'
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ node, ...props }) => (
            <p
              style={{
                margin: compact ? '0 0 0.55rem 0' : '0 0 0.85rem 0',
                lineHeight: 1.6,
                fontSize: baseFontSize,
                color: 'rgba(255, 255, 255, 0.92)'
              }}
              {...props}
            />
          ),
          strong: ({ node, ...props }) => (
            <strong style={{ color: '#38bdf8', fontWeight: 800 }} {...props} />
          ),
          em: ({ node, ...props }) => (
            <em style={{ color: '#c4b5fd', fontStyle: 'italic' }} {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul
              style={{
                paddingLeft: '1.4rem',
                margin: compact ? '0 0 0.6rem 0' : '0.3rem 0 0.9rem 0',
                fontSize: listFontSize,
                display: 'flex',
                flexDirection: 'column',
                gap: compact ? '0.25rem' : '0.4rem'
              }}
              {...props}
            />
          ),
          ol: ({ node, ...props }) => (
            <ol
              style={{
                paddingLeft: '1.4rem',
                margin: compact ? '0 0 0.6rem 0' : '0.3rem 0 0.9rem 0',
                fontSize: listFontSize,
                display: 'flex',
                flexDirection: 'column',
                gap: compact ? '0.25rem' : '0.4rem'
              }}
              {...props}
            />
          ),
          li: ({ node, ...props }) => <li style={{ lineHeight: 1.55 }} {...props} />,
          h1: ({ node, ...props }) => (
            <h1 style={{ fontSize: compact ? '1.2rem' : '1.55rem', color: '#fff', fontWeight: 800, margin: '0.4rem 0 0.6rem 0' }} {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 style={{ fontSize: compact ? '1.08rem' : '1.3rem', color: '#c4b5fd', fontWeight: 700, margin: '0.4rem 0 0.5rem 0' }} {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 style={{ fontSize: compact ? '1rem' : '1.15rem', color: '#38bdf8', fontWeight: 700, margin: '0.3rem 0 0.4rem 0' }} {...props} />
          ),
          blockquote: ({ node, children, ...props }) => {
            const rawText = extractNodeText(children);
            const theme = detectCalloutTheme(rawText);

            return (
              <div
                style={{
                  background: theme.bg,
                  border: `1px solid ${theme.border}`,
                  borderLeft: `4px solid ${theme.border}`,
                  borderRadius: '14px',
                  padding: compact ? '0.7rem 0.95rem' : '0.95rem 1.25rem',
                  margin: compact ? '0.6rem 0' : '0.95rem 0',
                  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)'
                }}
              >
                <div
                  style={{
                    fontSize: compact ? '0.68rem' : '0.74rem',
                    fontWeight: 800,
                    color: theme.labelColor,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{theme.icon}</span>
                  <span>{theme.label}</span>
                </div>
                <div style={{ fontSize: compact ? '0.9rem' : '1.05rem', color: '#f8fafc' }}>
                  {children}
                </div>
              </div>
            );
          },
          table: ({ node, ...props }) => (
            <div style={{ overflowX: 'auto', margin: compact ? '0.6rem 0' : '1rem 0', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.14)', background: 'rgba(10, 14, 26, 0.55)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? '0.84rem' : '0.98rem', textAlign: 'left' }} {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead style={{ background: 'rgba(124, 92, 252, 0.22)', borderBottom: '1px solid rgba(255, 255, 255, 0.16)' }} {...props} />
          ),
          th: ({ node, ...props }) => (
            <th style={{ padding: compact ? '0.5rem 0.75rem' : '0.75rem 1rem', fontWeight: 800, color: '#e0e7ff' }} {...props} />
          ),
          td: ({ node, ...props }) => (
            <td style={{ padding: compact ? '0.45rem 0.75rem' : '0.65rem 1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', color: 'rgba(255, 255, 255, 0.9)' }} {...props} />
          ),
          code: ({ node, ...props }) => (
            <code style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '6px', color: '#7dd3fc', fontSize: '0.9em' }} {...props} />
          )
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
