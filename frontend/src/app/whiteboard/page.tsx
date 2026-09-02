'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Plus, Minus, Trash2, Download, Image, Type, Square, PenTool, Eraser, Hand, Pan, Undo, Redo, Save, Share2 } from 'lucide-react';

const tools = [
  { id: 'select', icon: '👆', label: 'Select', shortcut: 'V' },
  { id: 'pen', icon: '✏️', label: 'Pen', shortcut: 'P' },
  { id: 'eraser', icon: '🧽', label: 'Eraser', shortcut: 'E' },
  { id: 'shape', icon: '🔷', label: 'Shapes', shortcut: 'S' },
  { id: 'text', icon: 'T', label: 'Text', shortcut: 'T' },
  { id: 'image', icon: '🖼️', label: 'Image', shortcut: 'I' },
  { id: 'sticky', icon: '📝', label: 'Sticky Note', shortcut: 'N' },
  { id: 'pen-tool', icon: '✒️', label: 'Pen Tool', shortcut: 'P' },
] as const;

type Tool = typeof tools[number]['id'];

export default function WhiteboardPage() {
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Toolbar
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      {/* Top Toolbar */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-slate-800">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Left: Tools */}
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Whiteboard</h1>
            <div className="flex items-center gap-1 ml-8 border-l border-gray-200 dark:border-slate-700 pl-4">
              {(['select', 'pen', 'eraser', 'shape', 'text', 'image', 'sticky', 'pen-tool'] as const).map((tool) => (
                <button
                  key={tool}
                  onClick={() => setActiveTool(tool as any)}
                  className={`p-2 rounded-lg transition-colors ${
                    activeTool === tool
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                  title={`${tool.charAt(0).toUpperCase() + tool.slice(1)}`}
                >
                  {({
                    select: '👆',
                    pen: '✏️',
                    eraser: '🧽',
                    shape: '🔷',
                    text: 'T',
                    image: '🖼️',
                    sticky: '📝',
                    pen_tool: '✒️',
                  }[tool])}
                </button>
              ))}
            </div>
          </div>

          {/* Center: Canvas Info */}
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>{Math.round(zoom * 100)}%</span>
              <span>•</span>
              <span>Layer 1</span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border-l border-gray-200 dark:border-slate-700 pl-4">
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Undo (Ctrl+Z)">
                <Undo className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" disabled>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Redo (Ctrl+Shift+Z)">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5h6m-6 6h6m-6-6v6m-6 6h6m-6-6h6m-6 6v-6" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-slate-700 pl-4 ml-4">
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Zoom Out">
                <Minus className="w-5 h-5" />
              </button>
              <span className="w-16 text-center text-sm font-medium">{Math.round(zoom * 100)}%</span>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Zoom In">
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-slate-700 pl-4 ml-4">
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Toggle Grid">
                <Square className={cn('w-5 h-5', showGrid ? 'text-primary-500' : 'text-gray-400')} />
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Download as PNG">
                <Download className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title="Share">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Canvas Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Sidebar - Layers/Objects */}
        <aside className="hidden lg:block w-64 bg-white dark:bg-slate-950 border-r border-gray-200 dark:border-slate-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Layers</h3>
            <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
              {[
                { id: 1, name: 'Background', visible: true, locked: false, type: 'image' },
                { id: 2, name: 'Shapes', visible: true, locked: false, type: 'shapes' },
                { id: 3, name: 'Text Elements', visible: true, locked: false, type: 'text' },
                { id: 4, name: 'Annotations', visible: true, locked: false, type: 'annotation' },
              ].map((layer) => (
                <div key={layer.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                  <input type="checkbox" checked={layer.visible} className="w-4 h-4 text-primary-500" />
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white truncate">{layer.name}</span>
                  <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.414-1.414a2 2 0 010-2.828l-7-7a2 2 0 00-2.828 0L3 15.172V21h6.172l4.5-4.5z" strokeWidth={2} /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 border-t border-gray-200 dark:border-slate-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Objects</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {['Rectangle', 'Circle', 'Arrow', 'Sticky Note', 'Image'].map((obj, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{obj}</span>
                  <button className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0">
            <canvas
              ref={canvasRef}
              className="w-full h-full touch-none"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            />
            {/* Grid overlay */}
            {showGrid && (
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3e%3cg fill='none' stroke='%23e5e7eb' stroke-width='0.5'%3e%3cpath d='M30 0v60'/%3e%3cpath d='M0 30h60'/%3e%3c/g%3e%3c/svg%3e")`,
                opacity: 0.5,
              }}
            )}
          </div>

          {/* Toolbar Bottom */}
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3">
            <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-xl shadow-xl p-2 border border-gray-200 dark:border-slate-700">
              {([
                { id: 'select', icon: '👆', label: 'Select (V)' },
                { id: 'pen', icon: '✏️', label: 'Pen (P)' },
                { id: 'eraser', icon: '🧽', label: 'Eraser (E)' },
                { id: 'shape', icon: '🔷', label: 'Shapes (S)' },
                { id: 'text', icon: 'T', label: 'Text (T)' },
                { id: 'image', icon: '🖼️', label: 'Image (I)' },
                { id: 'sticky', icon: '📝', label: 'Sticky (N)' },
                { id: 'pen-tool', icon: '✒️', label: 'Pen Tool (P)' },
              ] as const).map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id as any)}
                  className={`p-2 rounded-lg transition-colors ${
                    activeTool === tool.id
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title={`${tool.label} (${tool.shortcut})`}
                >
                  <span className="text-xl">{tool.icon}</span>
                  <span className="hidden sm:inline ml-1 text-xs font-medium">{tool.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default WhiteboardPage;