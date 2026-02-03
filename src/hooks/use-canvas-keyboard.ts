/**
 * Comprehensive keyboard shortcuts hook for infinite canvas
 * Supports arrow keys, zoom controls, element manipulation, and navigation
 */

import { useCallback, useEffect, useRef } from 'react';
import { useCanvasStore } from '@/features/canvas';

interface KeyboardConfig {
  /** Enable/disable keyboard shortcuts */
  enabled?: boolean;
  /** Step size for arrow key movement */
  moveStep?: number;
  /** Step size for shift+arrow movement */
  moveStepLarge?: number;
  /** Zoom step multiplier */
  zoomStep?: number;
  /** Rotation step in degrees */
  rotateStep?: number;
}

const DEFAULT_CONFIG: Required<KeyboardConfig> = {
  enabled: true,
  moveStep: 1,
  moveStepLarge: 10,
  zoomStep: 0.1,
  rotateStep: 15,
};

/**
 * Hook for comprehensive keyboard shortcuts
 */
export function useCanvasKeyboard(config: KeyboardConfig = {}) {
  const {
    enabled = DEFAULT_CONFIG.enabled,
    moveStep = DEFAULT_CONFIG.moveStep,
    moveStepLarge = DEFAULT_CONFIG.moveStepLarge,
    zoomStep = DEFAULT_CONFIG.zoomStep,
    rotateStep = DEFAULT_CONFIG.rotateStep,
  } = config;

  const isComposingRef = useRef(false);

  // Get store actions
  const {
    selectedIds,
    elements,
    zoom,
    pan,
    setZoom,
    setPan,
    updateElement,
    deleteSelectedElements,
    selectAll,
    deselectAll,
    duplicateElements,
    bringToFront,
    sendToBack,
    moveUp,
    moveDown,
    saveToHistory,
    undo,
    redo,
  } = useCanvasStore();

  /**
   * Move selected elements
   */
  const moveSelectedElements = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.length === 0) return;

      saveToHistory();
      selectedIds.forEach((id) => {
        const element = elements.find((e) => e.id === id);
        if (element) {
          updateElement(id, {
            x: element.x + dx,
            y: element.y + dy,
          });
        }
      });
    },
    [selectedIds, elements, updateElement, saveToHistory]
  );

  /**
   * Rotate selected elements
   */
  const rotateSelectedElements = useCallback(
    (degrees: number) => {
      if (selectedIds.length === 0) return;

      saveToHistory();
      selectedIds.forEach((id) => {
        const element = elements.find((e) => e.id === id);
        if (element) {
          updateElement(id, {
            rotation: (element.rotation + degrees) % 360,
          });
        }
      });
    },
    [selectedIds, elements, updateElement, saveToHistory]
  );

  /**
   * Zoom to center of viewport
   */
  const zoomToCenter = useCallback(
    (newZoom: number, viewportWidth: number, viewportHeight: number) => {
      const clampedZoom = Math.min(Math.max(newZoom, 0.1), 5);

      // Calculate center point in canvas coordinates
      const centerX = (viewportWidth / 2 - pan.x) / zoom;
      const centerY = (viewportHeight / 2 - pan.y) / zoom;

      // Update pan to keep center point in place
      setPan({
        x: viewportWidth / 2 - centerX * clampedZoom,
        y: viewportHeight / 2 - centerY * clampedZoom,
      });
      setZoom(clampedZoom);
    },
    [zoom, pan, setZoom, setPan]
  );

  /**
   * Fit all content in viewport
   */
  const fitToContent = useCallback(
    (viewportWidth: number, viewportHeight: number, padding = 50) => {
      if (elements.length === 0) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        return;
      }

      // Calculate bounds
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      elements.forEach((el) => {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        // Approximate max bounds
        const width = 'width' in el ? (el.width ?? 100) : 100;
        const height = 'height' in el ? (el.height ?? 100) : 100;
        maxX = Math.max(maxX, el.x + width * el.scaleX);
        maxY = Math.max(maxY, el.y + height * el.scaleY);
      });

      const contentWidth = maxX - minX + padding * 2;
      const contentHeight = maxY - minY + padding * 2;

      const scaleX = viewportWidth / contentWidth;
      const scaleY = viewportHeight / contentHeight;
      const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.1), 1);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setPan({
        x: viewportWidth / 2 - centerX * newZoom,
        y: viewportHeight / 2 - centerY * newZoom,
      });
      setZoom(newZoom);
    },
    [elements, setZoom, setPan]
  );

  /**
   * Main keyboard handler
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if typing in input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Skip during IME composition
      if (isComposingRef.current) return;

      const isMod = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;
      const step = isShift ? moveStepLarge : moveStep;

      switch (e.key) {
        // Movement with arrow keys
        case 'ArrowUp':
          if (selectedIds.length > 0) {
            e.preventDefault();
            if (isMod && isShift) {
              // Cmd+Shift+Up: Bring to front
              bringToFront(selectedIds);
            } else if (isMod) {
              // Cmd+Up: Move up in layer order
              moveUp(selectedIds);
            } else {
              // Arrow: Move elements
              moveSelectedElements(0, -step);
            }
          } else if (!isMod) {
            // Pan canvas
            e.preventDefault();
            setPan({ x: pan.x, y: pan.y + step * 10 });
          }
          break;

        case 'ArrowDown':
          if (selectedIds.length > 0) {
            e.preventDefault();
            if (isMod && isShift) {
              sendToBack(selectedIds);
            } else if (isMod) {
              moveDown(selectedIds);
            } else {
              moveSelectedElements(0, step);
            }
          } else if (!isMod) {
            e.preventDefault();
            setPan({ x: pan.x, y: pan.y - step * 10 });
          }
          break;

        case 'ArrowLeft':
          if (selectedIds.length > 0 && !isMod) {
            e.preventDefault();
            moveSelectedElements(-step, 0);
          } else if (!isMod) {
            e.preventDefault();
            setPan({ x: pan.x + step * 10, y: pan.y });
          }
          break;

        case 'ArrowRight':
          if (selectedIds.length > 0 && !isMod) {
            e.preventDefault();
            moveSelectedElements(step, 0);
          } else if (!isMod) {
            e.preventDefault();
            setPan({ x: pan.x - step * 10, y: pan.y });
          }
          break;

        // Zoom with +/- keys
        case '=':
        case '+':
          if (isMod || e.key === '+') {
            e.preventDefault();
            const viewport = document.getElementById('canvas-container');
            if (viewport) {
              zoomToCenter(
                zoom * (1 + zoomStep),
                viewport.clientWidth,
                viewport.clientHeight
              );
            }
          }
          break;

        case '-':
        case '_':
          if (isMod || e.key === '-') {
            e.preventDefault();
            const viewport = document.getElementById('canvas-container');
            if (viewport) {
              zoomToCenter(
                zoom * (1 - zoomStep),
                viewport.clientWidth,
                viewport.clientHeight
              );
            }
          }
          break;

        // Reset zoom
        case '0':
          if (isMod) {
            e.preventDefault();
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }
          break;

        // Fit to content
        case '1':
          if (isMod) {
            e.preventDefault();
            const viewport = document.getElementById('canvas-container');
            if (viewport) {
              fitToContent(viewport.clientWidth, viewport.clientHeight);
            }
          }
          break;

        // Undo/Redo
        case 'z':
          if (isMod) {
            e.preventDefault();
            if (isShift) {
              redo();
            } else {
              undo();
            }
          }
          break;

        case 'y':
          if (isMod) {
            e.preventDefault();
            redo();
          }
          break;

        // Select all
        case 'a':
          if (isMod) {
            e.preventDefault();
            selectAll();
          }
          break;

        // Duplicate
        case 'd':
          if (isMod && selectedIds.length > 0) {
            e.preventDefault();
            saveToHistory();
            duplicateElements(selectedIds);
          }
          break;

        // Delete
        case 'Delete':
        case 'Backspace':
          if (selectedIds.length > 0) {
            e.preventDefault();
            saveToHistory();
            deleteSelectedElements();
          }
          break;

        // Escape - deselect
        case 'Escape':
          e.preventDefault();
          deselectAll();
          break;

        // Rotate
        case '[':
          if (selectedIds.length > 0) {
            e.preventDefault();
            rotateSelectedElements(-rotateStep);
          }
          break;

        case ']':
          if (selectedIds.length > 0) {
            e.preventDefault();
            rotateSelectedElements(rotateStep);
          }
          break;

        // Space for pan mode (handled separately in canvas)
        case ' ':
          // Just prevent default, actual pan mode is handled by canvas
          if (target.tagName === 'BODY') {
            e.preventDefault();
          }
          break;
      }
    },
    [
      enabled,
      selectedIds,
      elements,
      zoom,
      pan,
      moveStep,
      moveStepLarge,
      zoomStep,
      rotateStep,
      moveSelectedElements,
      rotateSelectedElements,
      zoomToCenter,
      fitToContent,
      setPan,
      setZoom,
      undo,
      redo,
      selectAll,
      deselectAll,
      duplicateElements,
      deleteSelectedElements,
      bringToFront,
      sendToBack,
      moveUp,
      moveDown,
      saveToHistory,
    ]
  );

  // IME composition handlers
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
  }, []);

  // Register event listeners
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('compositionstart', handleCompositionStart);
    window.addEventListener('compositionend', handleCompositionEnd);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('compositionstart', handleCompositionStart);
      window.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [enabled, handleKeyDown, handleCompositionStart, handleCompositionEnd]);

  return {
    moveSelectedElements,
    rotateSelectedElements,
    zoomToCenter,
    fitToContent,
  };
}
