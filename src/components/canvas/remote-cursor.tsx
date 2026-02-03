'use client';

import type { Collaborator } from '@/hooks/use-realtime-collaboration';

/**
 * Cursor indicator component props
 */
export interface CursorIndicatorProps {
  collaborator: Collaborator;
  zoom: number;
  pan: { x: number; y: number };
}

/**
 * Remote cursor component for rendering collaborator cursors
 */
export function RemoteCursor({ collaborator, zoom, pan }: CursorIndicatorProps) {
  if (!collaborator.cursor || !collaborator.isActive) return null;

  const x = collaborator.cursor.x * zoom + pan.x;
  const y = collaborator.cursor.y * zoom + pan.y;

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: x,
        top: y,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* Cursor icon */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
      >
        <path
          d="M5.65 2.147L21.153 11.93a1 1 0 01-.05 1.773l-6.157 3.078a1 1 0 00-.474.474l-3.078 6.157a1 1 0 01-1.772.05L.147 5.65a1 1 0 011.103-1.403l3.6.6.6 3.6a1 1 0 00-.8-5.6z"
          fill={collaborator.color}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>
      {/* Name label */}
      <div
        className="absolute left-4 top-4 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-white"
        style={{ backgroundColor: collaborator.color }}
      >
        {collaborator.name}
      </div>
    </div>
  );
}
