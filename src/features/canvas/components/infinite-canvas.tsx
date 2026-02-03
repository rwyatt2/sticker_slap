'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '../store/canvas-store';
import { StickerNode } from './sticker-node';
import { TextNode } from './text-node';
import { ShapeNode } from './shape-node';
import { SelectionBox } from './selection-box';
import { TransformControls } from './transform-controls';
import { MiniMap } from './mini-map';
import { useSpatialIndex } from '@/hooks/use-spatial-index';
import { useCanvasKeyboard } from '@/hooks/use-canvas-keyboard';
import { useCanvasGestures } from '@/hooks/use-canvas-gestures';
import { getLodSettings, shouldRenderElement, getLodRenderProps } from '../utils/lod-system';
import { getImageCache, getLodLevel as getImageLodLevel } from '../utils/image-cache';
import type { CanvasElement, ViewportBounds, StickerElement } from '@/types/canvas';

interface InfiniteCanvasProps {
  /** Container width */
  width: number;
  /** Container height */
  height: number;
  /** Show mini-map */
  showMiniMap?: boolean;
  /** Show debug info */
  showDebug?: boolean;
  /** Enable real-time collaboration */
  enableCollaboration?: boolean;
  /** Remote cursors to display */
  remoteCursors?: Array<{
    id: string;
    name: string;
    color: string;
    x: number;
    y: number;
  }>;
  /** Callback when cursor moves (for collaboration) */
  onCursorMove?: (x: number, y: number) => void;
}

/**
 * High-performance infinite canvas component
 * Implements viewport culling, LOD, spatial indexing, and smooth 60fps rendering
 */
export function InfiniteCanvas({
  width,
  height,
  showMiniMap = true,
  showDebug = false,
  enableCollaboration = false,
  remoteCursors = [],
  onCursorMove,
}: InfiniteCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Canvas store
  const {
    elements,
    selectedIds,
    zoom,
    pan,
    activeTool,
    gridEnabled,
    gridSize,
    snapToGrid,
    selectElement,
    deselectAll,
    setZoom,
    setPan,
    updateElement,
  } = useCanvasStore();

  // Spatial indexing
  const { queryViewport, bounds } = useSpatialIndex({
    elements,
    useWorker: true,
  });

  // Keyboard shortcuts
  useCanvasKeyboard({ enabled: true });

  // State
  const [visibleElements, setVisibleElements] = useState<CanvasElement[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [stats, setStats] = useState({ visible: 0, total: 0, fps: 60 });

  // Calculate viewport bounds
  const viewport = useMemo<ViewportBounds>(() => {
    return {
      x: -pan.x / zoom,
      y: -pan.y / zoom,
      width: width / zoom,
      height: height / zoom,
    };
  }, [pan, zoom, width, height]);

  // LOD settings based on current zoom
  const lodSettings = useMemo(() => getLodSettings(zoom), [zoom]);

  /**
   * Update visible elements based on viewport
   */
  const updateVisibleElements = useCallback(() => {
    const padding = Math.max(100, 500 / zoom); // Larger padding at lower zoom
    const visible = queryViewport(viewport, padding);

    // Filter by LOD (skip elements too small to see)
    const filteredVisible = visible.filter((element) =>
      shouldRenderElement(element, zoom, { width, height })
    );

    // Sort by zIndex for proper layering
    filteredVisible.sort((a, b) => a.zIndex - b.zIndex);

    setVisibleElements(filteredVisible);
    setStats((prev) => ({
      ...prev,
      visible: filteredVisible.length,
      total: elements.length,
    }));
  }, [queryViewport, viewport, zoom, width, height, elements.length]);

  // Update visible elements when viewport changes
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(updateVisibleElements);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateVisibleElements]);

  /**
   * Preload images for visible stickers
   */
  useEffect(() => {
    const imageCache = getImageCache();
    const lod = getImageLodLevel(zoom);

    const stickers = visibleElements.filter(
      (el): el is StickerElement => el.type === 'sticker'
    );

    // Preload in batches
    const urls = stickers.slice(0, 20).map((s) => s.imageUrl);
    imageCache.preload(urls, lod);
  }, [visibleElements, zoom]);

  /**
   * Handle wheel zoom with smooth animation
   */
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const oldZoom = zoom;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Calculate zoom
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const scaleBy = 1.1;
      let newZoom = direction > 0 ? oldZoom * scaleBy : oldZoom / scaleBy;

      // Clamp zoom
      newZoom = Math.min(Math.max(newZoom, 0.1), 5);

      // Calculate new pan to zoom toward pointer
      const mousePointTo = {
        x: (pointer.x - pan.x) / oldZoom,
        y: (pointer.y - pan.y) / oldZoom,
      };

      const newPan = {
        x: pointer.x - mousePointTo.x * newZoom,
        y: pointer.y - mousePointTo.y * newZoom,
      };

      setZoom(newZoom);
      setPan(newPan);
    },
    [zoom, pan, setZoom, setPan]
  );

  /**
   * Handle touch gestures
   */
  useCanvasGestures(
    {
      elementRef: containerRef,
      enabled: true,
    },
    {
      onPinchZoom: (scale, _center) => {
        const newZoom = Math.min(Math.max(zoom * scale, 0.1), 5);
        setZoom(newZoom);
      },
      onPan: (delta) => {
        if (activeTool === 'pan' || isSpacePressed) {
          setPan({
            x: pan.x + delta.x,
            y: pan.y + delta.y,
          });
        }
      },
      onDoubleTap: (_point) => {
        // Zoom in on double tap
        const newZoom = Math.min(zoom * 1.5, 5);
        setZoom(newZoom);
      },
    }
  );

  /**
   * Handle stage click for deselection and hit testing
   */
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) {
        deselectAll();
      }
    },
    [deselectAll]
  );

  /**
   * Handle mouse move for collaboration cursor
   */
  const handleMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!enableCollaboration || !onCursorMove) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Convert to canvas coordinates
      const x = (pointer.x - pan.x) / zoom;
      const y = (pointer.y - pan.y) / zoom;

      onCursorMove(x, y);
    },
    [enableCollaboration, onCursorMove, pan, zoom]
  );

  /**
   * Handle element selection
   */
  const handleElementClick = useCallback(
    (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
      const isMultiSelect = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
      selectElement(id, isMultiSelect);
    },
    [selectElement]
  );

  /**
   * Handle drag with grid snapping
   */
  const handleDragMove = useCallback(
    (_id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      if (!snapToGrid) return;

      const node = e.target;
      const x = Math.round(node.x() / gridSize) * gridSize;
      const y = Math.round(node.y() / gridSize) * gridSize;

      node.x(x);
      node.y(y);
    },
    [snapToGrid, gridSize]
  );

  /**
   * Handle drag end
   */
  const handleDragEnd = useCallback(
    (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      let x = node.x();
      let y = node.y();

      // Final snap to grid
      if (snapToGrid) {
        x = Math.round(x / gridSize) * gridSize;
        y = Math.round(y / gridSize) * gridSize;
      }

      updateElement(id, { x, y });
    },
    [updateElement, snapToGrid, gridSize]
  );

  /**
   * Handle space key for pan mode
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.repeat) {
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  /**
   * Render element based on type with LOD optimization
   */
  const renderElement = useCallback(
    (element: CanvasElement) => {
      const isSelected = selectedIds.includes(element.id);
      const lodProps = getLodRenderProps(element, zoom);

      const commonProps = {
        key: element.id,
        element,
        isSelected,
        onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => handleElementClick(element.id, e),
        onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => handleDragMove(element.id, e),
        onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(element.id, e),
        ...lodProps,
      };

      switch (element.type) {
        case 'sticker':
          return <StickerNode {...commonProps} element={element} />;
        case 'text':
          return <TextNode {...commonProps} element={element} />;
        case 'shape':
          return <ShapeNode {...commonProps} element={element} />;
        default:
          return null;
      }
    },
    [selectedIds, zoom, handleElementClick, handleDragMove, handleDragEnd]
  );

  /**
   * Render grid lines (optimized for viewport)
   */
  const renderGrid = useMemo(() => {
    if (!gridEnabled) return null;

    const lines: JSX.Element[] = [];
    const gridColor = 'rgba(0, 0, 0, 0.05)';

    // Calculate visible grid bounds
    const startX = Math.floor(viewport.x / gridSize) * gridSize;
    const startY = Math.floor(viewport.y / gridSize) * gridSize;
    const endX = Math.ceil((viewport.x + viewport.width) / gridSize) * gridSize;
    const endY = Math.ceil((viewport.y + viewport.height) / gridSize) * gridSize;

    // Limit grid lines for performance
    const maxLines = 200;
    const xStep = Math.max(gridSize, Math.floor((endX - startX) / maxLines) * gridSize);
    const yStep = Math.max(gridSize, Math.floor((endY - startY) / maxLines) * gridSize);

    // Vertical lines
    for (let x = startX; x <= endX; x += xStep) {
      lines.push(
        <Line
          key={`v-${x}`}
          points={[x, startY, x, endY]}
          stroke={gridColor}
          strokeWidth={1 / zoom}
          listening={false}
        />
      );
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += yStep) {
      lines.push(
        <Line
          key={`h-${y}`}
          points={[startX, y, endX, y]}
          stroke={gridColor}
          strokeWidth={1 / zoom}
          listening={false}
        />
      );
    }

    return lines;
  }, [gridEnabled, gridSize, viewport, zoom]);

  /**
   * Render remote cursors for collaboration
   */
  const renderRemoteCursors = useMemo(() => {
    if (!enableCollaboration) return null;

    return remoteCursors.map((cursor) => (
      <div
        key={cursor.id}
        className="pointer-events-none absolute z-50"
        style={{
          left: cursor.x * zoom + pan.x,
          top: cursor.y * zoom + pan.y,
          transform: 'translate(-2px, -2px)',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
        >
          <path
            d="M5.65 2.147L21.153 11.93a1 1 0 01-.05 1.773l-6.157 3.078a1 1 0 00-.474.474l-3.078 6.157a1 1 0 01-1.772.05L.147 5.65a1 1 0 011.103-1.403l3.6.6.6 3.6a1 1 0 00-.8-5.6z"
            fill={cursor.color}
            stroke="white"
            strokeWidth="1.5"
          />
        </svg>
        <div
          className="absolute left-4 top-4 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: cursor.color }}
        >
          {cursor.name}
        </div>
      </div>
    ));
  }, [enableCollaboration, remoteCursors, zoom, pan]);

  const canDrag = activeTool === 'pan' || isSpacePressed;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg border bg-white shadow-sm"
      style={{
        width,
        height,
        cursor: canDrag ? (isPanning ? 'grabbing' : 'grab') : 'default',
      }}
    >
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
        onMouseMove={handleMouseMove}
        draggable={canDrag}
        onDragStart={() => setIsPanning(true)}
        onDragEnd={(e) => {
          setIsPanning(false);
          setPan({ x: e.target.x(), y: e.target.y() });
        }}
      >
        {/* Background layer */}
        <Layer>
          {/* Infinite canvas background */}
          <Rect
            x={viewport.x - 1000}
            y={viewport.y - 1000}
            width={viewport.width + 2000}
            height={viewport.height + 2000}
            fill="#ffffff"
            listening={false}
          />
          {/* Grid */}
          {renderGrid}
        </Layer>

        {/* Elements layer */}
        <Layer>
          {visibleElements.map(renderElement)}
          <SelectionBox />
          <TransformControls stageRef={stageRef} />
        </Layer>
      </Stage>

      {/* Remote cursors overlay */}
      {renderRemoteCursors}

      {/* Mini-map */}
      {showMiniMap && (
        <MiniMap
          width={200}
          height={150}
          viewportWidth={width}
          viewportHeight={height}
        />
      )}

      {/* Debug info */}
      {showDebug && (
        <div className="absolute left-4 top-4 rounded bg-black/70 px-2 py-1 text-xs font-mono text-white">
          <div>Visible: {stats.visible} / {stats.total}</div>
          <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
          <div>LOD: {lodSettings.imageQuality < 0.5 ? 'Low' : lodSettings.imageQuality < 0.85 ? 'Medium' : 'High'}</div>
          <div>Pan: ({Math.round(pan.x)}, {Math.round(pan.y)})</div>
          {bounds && (
            <div>
              Bounds: ({Math.round(bounds.minX)}, {Math.round(bounds.minY)}) - ({Math.round(bounds.maxX)}, {Math.round(bounds.maxY)})
            </div>
          )}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1">
        <button
          onClick={() => setZoom(Math.min(zoom * 1.2, 5))}
          className="flex h-8 w-8 items-center justify-center rounded bg-white shadow hover:bg-gray-50"
          title="Zoom in"
        >
          <span className="text-lg">+</span>
        </button>
        <button
          onClick={() => setZoom(Math.max(zoom / 1.2, 0.1))}
          className="flex h-8 w-8 items-center justify-center rounded bg-white shadow hover:bg-gray-50"
          title="Zoom out"
        >
          <span className="text-lg">−</span>
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="flex h-8 w-8 items-center justify-center rounded bg-white shadow hover:bg-gray-50 text-xs"
          title="Reset view"
        >
          1:1
        </button>
      </div>
    </div>
  );
}
