'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import YAML from 'yaml';
import DiagramRenderer from './DiagramRenderer';

interface MarkdownRendererProps {
  content: string;
  onNavigate: (href: string) => void;
}

export default function MarkdownRenderer({ content, onNavigate }: MarkdownRendererProps) {
  // Custom renderer for code blocks
  const renderers = {
    code({ node, inline, className, children, ...props }: any) {
      const codeString = String(children).replace(/\n$/, '');

      // Check if it's our custom architecture diagram block
      const isArchitecture = 
        (className && className.includes('type=architecture-diagram')) ||
        (codeString.includes('nodes:') && codeString.includes('edges:'));

      if (isArchitecture) {
        try {
          const parsed = YAML.parse(codeString);
          const nodes = parsed.nodes || [];
          const edges = parsed.edges || [];
          return (
            <div className="inline-diagram-wrapper">
              <DiagramRenderer initialNodes={nodes} initialEdges={edges} />
            </div>
          );
        } catch (e: any) {
          return (
            <div className="diagram-error-box">
              <span>Erreur lors du rendu du schéma d'architecture :</span>
              <pre className="error-log">{e.message}</pre>
              <pre className="raw-code"><code>{codeString}</code></pre>
            </div>
          );
        }
      }

      // Standard code block
      return inline ? (
        <code className="inline-code" {...props}>
          {children}
        </code>
      ) : (
        <div className="code-block-wrapper">
          <pre className="code-pre">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    },

    // Custom renderer for links
    a({ node, href, children, ...props }: any) {
      const isRelative = href && (href.startsWith('.') || href.startsWith('/') || href.includes('.md'));

      if (isRelative) {
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(href);
            }}
            className="app-link"
            {...props}
          >
            {children}
          </a>
        );
      }

      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="external-link" {...props}>
          {children}
        </a>
      );
    },
  };

  return (
    <div className="markdown-body">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        components={renderers}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
