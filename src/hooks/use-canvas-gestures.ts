/**
 * Touch and gesture support hook for infinite canvas
 * Supports pinch-to-zoom, two-finger pan, and touch interactions
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface GestureState {
  /** Current gesture type */
  gesture: 'none' | 'pan' | 'pinch' | 'tap' | 'long-press';
  /** Starting center point */
  startCenter: Point;
  /** Current center point */
  center: Point;
  /** Initial distance between touch points */
  startDistance: number;
  /** Current distance between touch points */
  distance: number;
  /** Scale factor from pinch */
  scale: number;
  /** Translation delta */
  delta: Point;
  /** Number of active touches */
  touchCount: number;
  /** Whether gesture is active */
  active: boolean;
}

interface GestureHandlers {
  /** Called when pinch zoom occurs */
  onPinchZoom?: (scale: number, center: Point) => void;
  /** Called when two-finger pan occurs */
  onPan?: (delta: Point) => void;
  /** Called when gesture ends */
  onGestureEnd?: (state: GestureState) => void;
  /** Called on single tap */
  onTap?: (point: Point) => void;
  /** Called on double tap */
  onDoubleTap?: (point: Point) => void;
  /** Called on long press */
  onLongPress?: (point: Point) => void;
}

interface GestureConfig {
  /** Element ref to attach listeners to */
  elementRef: React.RefObject<HTMLElement>;
  /** Whether gestures are enabled */
  enabled?: boolean;
  /** Threshold for pinch detection */
  pinchThreshold?: number;
  /** Threshold for pan detection */
  panThreshold?: number;
  /** Long press duration in ms */
  longPressDuration?: number;
  /** Double tap max interval in ms */
  doubleTapInterval?: number;
}

/**
 * Calculate distance between two points
 */
function getDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate center point between two points
 */
function getCenter(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Get touch point from touch event
 */
function getTouchPoint(touch: Touch): Point {
  return { x: touch.clientX, y: touch.clientY };
}

/**
 * Hook for touch gesture handling
 */
export function useCanvasGestures(config: GestureConfig, handlers: GestureHandlers = {}) {
  const {
    elementRef,
    enabled = true,
    pinchThreshold = 10,
    panThreshold = 5,
    longPressDuration = 500,
    doubleTapInterval = 300,
  } = config;

  const {
    onPinchZoom,
    onPan,
    onGestureEnd,
    onTap,
    onDoubleTap,
    onLongPress,
  } = handlers;

  // State refs for tracking gesture
  const gestureStateRef = useRef<GestureState>({
    gesture: 'none',
    startCenter: { x: 0, y: 0 },
    center: { x: 0, y: 0 },
    startDistance: 0,
    distance: 0,
    scale: 1,
    delta: { x: 0, y: 0 },
    touchCount: 0,
    active: false,
  });

  const lastTapTimeRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startPointRef = useRef<Point>({ x: 0, y: 0 });

  // Expose current gesture state
  const [gestureState, setGestureState] = useState<GestureState>(gestureStateRef.current);

  /**
   * Clear long press timer
   */
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  /**
   * Handle touch start
   */
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touches = e.touches;
      const state = gestureStateRef.current;

      state.touchCount = touches.length;
      state.active = true;

      if (touches.length === 1) {
        // Single touch - potential tap or pan
        const touch = touches[0];
        if (!touch) return;
        const point = getTouchPoint(touch);
        state.startCenter = point;
        state.center = point;
        startPointRef.current = point;

        // Start long press timer
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          if (state.gesture === 'none' && state.active) {
            state.gesture = 'long-press';
            onLongPress?.(state.center);
            setGestureState({ ...state });
          }
        }, longPressDuration);
      } else if (touches.length === 2) {
        // Two touches - pinch or pan
        clearLongPressTimer();

        const touch0 = touches[0];
        const touch1 = touches[1];
        if (!touch0 || !touch1) return;
        const p1 = getTouchPoint(touch0);
        const p2 = getTouchPoint(touch1);

        state.startCenter = getCenter(p1, p2);
        state.center = state.startCenter;
        state.startDistance = getDistance(p1, p2);
        state.distance = state.startDistance;
        state.scale = 1;
        state.delta = { x: 0, y: 0 };
        state.gesture = 'none'; // Will be determined on move

        // Prevent default to stop browser zoom
        e.preventDefault();
      }

      setGestureState({ ...state });
    },
    [enabled, onLongPress, longPressDuration, clearLongPressTimer]
  );

  /**
   * Handle touch move
   */
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touches = e.touches;
      const state = gestureStateRef.current;

      if (touches.length === 1 && state.touchCount === 1) {
        // Single touch move - pan
        clearLongPressTimer();

        const touch = touches[0];
        if (!touch) return;
        const point = getTouchPoint(touch);
        const dx = point.x - state.center.x;
        const dy = point.y - state.center.y;

        if (state.gesture === 'none') {
          const totalDx = point.x - startPointRef.current.x;
          const totalDy = point.y - startPointRef.current.y;
          const totalDistance = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

          if (totalDistance > panThreshold) {
            state.gesture = 'pan';
          }
        }

        if (state.gesture === 'pan') {
          state.delta = { x: dx, y: dy };
          state.center = point;
          onPan?.(state.delta);
        }
      } else if (touches.length === 2) {
        // Two finger gesture
        e.preventDefault();
        clearLongPressTimer();

        const touch0 = touches[0];
        const touch1 = touches[1];
        if (!touch0 || !touch1) return;
        const p1 = getTouchPoint(touch0);
        const p2 = getTouchPoint(touch1);

        const newCenter = getCenter(p1, p2);
        const newDistance = getDistance(p1, p2);

        // Determine gesture type based on movement
        const distanceDelta = Math.abs(newDistance - state.startDistance);
        const centerDelta = getDistance(newCenter, state.startCenter);

        if (state.gesture === 'none') {
          if (distanceDelta > pinchThreshold) {
            state.gesture = 'pinch';
          } else if (centerDelta > panThreshold) {
            state.gesture = 'pan';
          }
        }

        // Update state
        const prevCenter = state.center;
        state.center = newCenter;
        state.distance = newDistance;
        state.scale = newDistance / state.startDistance;
        state.delta = {
          x: newCenter.x - prevCenter.x,
          y: newCenter.y - prevCenter.y,
        };

        if (state.gesture === 'pinch') {
          onPinchZoom?.(state.scale, state.center);
        } else if (state.gesture === 'pan') {
          onPan?.(state.delta);
        }
      }

      setGestureState({ ...state });
    },
    [enabled, onPan, onPinchZoom, pinchThreshold, panThreshold, clearLongPressTimer]
  );

  /**
   * Handle touch end
   */
  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      clearLongPressTimer();

      const state = gestureStateRef.current;
      const wasActive = state.active;
      const wasGesture = state.gesture;

      // Check for tap
      if (wasActive && wasGesture === 'none' && state.touchCount === 1) {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTimeRef.current;

        if (timeSinceLastTap < doubleTapInterval) {
          // Double tap
          onDoubleTap?.(state.center);
          lastTapTimeRef.current = 0;
        } else {
          // Single tap
          onTap?.(state.center);
          lastTapTimeRef.current = now;
        }
      }

      // Reset state if all touches ended
      if (e.touches.length === 0) {
        if (wasActive) {
          onGestureEnd?.(state);
        }

        state.gesture = 'none';
        state.active = false;
        state.touchCount = 0;
        state.scale = 1;
        state.delta = { x: 0, y: 0 };
      } else {
        state.touchCount = e.touches.length;
      }

      setGestureState({ ...state });
    },
    [enabled, onTap, onDoubleTap, onGestureEnd, doubleTapInterval, clearLongPressTimer]
  );

  /**
   * Handle touch cancel
   */
  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();

    const state = gestureStateRef.current;
    state.gesture = 'none';
    state.active = false;
    state.touchCount = 0;
    state.scale = 1;
    state.delta = { x: 0, y: 0 };

    setGestureState({ ...state });
  }, [clearLongPressTimer]);

  // Attach event listeners
  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    // Use passive: false to allow preventDefault on touch events
    const options = { passive: false };

    element.addEventListener('touchstart', handleTouchStart, options);
    element.addEventListener('touchmove', handleTouchMove, options);
    element.addEventListener('touchend', handleTouchEnd, options);
    element.addEventListener('touchcancel', handleTouchCancel, options);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
      clearLongPressTimer();
    };
  }, [
    elementRef,
    enabled,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    clearLongPressTimer,
  ]);

  return {
    gestureState,
    isActive: gestureState.active,
    isPinching: gestureState.gesture === 'pinch',
    isPanning: gestureState.gesture === 'pan',
  };
}

/**
 * Wheel event handler with trackpad detection
 */
export function useWheelGesture(
  elementRef: React.RefObject<HTMLElement>,
  handlers: {
    onZoom?: (delta: number, center: Point) => void;
    onPan?: (delta: Point) => void;
  },
  enabled = true
) {
  const { onZoom, onPan } = handlers;

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!enabled) return;

      e.preventDefault();

      const center = { x: e.clientX, y: e.clientY };

      // Detect trackpad pinch (ctrlKey is set for pinch gestures)
      if (e.ctrlKey) {
        // Pinch to zoom
        const delta = -e.deltaY * 0.01;
        onZoom?.(delta, center);
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        // Horizontal scroll or shift+scroll for pan
        onPan?.({ x: -e.deltaX, y: -e.deltaY });
      } else {
        // Regular scroll
        onPan?.({ x: -e.deltaX, y: -e.deltaY });
      }
    },
    [enabled, onZoom, onPan]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [elementRef, enabled, handleWheel]);
}
