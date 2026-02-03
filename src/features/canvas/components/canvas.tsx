'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '../store/canvas-store';
import { StickerNode } from './sticker-node';
import { TextNode } from './text-node';
import { ShapeNode } from './shape-node';
import { SelectionBox } from './selection-box';
import { TransformControls } from './transform-controls';
import type { CanvasElement } from '@/types/canvas';

interface CanvasProps {
  width: number;
  height: number;
}

export function Canvas({ width, height }: CanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const {
    elements,
    selectedIds,
    zoom,
    pan,
    activeTool,
    gridEnabled,
    gridSize,
    selectElement,
    deselectAll,
    setZoom,
    setPan,
    saveToHistory,
  } = useCanvasStore();

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { undo, redo, deleteSelectedElements, selectAll, duplicateElements } =
        useCanvasStore.getState();

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        saveToHistory();
        deleteSelectedElements();
      }

      // Select All
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }

      // Duplicate
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        const { selectedIds } = useCanvasStore.getState();
        if (selectedIds.length > 0) {
          saveToHistory();
          duplicateElements(selectedIds);
        }
      }

      // Deselect
      if (e.key === 'Escape') {
        deselectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deselectAll, saveToHistory]);

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = zoom;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - pan.x) / oldScale,
        y: (pointer.y - pan.y) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? oldScale * 1.1 : oldScale / 1.1;
      const clampedScale = Math.min(Math.max(newScale, 0.1), 5);

      setZoom(clampedScale);
      setPan({
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      });
    },
    [zoom, pan, setZoom, setPan]
  );

  // Handle stage click for deselection
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) {
        deselectAll();
      }
    },
    [deselectAll]
  );

  // Handle element selection
  const handleElementClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      const isMultiSelect = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
      selectElement(id, isMultiSelect);
    },
    [selectElement]
  );

  // Render element based on type
  const renderElement = (element: CanvasElement) => {
    const isSelected = selectedIds.includes(element.id);

    switch (element.type) {
      case 'sticker':
        return (
          <StickerNode
            key={element.id}
            element={element}
            isSelected={isSelected}
            onSelect={(e) => handleElementClick(element.id, e)}
          />
        );
      case 'text':
        return (
          <TextNode
            key={element.id}
            element={element}
            isSelected={isSelected}
            onSelect={(e) => handleElementClick(element.id, e)}
          />
        );
      case 'shape':
        return (
          <ShapeNode
            key={element.id}
            element={element}
            isSelected={isSelected}
            onSelect={(e) => handleElementClick(element.id, e)}
          />
        );
      default:
        return null;
    }
  };

  // Sort elements by zIndex
  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div className="canvas-container relative overflow-hidden rounded-lg border bg-white shadow-sm">
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        draggable={activeTool === 'pan'}
        onDragEnd={(e) => {
          setPan({ x: e.target.x(), y: e.target.y() });
        }}
      >
        {/* Background layer */}
        <Layer>
          <Rect x={0} y={0} width={width} height={height} fill="#ffffff" listening={false} />
          {/* Grid */}
          {gridEnabled && <GridLines width={width} height={height} gridSize={gridSize} />}
        </Layer>

        {/* Elements layer */}
        <Layer>
          {sortedElements.map(renderElement)}
          <SelectionBox />
          <TransformControls stageRef={stageRef} />
        </Layer>
      </Stage>
    </div>
  );
}

// Grid lines component
function GridLines({
  width,
  height,
  gridSize,
}: {
  width: number;
  height: number;
  gridSize: number;
}) {
  const lines = [];

  // Vertical lines
  for (let x = 0; x <= width; x += gridSize) {
    lines.push(
      <Rect
        key={`v-${x}`}
        x={x}
        y={0}
        width={1}
        height={height}
        fill="rgba(0, 0, 0, 0.05)"
        listening={false}
      />
    );
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += gridSize) {
    lines.push(
      <Rect
        key={`h-${y}`}
        x={0}
        y={y}
        width={width}
        height={1}
        fill="rgba(0, 0, 0, 0.05)"
        listening={false}
      />
    );
  }

  return <>{lines}</>;
}
