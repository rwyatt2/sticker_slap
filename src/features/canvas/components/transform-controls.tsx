'use client';

import { useEffect, useRef } from 'react';
import { Transformer } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from '../store/canvas-store';

interface TransformControlsProps {
  stageRef: React.RefObject<Konva.Stage>;
}

export function TransformControls({ stageRef }: TransformControlsProps) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const { selectedIds, elements } = useCanvasStore();

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;

    if (!transformer || !stage) return;

    // Get selected nodes
    const selectedNodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => node !== undefined);

    // Attach transformer to selected nodes
    transformer.nodes(selectedNodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, elements, stageRef]);

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <Transformer
      ref={transformerRef}
      boundBoxFunc={(oldBox, newBox) => {
        // Limit minimum size
        if (newBox.width < 5 || newBox.height < 5) {
          return oldBox;
        }
        return newBox;
      }}
      anchorSize={8}
      anchorCornerRadius={2}
      anchorFill="#ffffff"
      anchorStroke="#9333ea"
      anchorStrokeWidth={1}
      borderStroke="#9333ea"
      borderStrokeWidth={1}
      borderDash={[3, 3]}
      rotateAnchorOffset={25}
      rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
      enabledAnchors={[
        'top-left',
        'top-center',
        'top-right',
        'middle-right',
        'bottom-right',
        'bottom-center',
        'bottom-left',
        'middle-left',
      ]}
    />
  );
}
