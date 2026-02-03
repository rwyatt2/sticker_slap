'use client';

import { useRef } from 'react';
import { Rect, Circle, Ellipse, Star, RegularPolygon, Line } from 'react-konva';
import type Konva from 'konva';
import type { ShapeElement } from '@/types/canvas';
import { useCanvasStore } from '../store/canvas-store';

interface ShapeNodeProps {
  element: ShapeElement;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
}

export function ShapeNode({ element, isSelected, onSelect }: ShapeNodeProps) {
  const shapeRef = useRef<Konva.Shape>(null);
  const { updateElement, saveToHistory } = useCanvasStore();

  const commonProps = {
    id: element.id,
    x: element.x,
    y: element.y,
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
    rotation: element.rotation,
    scaleX: element.scaleX,
    scaleY: element.scaleY,
    opacity: element.opacity,
    visible: element.visible,
    draggable: element.draggable,
    onClick: onSelect,
    onTap: onSelect,
    onDragStart: () => saveToHistory(),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      updateElement(element.id, {
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      updateElement(element.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      });
    },
  };

  switch (element.shapeType) {
    case 'rect':
      return (
        <Rect
          ref={shapeRef as React.RefObject<Konva.Rect>}
          {...commonProps}
          width={element.width ?? 100}
          height={element.height ?? 100}
        />
      );

    case 'circle':
      return (
        <Circle
          ref={shapeRef as React.RefObject<Konva.Circle>}
          {...commonProps}
          radius={element.radius ?? 50}
        />
      );

    case 'ellipse':
      return (
        <Ellipse
          ref={shapeRef as React.RefObject<Konva.Ellipse>}
          {...commonProps}
          radiusX={element.radiusX ?? 60}
          radiusY={element.radiusY ?? 40}
        />
      );

    case 'star':
      return (
        <Star
          ref={shapeRef as React.RefObject<Konva.Star>}
          {...commonProps}
          numPoints={element.sides ?? 5}
          innerRadius={element.innerRadius ?? 20}
          outerRadius={element.outerRadius ?? 50}
        />
      );

    case 'polygon':
      return (
        <RegularPolygon
          ref={shapeRef as React.RefObject<Konva.RegularPolygon>}
          {...commonProps}
          sides={element.sides ?? 6}
          radius={element.radius ?? 50}
        />
      );

    case 'line':
      return (
        <Line
          ref={shapeRef as React.RefObject<Konva.Line>}
          {...commonProps}
          points={element.points ?? [0, 0, 100, 100]}
          lineCap="round"
          lineJoin="round"
        />
      );

    default:
      return null;
  }
}
