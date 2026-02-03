export { useToast, toast } from './use-toast';
export { useDebounce, useDebouncedCallback } from './use-debounce';
export {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersDarkMode,
  usePrefersReducedMotion,
} from './use-media-query';
export {
  useAuth,
  useRequireAuth,
  useRequireRole,
  useRequireVerifiedEmail,
} from './use-auth';
export { useSanitize, useSanitizedValue } from './use-sanitize';

// Canvas hooks
export { useCanvasWorker } from './use-canvas-worker';
export { useCanvasKeyboard } from './use-canvas-keyboard';
export { useCanvasGestures, useWheelGesture } from './use-canvas-gestures';
export { useSpatialIndex } from './use-spatial-index';
export { useProgressiveLoading } from './use-progressive-loading';
export { useCanvasPersistence } from './use-canvas-persistence';
export { useRealtimeCollaboration } from './use-realtime-collaboration';
export type { Collaborator, CursorPosition, CursorIndicatorProps } from './use-realtime-collaboration';
export { RemoteCursor } from '@/components/canvas/remote-cursor';

// Upload hooks
export { useImageUpload } from './use-image-upload';
export type { UploadedImage, UploadProgress, UseImageUploadOptions } from './use-image-upload';
