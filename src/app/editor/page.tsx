'use client';

import { useCallback, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Toolbar } from '@/features/canvas/components/toolbar';
import { useCanvasStore } from '@/features/canvas';
import { useCanvasPersistence, useCanvasKeyboard } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Sparkles, Save, Download, Share2, Cloud, CloudOff, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Dynamically import InfiniteCanvas to avoid SSR issues with Konva
const InfiniteCanvas = dynamic(
  () => import('@/features/canvas').then((mod) => mod.InfiniteCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    ),
  }
);

export default function EditorPage() {
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [showDebug, setShowDebug] = useState(false);
  useCanvasStore();

  // Persistence with auto-save
  const { isDirty, isSaving, syncStatus, saveNow } = useCanvasPersistence({
    projectId: 'default-project',
    debounceMs: 2000,
    enableLocalStorage: true,
    enableServerSync: false, // Enable when API is ready
  });

  // Keyboard shortcuts
  useCanvasKeyboard({ enabled: true });

  // Update canvas size on window resize
  useEffect(() => {
    const updateSize = () => {
      const container = document.getElementById('canvas-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        setCanvasSize({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleSave = useCallback(async () => {
    await saveNow();
  }, [saveNow]);

  const handleExport = useCallback(() => {
    // Export canvas as PNG
    const stage = document.querySelector('canvas');
    if (stage) {
      const link = document.createElement('a');
      link.download = 'sticker-slap-export.png';
      link.href = (stage as HTMLCanvasElement).toDataURL('image/png');
      link.click();
    }
  }, []);

  const handleShare = useCallback(() => {
    // TODO: Implement share functionality
    console.log('Sharing...');
  }, []);

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-14 items-center justify-between border-b bg-background px-4"
      >
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Sparkles className="h-5 w-5 text-primary" />
          <span>Sticker Slap</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Sync status indicator */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Saving...</span>
              </>
            ) : syncStatus === 'synced' ? (
              <>
                <Cloud className="h-3 w-3 text-green-500" />
                <span>Saved</span>
              </>
            ) : syncStatus === 'offline' ? (
              <>
                <CloudOff className="h-3 w-3 text-yellow-500" />
                <span>Offline</span>
              </>
            ) : isDirty ? (
              <>
                <Cloud className="h-3 w-3 text-yellow-500" />
                <span>Unsaved</span>
              </>
            ) : null}
          </div>

          <Button variant="ghost" size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="default" size="sm" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDebug((d) => !d)}
            title="Toggle debug info"
          >
            {showDebug ? 'Hide Debug' : 'Debug'}
          </Button>
        </div>
      </motion.header>

      {/* Toolbar */}
      <div className="flex justify-center border-b bg-background py-2">
        <Toolbar />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Stickers */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-64 overflow-y-auto border-r bg-background p-4"
        >
          <h2 className="mb-4 font-semibold">Stickers</h2>
          <div className="grid grid-cols-3 gap-2">
            {/* Placeholder stickers */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square cursor-pointer rounded-lg border bg-muted/50 transition-colors hover:bg-muted"
              />
            ))}
          </div>
        </motion.aside>

        {/* Canvas Area */}
        <main id="canvas-container" className="flex-1 overflow-hidden p-4">
          <InfiniteCanvas
            width={canvasSize.width}
            height={canvasSize.height}
            showMiniMap={true}
            showDebug={showDebug}
          />
        </main>

        {/* Right Sidebar - Properties */}
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-64 overflow-y-auto border-l bg-background p-4"
        >
          <h2 className="mb-4 font-semibold">Properties</h2>
          <PropertiesPanel />
        </motion.aside>
      </div>
    </div>
  );
}

function PropertiesPanel() {
  const { selectedIds, elements, updateElement } = useCanvasStore();

  if (selectedIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Select an element to edit its properties.</p>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <p className="text-sm text-muted-foreground">
        {selectedIds.length} elements selected. Select a single element to edit.
      </p>
    );
  }

  const selectedElement = elements.find((e) => e.id === selectedIds[0]);

  if (!selectedElement) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <p className="text-sm capitalize">{selectedElement.type}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">X</label>
          <input
            type="number"
            value={Math.round(selectedElement.x)}
            onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })}
            className="w-full rounded border bg-muted/50 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Y</label>
          <input
            type="number"
            value={Math.round(selectedElement.y)}
            onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })}
            className="w-full rounded border bg-muted/50 px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Rotation</label>
        <input
          type="range"
          min="0"
          max="360"
          value={selectedElement.rotation}
          onChange={(e) => updateElement(selectedElement.id, { rotation: Number(e.target.value) })}
          className="w-full"
        />
        <span className="text-xs text-muted-foreground">{Math.round(selectedElement.rotation)}°</span>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Opacity</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={selectedElement.opacity}
          onChange={(e) => updateElement(selectedElement.id, { opacity: Number(e.target.value) })}
          className="w-full"
        />
        <span className="text-xs text-muted-foreground">
          {Math.round(selectedElement.opacity * 100)}%
        </span>
      </div>
    </div>
  );
}
