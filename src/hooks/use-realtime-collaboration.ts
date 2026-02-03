/**
 * Real-time collaboration hook for infinite canvas
 * Handles WebSocket connections, presence, live cursors, and element synchronization
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@/features/canvas';
import { useDebounce } from './use-debounce';
import type { CanvasElement } from '@/types/canvas';

/**
 * Collaborator cursor position
 */
export interface CursorPosition {
  x: number;
  y: number;
  timestamp: number;
}

/**
 * Collaborator presence information
 */
export interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor: CursorPosition | null;
  isActive: boolean;
  lastSeen: number;
}

/**
 * Element update message
 */
interface ElementUpdate {
  type: 'create' | 'update' | 'delete';
  element?: Partial<CanvasElement> & { id: string };
  elementId?: string;
  userId: string;
  timestamp: number;
}

/**
 * WebSocket message types
 */
type WebSocketMessage =
  | { type: 'join'; userId: string; name: string; color: string }
  | { type: 'leave'; userId: string }
  | { type: 'cursor'; userId: string; cursor: CursorPosition }
  | { type: 'element'; update: ElementUpdate }
  | { type: 'presence'; collaborators: Collaborator[] }
  | { type: 'sync'; elements: CanvasElement[] }
  | { type: 'lock'; elementId: string; userId: string }
  | { type: 'unlock'; elementId: string };

/**
 * Connection state
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * Collaboration configuration
 */
interface CollaborationConfig {
  /** WebSocket URL */
  wsUrl?: string;
  /** Room/project ID */
  roomId?: string;
  /** User information */
  user?: {
    id: string;
    name: string;
    color?: string;
  };
  /** Enable collaboration */
  enabled?: boolean;
  /** Cursor broadcast debounce in ms */
  cursorDebounceMs?: number;
  /** Reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay base in ms */
  reconnectDelayMs?: number;
}

const DEFAULT_CONFIG: Required<Omit<CollaborationConfig, 'wsUrl' | 'roomId' | 'user'>> = {
  enabled: false,
  cursorDebounceMs: 50,
  maxReconnectAttempts: 5,
  reconnectDelayMs: 1000,
};

// Generate random color for user
function generateUserColor(): string {
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
  ];
  return colors[Math.floor(Math.random() * colors.length)] ?? '#3b82f6';
}

/**
 * Real-time collaboration hook
 */
export function useRealtimeCollaboration(config: CollaborationConfig = {}) {
  const {
    wsUrl,
    roomId,
    user,
    enabled = DEFAULT_CONFIG.enabled,
    cursorDebounceMs = DEFAULT_CONFIG.cursorDebounceMs,
    maxReconnectAttempts = DEFAULT_CONFIG.maxReconnectAttempts,
    reconnectDelayMs = DEFAULT_CONFIG.reconnectDelayMs,
  } = config;

  const { updateElement, addElement, deleteElement } = useCanvasStore();

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [collaborators, setCollaborators] = useState<Map<string, Collaborator>>(new Map());
  const [lockedElements, setLockedElements] = useState<Map<string, string>>(new Map());

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cursorPositionRef = useRef<CursorPosition | null>(null);

  // User color (persistent per session)
  const userColorRef = useRef(user?.color || generateUserColor());

  /**
   * Send message through WebSocket
   */
  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  /**
   * Broadcast cursor position (debounced)
   */
  const debouncedCursor = useDebounce(cursorPositionRef.current, cursorDebounceMs);

  useEffect(() => {
    if (debouncedCursor && user && connectionState === 'connected') {
      send({
        type: 'cursor',
        userId: user.id,
        cursor: debouncedCursor,
      });
    }
  }, [debouncedCursor, user, connectionState, send]);

  /**
   * Update local cursor position
   */
  const updateCursor = useCallback((x: number, y: number) => {
    cursorPositionRef.current = {
      x,
      y,
      timestamp: Date.now(),
    };
  }, []);

  /**
   * Broadcast element update
   */
  const broadcastElementUpdate = useCallback(
    (update: Omit<ElementUpdate, 'userId' | 'timestamp'>) => {
      if (!user || connectionState !== 'connected') return;

      send({
        type: 'element',
        update: {
          ...update,
          userId: user.id,
          timestamp: Date.now(),
        },
      });
    },
    [user, connectionState, send]
  );

  /**
   * Lock an element for editing
   */
  const lockElement = useCallback(
    (elementId: string): boolean => {
      const currentLock = lockedElements.get(elementId);

      // Already locked by another user
      if (currentLock && currentLock !== user?.id) {
        return false;
      }

      // Already locked by us
      if (currentLock === user?.id) {
        return true;
      }

      // Lock it
      if (user) {
        send({ type: 'lock', elementId, userId: user.id });
        setLockedElements((prev) => new Map(prev).set(elementId, user.id));
      }

      return true;
    },
    [user, lockedElements, send]
  );

  /**
   * Unlock an element
   */
  const unlockElement = useCallback(
    (elementId: string) => {
      const currentLock = lockedElements.get(elementId);

      if (currentLock === user?.id) {
        send({ type: 'unlock', elementId });
        setLockedElements((prev) => {
          const next = new Map(prev);
          next.delete(elementId);
          return next;
        });
      }
    },
    [user, lockedElements, send]
  );

  /**
   * Check if element is locked by another user
   */
  const isElementLocked = useCallback(
    (elementId: string): boolean => {
      const locker = lockedElements.get(elementId);
      return locker !== undefined && locker !== user?.id;
    },
    [lockedElements, user]
  );

  /**
   * Get lock holder for element
   */
  const getElementLocker = useCallback(
    (elementId: string): Collaborator | null => {
      const lockerId = lockedElements.get(elementId);
      if (!lockerId) return null;
      return collaborators.get(lockerId) || null;
    },
    [lockedElements, collaborators]
  );

  /**
   * Handle incoming WebSocket message
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;

        switch (message.type) {
          case 'join':
            setCollaborators((prev) => {
              const next = new Map(prev);
              next.set(message.userId, {
                id: message.userId,
                name: message.name,
                color: message.color,
                cursor: null,
                isActive: true,
                lastSeen: Date.now(),
              });
              return next;
            });
            break;

          case 'leave':
            setCollaborators((prev) => {
              const next = new Map(prev);
              next.delete(message.userId);
              return next;
            });
            // Unlock elements held by leaving user
            setLockedElements((prev) => {
              const next = new Map(prev);
              prev.forEach((userId, elementId) => {
                if (userId === message.userId) {
                  next.delete(elementId);
                }
              });
              return next;
            });
            break;

          case 'cursor':
            setCollaborators((prev) => {
              const collab = prev.get(message.userId);
              if (!collab) return prev;

              const next = new Map(prev);
              next.set(message.userId, {
                ...collab,
                cursor: message.cursor,
                isActive: true,
                lastSeen: Date.now(),
              });
              return next;
            });
            break;

          case 'element':
            // Skip our own updates
            if (message.update.userId === user?.id) break;

            switch (message.update.type) {
              case 'create':
                if (message.update.element) {
                  addElement(message.update.element as Omit<CanvasElement, 'id' | 'zIndex'>);
                }
                break;
              case 'update':
                if (message.update.element) {
                  updateElement(message.update.element.id, message.update.element);
                }
                break;
              case 'delete':
                if (message.update.elementId) {
                  deleteElement(message.update.elementId);
                }
                break;
            }
            break;

          case 'presence':
            setCollaborators(new Map(message.collaborators.map((c) => [c.id, c])));
            break;

          case 'sync':
            // Full state sync from server
            // Handle conflict resolution here if needed
            break;

          case 'lock':
            setLockedElements((prev) => new Map(prev).set(message.elementId, message.userId));
            break;

          case 'unlock':
            setLockedElements((prev) => {
              const next = new Map(prev);
              next.delete(message.elementId);
              return next;
            });
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    },
    [user, addElement, updateElement, deleteElement]
  );

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (!enabled || !wsUrl || !roomId || !user) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionState('connecting');

    try {
      const url = new URL(wsUrl);
      url.searchParams.set('room', roomId);
      url.searchParams.set('userId', user.id);

      wsRef.current = new WebSocket(url.toString());

      wsRef.current.onopen = () => {
        setConnectionState('connected');
        reconnectAttemptRef.current = 0;

        // Send join message
        send({
          type: 'join',
          userId: user.id,
          name: user.name,
          color: userColorRef.current,
        });
      };

      wsRef.current.onmessage = handleMessage;

      wsRef.current.onclose = () => {
        setConnectionState('disconnected');

        // Attempt reconnection
        if (reconnectAttemptRef.current < maxReconnectAttempts) {
          setConnectionState('reconnecting');
          const delay = reconnectDelayMs * Math.pow(2, reconnectAttemptRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            reconnectAttemptRef.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      setConnectionState('disconnected');
    }
  }, [enabled, wsUrl, roomId, user, maxReconnectAttempts, reconnectDelayMs, send, handleMessage]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      if (user && wsRef.current.readyState === WebSocket.OPEN) {
        send({ type: 'leave', userId: user.id });
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionState('disconnected');
    setCollaborators(new Map());
    setLockedElements(new Map());
  }, [user, send]);

  // Auto-connect when enabled
  useEffect(() => {
    if (enabled && wsUrl && roomId && user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, wsUrl, roomId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up stale collaborators
  useEffect(() => {
    const interval = setInterval(() => {
      const staleThreshold = Date.now() - 30000; // 30 seconds

      setCollaborators((prev) => {
        const next = new Map(prev);
        let changed = false;

        prev.forEach((collab, id) => {
          if (collab.lastSeen < staleThreshold) {
            next.set(id, { ...collab, isActive: false });
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return {
    // Connection state
    connectionState,
    isConnected: connectionState === 'connected',
    connect,
    disconnect,

    // Collaborators
    collaborators: Array.from(collaborators.values()),
    activeCollaborators: Array.from(collaborators.values()).filter((c) => c.isActive),

    // Cursor
    updateCursor,

    // Element updates
    broadcastElementUpdate,

    // Locking
    lockElement,
    unlockElement,
    isElementLocked,
    getElementLocker,
    lockedElements: Object.fromEntries(lockedElements),

    // User info
    userColor: userColorRef.current,
  };
}

/**
 * Cursor indicator component props
 */
export interface CursorIndicatorProps {
  collaborator: Collaborator;
  zoom: number;
  pan: { x: number; y: number };
}

// RemoteCursor component is exported from '@/components/canvas/remote-cursor'
