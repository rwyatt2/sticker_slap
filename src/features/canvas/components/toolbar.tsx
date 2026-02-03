'use client';

import { motion } from 'framer-motion';
import {
  MousePointer2,
  Hand,
  Type,
  Square,
  Circle,
  Star,
  Minus,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid3X3,
  Magnet,
  Trash2,
  Copy,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCanvasStore } from '../store/canvas-store';
import type { ToolType, ShapeToolType } from '@/types/canvas';
import { cn } from '@/lib/utils';

const tools: Array<{ id: ToolType; icon: React.ReactNode; label: string; shortcut?: string }> = [
  { id: 'select', icon: <MousePointer2 className="h-4 w-4" />, label: 'Select', shortcut: 'V' },
  { id: 'pan', icon: <Hand className="h-4 w-4" />, label: 'Pan', shortcut: 'H' },
  { id: 'text', icon: <Type className="h-4 w-4" />, label: 'Text', shortcut: 'T' },
];

const shapeTools: Array<{
  id: ShapeToolType;
  icon: React.ReactNode;
  label: string;
}> = [
  { id: 'rect', icon: <Square className="h-4 w-4" />, label: 'Rectangle' },
  { id: 'circle', icon: <Circle className="h-4 w-4" />, label: 'Circle' },
  { id: 'star', icon: <Star className="h-4 w-4" />, label: 'Star' },
  { id: 'line', icon: <Minus className="h-4 w-4" />, label: 'Line' },
];

export function Toolbar() {
  const {
    activeTool,
    activeShapeTool,
    selectedIds,
    zoom,
    gridEnabled,
    snapToGrid,
    setActiveTool,
    setActiveShapeTool,
    undo,
    redo,
    setZoom,
    resetView,
    toggleGrid,
    toggleSnapToGrid,
    deleteSelectedElements,
    duplicateElements,
    bringToFront,
    sendToBack,
    saveToHistory,
  } = useCanvasStore();

  const handleDelete = () => {
    saveToHistory();
    deleteSelectedElements();
  };

  const handleDuplicate = () => {
    if (selectedIds.length > 0) {
      saveToHistory();
      duplicateElements(selectedIds);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-1 rounded-lg border bg-background p-1 shadow-sm"
      >
        {/* Main Tools */}
        {tools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === tool.id ? 'secondary' : 'ghost'}
                size="icon"
                className={cn('h-8 w-8', activeTool === tool.id && 'bg-primary/10')}
                onClick={() => setActiveTool(tool.id)}
              >
                {tool.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {tool.label}
              {tool.shortcut && (
                <span className="ml-2 text-xs text-muted-foreground">{tool.shortcut}</span>
              )}
            </TooltipContent>
          </Tooltip>
        ))}

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Shape Tools */}
        {shapeTools.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === 'shape' && activeShapeTool === tool.id ? 'secondary' : 'ghost'}
                size="icon"
                className={cn(
                  'h-8 w-8',
                  activeTool === 'shape' && activeShapeTool === tool.id && 'bg-primary/10'
                )}
                onClick={() => {
                  setActiveTool('shape');
                  setActiveShapeTool(tool.id);
                }}
              >
                {tool.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tool.label}</TooltipContent>
          </Tooltip>
        ))}

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* History */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Undo <span className="ml-2 text-xs text-muted-foreground">Ctrl+Z</span>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Redo <span className="ml-2 text-xs text-muted-foreground">Ctrl+Shift+Z</span>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Zoom Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(zoom * 1.2)}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(zoom / 1.2)}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset View</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Grid Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={gridEnabled ? 'secondary' : 'ghost'}
              size="icon"
              className={cn('h-8 w-8', gridEnabled && 'bg-primary/10')}
              onClick={toggleGrid}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Grid</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={snapToGrid ? 'secondary' : 'ghost'}
              size="icon"
              className={cn('h-8 w-8', snapToGrid && 'bg-primary/10')}
              onClick={toggleSnapToGrid}
            >
              <Magnet className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snap to Grid</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Selection Actions */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDuplicate}
              disabled={selectedIds.length === 0}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Duplicate <span className="ml-2 text-xs text-muted-foreground">Ctrl+D</span>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => bringToFront(selectedIds)}
              disabled={selectedIds.length === 0}
            >
              <Layers className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bring to Front</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              disabled={selectedIds.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Delete <span className="ml-2 text-xs text-muted-foreground">Delete</span>
          </TooltipContent>
        </Tooltip>
      </motion.div>
    </TooltipProvider>
  );
}
