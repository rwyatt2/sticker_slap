'use client';

import { useRef, useState, useCallback } from 'react';
import { Text as KonvaText } from 'react-konva';
import type Konva from 'konva';
import type { TextElement } from '@/types/canvas';
import { useCanvasStore } from '../store/canvas-store';

interface TextNodeProps {
  element: TextElement;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
}

export function TextNode({ element, isSelected, onSelect }: TextNodeProps) {
  const textRef = useRef<Konva.Text>(null);
  const { updateElement, saveToHistory } = useCanvasStore();
  const [isEditing, setIsEditing] = useState(false);

  // Handle double-click for text editing
  const handleDblClick = useCallback(() => {
    const textNode = textRef.current;
    if (!textNode) return;

    setIsEditing(true);

    // Get position of text
    const stage = textNode.getStage();
    if (!stage) return;

    const textPosition = textNode.absolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    const areaPosition = {
      x: stageBox.left + textPosition.x,
      y: stageBox.top + textPosition.y,
    };

    // Create textarea
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    textarea.value = element.text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${areaPosition.y}px`;
    textarea.style.left = `${areaPosition.x}px`;
    textarea.style.width = `${textNode.width() * textNode.scaleX()}px`;
    textarea.style.height = `${textNode.height() * textNode.scaleY() + 5}px`;
    textarea.style.fontSize = `${element.fontSize}px`;
    textarea.style.fontFamily = element.fontFamily;
    textarea.style.border = 'none';
    textarea.style.padding = '0px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'none';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.transformOrigin = 'left top';
    textarea.style.textAlign = element.align;
    textarea.style.color = element.fill;
    textarea.style.zIndex = '1000';

    textarea.focus();

    const removeTextarea = () => {
      textarea.parentNode?.removeChild(textarea);
      setIsEditing(false);
    };

    textarea.addEventListener('keydown', (e) => {
      // On Enter (without shift), save and exit
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveToHistory();
        updateElement(element.id, { text: textarea.value });
        removeTextarea();
      }
      // On Escape, exit without saving
      if (e.key === 'Escape') {
        removeTextarea();
      }
    });

    textarea.addEventListener('blur', () => {
      saveToHistory();
      updateElement(element.id, { text: textarea.value });
      removeTextarea();
    });
  }, [element, updateElement, saveToHistory]);

  return (
    <KonvaText
      ref={textRef}
      id={element.id}
      x={element.x}
      y={element.y}
      text={element.text}
      fontSize={element.fontSize}
      fontFamily={element.fontFamily}
      fontStyle={element.fontStyle}
      fill={element.fill}
      stroke={element.stroke}
      strokeWidth={element.strokeWidth}
      align={element.align}
      width={element.width}
      wrap={element.wrap}
      rotation={element.rotation}
      scaleX={element.scaleX}
      scaleY={element.scaleY}
      opacity={element.opacity}
      visible={element.visible && !isEditing}
      draggable={element.draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onDragStart={() => saveToHistory()}
      onDragEnd={(e) => {
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
    />
  );
}
