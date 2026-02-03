'use client';

import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useCanvasStore } from '../store/canvas-store';
import { SpatialIndex } from '../utils/spatial-index';
import type { CanvasElement } from '@/types/canvas';

interface MiniMapProps {
  /** Width of the mini-map */
  width?: number;
  /** Height of the mini-map */
  height?: number;
  /** Current viewport dimensions */
  viewportWidth: number;
  viewportHeight: number;
  /** Whether to show element colors */
  showColors?: boolean;
  /** Padding around content */
  padding?: number;
  /** Click to navigate */
  navigable?: boolean;
}

/**
 * Mini-map component for canvas navigation
 * Shows overview of all elements with current viewport indicator
 */
export function MiniMap({
  width = 200,
  height = 150,
  viewportWidth,
  viewportHeight,
  showColors = true,
  padding = 20,
  navigable = true,
}: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { elements, zoom, pan, setPan } = useCanvasStore();

  // Calculate content bounds and scale
  const { scale, offsetX, offsetY } = useMemo(() => {
    if (elements.length === 0) {
      return {
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
        scale: 0.1,
        offsetX: 0,
        offsetY: 0,
      };
    }

    // Get bounds of all elements
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach((element) => {
      const elBounds = SpatialIndex.getElementBounds(element);
      minX = Math.min(minX, elBounds.minX);
      minY = Math.min(minY, elBounds.minY);
      maxX = Math.max(maxX, elBounds.maxX);
      maxY = Math.max(maxY, elBounds.maxY);
    });

    // Add some padding and include viewport bounds
    const vpMinX = -pan.x / zoom;
    const vpMinY = -pan.y / zoom;
    const vpMaxX = vpMinX + viewportWidth / zoom;
    const vpMaxY = vpMinY + viewportHeight / zoom;

    minX = Math.min(minX, vpMinX) - padding / zoom;
    minY = Math.min(minY, vpMinY) - padding / zoom;
    maxX = Math.max(maxX, vpMaxX) + padding / zoom;
    maxY = Math.max(maxY, vpMaxY) + padding / zoom;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate scale to fit content in mini-map
    const scaleX = (width - padding * 2) / contentWidth;
    const scaleY = (height - padding * 2) / contentHeight;
    const fitScale = Math.min(scaleX, scaleY);

    // Center content
    const offsetX = padding + ((width - padding * 2) - contentWidth * fitScale) / 2 - minX * fitScale;
    const offsetY = padding + ((height - padding * 2) - contentHeight * fitScale) / 2 - minY * fitScale;

    return {
      bounds: { minX, minY, maxX, maxY },
      scale: fitScale,
      offsetX,
      offsetY,
    };
  }, [elements, zoom, pan, width, height, viewportWidth, viewportHeight, padding]);

  // Get element color based on type
  const getElementColor = useCallback((element: CanvasElement): string => {
    if (!showColors) return 'rgba(100, 100, 100, 0.8)';

    switch (element.type) {
      case 'sticker':
        return 'rgba(59, 130, 246, 0.8)'; // Blue
      case 'text':
        return 'rgba(16, 185, 129, 0.8)'; // Green
      case 'shape':
        return 'rgba(239, 68, 68, 0.8)'; // Red
      default:
        return 'rgba(100, 100, 100, 0.8)';
    }
  }, [showColors]);

  // Render mini-map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.fillRect(0, 0, width, height);

    // Draw border
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    // Draw elements
    elements.forEach((element) => {
      const elBounds = SpatialIndex.getElementBounds(element);

      const x = elBounds.minX * scale + offsetX;
      const y = elBounds.minY * scale + offsetY;
      const w = Math.max(2, elBounds.width * scale);
      const h = Math.max(2, elBounds.height * scale);

      ctx.fillStyle = getElementColor(element);
      ctx.fillRect(x, y, w, h);
    });

    // Draw viewport rectangle
    const vpX = (-pan.x / zoom) * scale + offsetX;
    const vpY = (-pan.y / zoom) * scale + offsetY;
    const vpW = (viewportWidth / zoom) * scale;
    const vpH = (viewportHeight / zoom) * scale;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(vpX, vpY, vpW, vpH);

    // Fill viewport with semi-transparent overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(vpX, vpY, vpW, vpH);
  }, [elements, zoom, pan, width, height, viewportWidth, viewportHeight, scale, offsetX, offsetY, getElementColor]);

  // Handle click to navigate
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!navigable) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert click position to canvas coordinates
      const canvasX = (clickX - offsetX) / scale;
      const canvasY = (clickY - offsetY) / scale;

      // Center viewport on clicked position
      const newPanX = -(canvasX * zoom - viewportWidth / 2);
      const newPanY = -(canvasY * zoom - viewportHeight / 2);

      setPan({ x: newPanX, y: newPanY });
    },
    [navigable, scale, offsetX, offsetY, zoom, viewportWidth, viewportHeight, setPan]
  );

  // Handle drag to navigate
  const isDraggingRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!navigable) return;
      isDraggingRef.current = true;
      handleClick(e);
    },
    [navigable, handleClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current) return;
      handleClick(e);
    },
    [handleClick]
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  return (
    <div
      className="absolute bottom-4 right-4 overflow-hidden rounded-lg shadow-lg"
      style={{ width, height }}
    >
      <canvas
        ref={canvasRef}
        style={{ width, height, cursor: navigable ? 'pointer' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      <div className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/70">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  );
}
