'use client';

import { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import useImage from 'use-image';
import type { StickerElement } from '@/types/canvas';
import { useCanvasStore } from '../store/canvas-store';

interface StickerNodeProps {
  element: StickerElement;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
}

export function StickerNode({ element, isSelected, onSelect }: StickerNodeProps) {
  const imageRef = useRef<Konva.Image>(null);
  const [image, status] = useImage(element.imageUrl, 'anonymous');
  const { updateElement, saveToHistory } = useCanvasStore();
  const [isDragging, setIsDragging] = useState(false);

  // Apply filters when image loads
  useEffect(() => {
    if (imageRef.current && image && element.filters) {
      imageRef.current.cache();
      imageRef.current.filters(element.filters);
    }
  }, [image, element.filters]);

  if (status === 'loading') {
    // Could render a placeholder here
    return null;
  }

  if (status === 'failed') {
    // Could render an error placeholder
    return null;
  }

  return (
    <KonvaImage
      ref={imageRef}
      id={element.id}
      image={image}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      rotation={element.rotation}
      scaleX={element.scaleX}
      scaleY={element.scaleY}
      opacity={element.opacity}
      visible={element.visible}
      draggable={element.draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={() => {
        setIsDragging(true);
        saveToHistory();
      }}
      onDragEnd={(e) => {
        setIsDragging(false);
        updateElement(element.id, {
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={(e) => {
        const node = e.target;
        updateElement(element.id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
        });
      }}
      shadowColor={isDragging ? 'rgba(0,0,0,0.3)' : undefined}
      shadowBlur={isDragging ? 10 : 0}
      shadowOffset={isDragging ? { x: 5, y: 5 } : { x: 0, y: 0 }}
    />
  );
}
