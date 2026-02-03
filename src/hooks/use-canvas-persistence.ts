/**
 * Canvas persistence hook for debounced database sync and local storage drafts
 * Handles optimistic updates, conflict resolution, and offline support
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@/features/canvas';
import type { CanvasElement } from '@/types/canvas';

interface PersistenceState {
  /** Last saved timestamp */
  lastSaved: number | null;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether currently saving */
  isSaving: boolean;
  /** Last error */
  error: Error | null;
  /** Sync status */
  syncStatus: 'synced' | 'pending' | 'saving' | 'error' | 'offline';
}

interface PersistenceConfig {
  /** Project ID for saving */
  projectId?: string;
  /** Debounce delay for auto-save in ms */
  debounceMs?: number;
  /** Local storage key prefix */
  storagePrefix?: string;
  /** Enable local storage drafts */
  enableLocalStorage?: boolean;
  /** Enable server sync */
  enableServerSync?: boolean;
  /** Custom save function */
  onSave?: (elements: CanvasElement[]) => Promise<void>;
  /** Custom load function */
  onLoad?: () => Promise<CanvasElement[]>;
  /** Conflict resolution strategy */
  conflictResolution?: 'local-wins' | 'server-wins' | 'merge';
}

const DEFAULT_CONFIG: Required<Omit<PersistenceConfig, 'projectId' | 'onSave' | 'onLoad'>> = {
  debounceMs: 2000,
  storagePrefix: 'canvas-draft',
  enableLocalStorage: true,
  enableServerSync: true,
  conflictResolution: 'local-wins',
};

/**
 * Local storage utilities
 */
const storage = {
  getKey(prefix: string, projectId: string): string {
    return `${prefix}:${projectId}`;
  },

  save(prefix: string, projectId: string, elements: CanvasElement[]): void {
    try {
      const key = this.getKey(prefix, projectId);
      const data = JSON.stringify({
        elements,
        timestamp: Date.now(),
        version: 1,
      });
      localStorage.setItem(key, data);
    } catch (error) {
      console.warn('Failed to save to local storage:', error);
    }
  },

  load(prefix: string, projectId: string): { elements: CanvasElement[]; timestamp: number } | null {
    try {
      const key = this.getKey(prefix, projectId);
      const data = localStorage.getItem(key);
      if (!data) return null;

      const parsed = JSON.parse(data);
      return {
        elements: parsed.elements || [],
        timestamp: parsed.timestamp || 0,
      };
    } catch {
      return null;
    }
  },

  clear(prefix: string, projectId: string): void {
    try {
      const key = this.getKey(prefix, projectId);
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },

  hasUnsavedChanges(prefix: string, projectId: string): boolean {
    try {
      const key = this.getKey(prefix, projectId);
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  },
};

/**
 * Hook for canvas persistence
 */
export function useCanvasPersistence(config: PersistenceConfig = {}) {
  const {
    projectId,
    debounceMs = DEFAULT_CONFIG.debounceMs,
    storagePrefix = DEFAULT_CONFIG.storagePrefix,
    enableLocalStorage = DEFAULT_CONFIG.enableLocalStorage,
    enableServerSync = DEFAULT_CONFIG.enableServerSync,
    conflictResolution = DEFAULT_CONFIG.conflictResolution,
    onSave,
    onLoad,
  } = config;

  const { elements, loadProject, history, historyIndex } = useCanvasStore();

  const [state, setState] = useState<PersistenceState>({
    lastSaved: null,
    isDirty: false,
    isSaving: false,
    error: null,
    syncStatus: 'synced',
  });

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedElementsRef = useRef<string>('');
  const isOnlineRef = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true);

  /**
   * Check if elements have changed since last save
   */
  const hasChanges = useCallback(() => {
    const currentHash = JSON.stringify(elements);
    return currentHash !== lastSavedElementsRef.current;
  }, [elements]);

  /**
   * Save to local storage (immediate)
   */
  const saveToLocalStorage = useCallback(() => {
    if (!enableLocalStorage || !projectId) return;
    storage.save(storagePrefix, projectId, elements);
  }, [enableLocalStorage, projectId, storagePrefix, elements]);

  /**
   * Save to server (debounced)
   */
  const saveToServer = useCallback(async (): Promise<boolean> => {
    if (!enableServerSync || !projectId) return true;

    if (!isOnlineRef.current) {
      setState((prev) => ({ ...prev, syncStatus: 'offline' }));
      return false;
    }

    setState((prev) => ({ ...prev, isSaving: true, syncStatus: 'saving' }));

    try {
      if (onSave) {
        await onSave(elements);
      } else {
        // Default API call
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ elements }),
        });

        if (!response.ok) {
          throw new Error(`Failed to save: ${response.statusText}`);
        }
      }

      lastSavedElementsRef.current = JSON.stringify(elements);
      setState((prev) => ({
        ...prev,
        lastSaved: Date.now(),
        isDirty: false,
        isSaving: false,
        error: null,
        syncStatus: 'synced',
      }));

      // Clear local storage after successful server save
      if (enableLocalStorage && projectId) {
        storage.clear(storagePrefix, projectId);
      }

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Save failed');
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: err,
        syncStatus: 'error',
      }));
      return false;
    }
  }, [enableServerSync, projectId, elements, onSave, enableLocalStorage, storagePrefix]);

  /**
   * Schedule debounced save
   */
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    setState((prev) => ({ ...prev, isDirty: true, syncStatus: 'pending' }));

    // Immediate local storage save
    saveToLocalStorage();

    // Debounced server save
    saveTimerRef.current = setTimeout(() => {
      saveToServer();
    }, debounceMs);
  }, [debounceMs, saveToLocalStorage, saveToServer]);

  /**
   * Force immediate save
   */
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveToLocalStorage();
    return saveToServer();
  }, [saveToLocalStorage, saveToServer]);

  /**
   * Load from server
   */
  const loadFromServer = useCallback(async (): Promise<CanvasElement[] | null> => {
    if (!enableServerSync || !projectId) return null;

    try {
      let serverElements: CanvasElement[];

      if (onLoad) {
        serverElements = await onLoad();
      } else {
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
          throw new Error(`Failed to load: ${response.statusText}`);
        }
        const data = await response.json();
        serverElements = data.elements || [];
      }

      return serverElements;
    } catch (error) {
      console.error('Failed to load from server:', error);
      return null;
    }
  }, [enableServerSync, projectId, onLoad]);

  /**
   * Load with conflict resolution
   */
  const load = useCallback(async (): Promise<void> => {
    if (!projectId) return;

    // Check for local draft
    const localDraft = enableLocalStorage ? storage.load(storagePrefix, projectId) : null;

    // Load from server
    const serverElements = await loadFromServer();

    if (!serverElements && !localDraft) {
      // Nothing to load
      return;
    }

    if (!serverElements && localDraft) {
      // Only local draft available
      loadProject(localDraft.elements);
      lastSavedElementsRef.current = JSON.stringify(localDraft.elements);
      setState((prev) => ({ ...prev, isDirty: true, syncStatus: 'pending' }));
      return;
    }

    if (serverElements && !localDraft) {
      // Only server data available
      loadProject(serverElements);
      lastSavedElementsRef.current = JSON.stringify(serverElements);
      return;
    }

    // Both available - resolve conflict
    if (serverElements && localDraft) {
      switch (conflictResolution) {
        case 'local-wins':
          loadProject(localDraft.elements);
          lastSavedElementsRef.current = JSON.stringify(localDraft.elements);
          setState((prev) => ({ ...prev, isDirty: true, syncStatus: 'pending' }));
          break;

        case 'server-wins':
          loadProject(serverElements);
          lastSavedElementsRef.current = JSON.stringify(serverElements);
          storage.clear(storagePrefix, projectId);
          break;

        case 'merge':
          // Simple merge: server elements + local elements with different IDs
          const serverIds = new Set(serverElements.map((e) => e.id));
          const merged = [
            ...serverElements,
            ...localDraft.elements.filter((e) => !serverIds.has(e.id)),
          ];
          loadProject(merged);
          lastSavedElementsRef.current = JSON.stringify(merged);
          setState((prev) => ({ ...prev, isDirty: true, syncStatus: 'pending' }));
          break;
      }
    }
  }, [projectId, enableLocalStorage, storagePrefix, conflictResolution, loadFromServer, loadProject]);

  /**
   * Discard local changes
   */
  const discardLocalChanges = useCallback(async () => {
    if (!projectId) return;

    storage.clear(storagePrefix, projectId);
    const serverElements = await loadFromServer();
    if (serverElements) {
      loadProject(serverElements);
      lastSavedElementsRef.current = JSON.stringify(serverElements);
      setState((prev) => ({ ...prev, isDirty: false, syncStatus: 'synced' }));
    }
  }, [projectId, storagePrefix, loadFromServer, loadProject]);

  // Track element changes
  useEffect(() => {
    if (hasChanges()) {
      scheduleSave();
    }
  }, [elements, history, historyIndex, hasChanges, scheduleSave]);

  // Online/offline handling
  useEffect(() => {
    const handleOnline = () => {
      isOnlineRef.current = true;
      if (state.isDirty) {
        saveToServer();
      }
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
      setState((prev) => ({ ...prev, syncStatus: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state.isDirty, saveToServer]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent): string | undefined => {
      if (state.isDirty && enableLocalStorage && projectId) {
        storage.save(storagePrefix, projectId, elements);
      }

      if (state.isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.isDirty, enableLocalStorage, projectId, storagePrefix, elements]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return {
    ...state,
    hasLocalDraft: projectId ? storage.hasUnsavedChanges(storagePrefix, projectId) : false,
    isOnline: isOnlineRef.current,
    saveNow,
    load,
    discardLocalChanges,
  };
}
