'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';

const tools = [
  { id: 'select', icon: LordIcons.mousePointer, label: 'Select', shortcut: 'V' },
  { id: 'pen', icon: LordIcons.pen, label: 'Pen', shortcut: 'P' },
  { id: 'eraser', icon: LordIcons.eraser, label: 'Eraser', shortcut: 'E' },
  { id: 'shape', icon: LordIcons.shape, label: 'Shapes', shortcut: 'S' },
  { id: 'text', icon: LordIcons.type, label: 'Text', shortcut: 'T' },
  { id: 'image', icon: LordIcons.image, label: 'Image', shortcut: 'I' },
  { id: 'sticky', icon: LordIcons.stickyNote, label: 'Sticky Note', shortcut: 'N' },
  { id: 'pen-tool', icon: LordIcons.penTool, label: 'Pen Tool', shortcut: 'P' },
];

export default function WhiteboardPage() {
  const [activeTool, setActiveTool] = useState('select');
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      {/* Top Toolbar */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-slate-800">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Left: Tools */}
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Whiteboard</h1>
            <div className="flex items-center gap-1 ml-8 border-l border-gray-200 dark:border-slate-700 pl-4">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    activeTool === tool.id
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                  title={`${tool.label} (${tool.shortcut})`}
                >
                  <LordIconComponent src={tool.icon} size={24} />
                  <span className="hidden sm:inline ml-1 text-xs font-medium">{tool.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Center: Canvas Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="p-2" aria-label="Undo">
              <LordIconComponent src={LordIcons.undo} size={20} />
            </Button>
            <Button variant="ghost" size="sm" className="p-2" aria-label="Redo">
              <LordIconComponent src={LordIcons.redo} size={20} />
            </Button>
            <div className="w-px h-6 bg-gray-200 dark:bg-slate-700 mx-2" />
            <Button variant="ghost" size="sm" className="p-2" aria-label="Save">
              <LordIconComponent src={LordIcons.save} size={20} />
            </Button>
            <Button variant="ghost" size="sm" className="p-2" aria-label="Share">
              <LordIconComponent src={LordIcons.share} size={20} />
            </Button>
            <Button variant="ghost" size="sm" className="p-2" aria-label="Download">
              <LordIconComponent src={LordIcons.download} size={20} />
            </Button>
          </div>

          {/* Right: View Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
              <Button variant="ghost" size="sm" className="p-2" aria-label="Zoom Out">
                <LordIconComponent src={LordIcons.minus} size={20} />
              </Button>
              <span className="px-3 text-sm font-medium text-gray-700 dark:text-gray-300">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="sm" className="p-2" aria-label="Zoom In">
                <LordIconComponent src={LordIcons.plus} size={20} />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={`p-2 transition-colors ${showGrid ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setShowGrid(!showGrid)}
              aria-label="Toggle Grid"
            >
              <LordIconComponent src={LordIcons.grid} size={20} />
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <main className="flex-1 relative overflow-hidden">
        <div
          ref={containerRef}
          className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-slate-800"
        >
          <canvas
            ref={canvasRef}
            className="bg-white shadow-xl"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>

        {/* Grid Overlay */}
        {showGrid && (
          <div className="absolute inset-0 bg-[size:20px_20px] bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] pointer-events-none" />
        )}
      </main>
    </div>
  );
}