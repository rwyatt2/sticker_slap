import type Konva from 'konva';

/**
 * Base shape properties shared by all canvas elements
 */
export interface BaseShapeProps {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  draggable: boolean;
  opacity: number;
  visible: boolean;
  zIndex: number;
}

/**
 * Sticker element on the canvas
 */
export interface StickerElement extends BaseShapeProps {
  type: 'sticker';
  imageUrl: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  filters?: Konva.Filter[];
}

/**
 * Text element on the canvas
 */
export interface TextElement extends BaseShapeProps {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: 'normal' | 'italic' | 'bold' | 'bold italic';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  align: 'left' | 'center' | 'right';
  width?: number;
  wrap?: 'word' | 'char' | 'none';
}

/**
 * Shape element on the canvas
 */
export interface ShapeElement extends BaseShapeProps {
  type: 'shape';
  shapeType: 'rect' | 'circle' | 'ellipse' | 'star' | 'polygon' | 'line';
  fill: string;
  stroke: string;
  strokeWidth: number;
  width?: number;
  height?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  sides?: number;
  innerRadius?: number;
  outerRadius?: number;
  points?: number[];
}

/**
 * Union type for all canvas elements
 */
export type CanvasElement = StickerElement | TextElement | ShapeElement;

/**
 * Canvas state
 */
export interface CanvasState {
  elements: CanvasElement[];
  selectedIds: string[];
  history: CanvasElement[][];
  historyIndex: number;
  zoom: number;
  pan: { x: number; y: number };
}

/**
 * Canvas dimensions
 */
export interface CanvasDimensions {
  width: number;
  height: number;
}

/**
 * Viewport bounds for culling
 */
export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Transform properties for elements
 */
export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Selection box for multi-select
 */
export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

/**
 * Tool types
 */
export type ToolType = 'select' | 'pan' | 'sticker' | 'text' | 'shape' | 'eraser';

/**
 * Shape tool options
 */
export type ShapeToolType = 'rect' | 'circle' | 'ellipse' | 'star' | 'polygon' | 'line';
