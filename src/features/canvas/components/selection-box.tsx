'use client';

import { useState, useCallback } from 'react';
import { Rect } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '../store/canvas-store';

export function SelectionBox() {
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
  });

  const { elements, selectElements, activeTool } = useCanvasStore();

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool !== 'select') return;
      if (e.target !== e.target.getStage()) return;

      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;

      setSelectionRect({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        visible: true,
      });
    },
    [activeTool]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!selectionRect.visible) return;

      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;

      setSelectionRect((prev) => ({
        ...prev,
        width: pos.x - prev.x,
        height: pos.y - prev.y,
      }));
    },
    [selectionRect.visible]
  );

  const handleMouseUp = useCallback(() => {
    if (!selectionRect.visible) return;

    // Calculate selection box bounds
    const box = {
      x: selectionRect.width < 0 ? selectionRect.x + selectionRect.width : selectionRect.x,
      y: selectionRect.height < 0 ? selectionRect.y + selectionRect.height : selectionRect.y,
      width: Math.abs(selectionRect.width),
      height: Math.abs(selectionRect.height),
    };

    // Find elements within selection box
    const selectedIds = elements
      .filter((element) => {
        // Simple AABB collision detection
        return (
          element.x >= box.x &&
          element.x <= box.x + box.width &&
          element.y >= box.y &&
          element.y <= box.y + box.height
        );
      })
      .map((e) => e.id);

    if (selectedIds.length > 0) {
      selectElements(selectedIds);
    }

    setSelectionRect((prev) => ({ ...prev, visible: false }));
  }, [selectionRect, elements, selectElements]);

  if (!selectionRect.visible) {
    return null;
  }

  return (
    <Rect
      x={selectionRect.x}
      y={selectionRect.y}
      width={selectionRect.width}
      height={selectionRect.height}
      fill="rgba(147, 51, 234, 0.1)"
      stroke="rgb(147, 51, 234)"
      strokeWidth={1}
      dash={[4, 4]}
      listening={false}
    />
  );
}
