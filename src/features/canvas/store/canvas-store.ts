import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  CanvasElement,
  CanvasState,
  ToolType,
  ShapeToolType,
  Transform,
} from '@/types/canvas';
import { generateId } from '@/lib/utils';

interface CanvasStore extends CanvasState {
  // Tool state
  activeTool: ToolType;
  activeShapeTool: ShapeToolType;
  
  // Settings
  gridEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
  
  // Actions - Elements
  addElement: (element: Omit<CanvasElement, 'id' | 'zIndex'>) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  deleteSelectedElements: () => void;
  duplicateElements: (ids: string[]) => void;
  
  // Actions - Selection
  selectElement: (id: string, append?: boolean) => void;
  selectElements: (ids: string[]) => void;
  deselectAll: () => void;
  selectAll: () => void;
  
  // Actions - Transform
  transformElement: (id: string, transform: Partial<Transform>) => void;
  transformSelectedElements: (transform: Partial<Transform>) => void;
  
  // Actions - Layer ordering
  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;
  moveUp: (ids: string[]) => void;
  moveDown: (ids: string[]) => void;
  
  // Actions - History
  undo: () => void;
  redo: () => void;
  saveToHistory: () => void;
  
  // Actions - View
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetView: () => void;
  
  // Actions - Tools
  setActiveTool: (tool: ToolType) => void;
  setActiveShapeTool: (tool: ShapeToolType) => void;
  
  // Actions - Settings
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;
  
  // Actions - Project
  clearCanvas: () => void;
  loadProject: (elements: CanvasElement[]) => void;
  exportState: () => CanvasState;
}

const initialState: CanvasState = {
  elements: [],
  selectedIds: [],
  history: [[]],
  historyIndex: 0,
  zoom: 1,
  pan: { x: 0, y: 0 },
};

export const useCanvasStore = create<CanvasStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,
        activeTool: 'select' as ToolType,
        activeShapeTool: 'rect' as ShapeToolType,
        gridEnabled: false,
        snapToGrid: false,
        gridSize: 20,

        // Elements
        addElement: (element) =>
          set((state) => {
            const maxZIndex = Math.max(0, ...state.elements.map((e) => e.zIndex));
            const newElement = {
              ...element,
              id: generateId(),
              zIndex: maxZIndex + 1,
            } as CanvasElement;
            state.elements.push(newElement);
            state.selectedIds = [newElement.id];
          }),

        updateElement: (id, updates) =>
          set((state) => {
            const index = state.elements.findIndex((e) => e.id === id);
            if (index !== -1) {
              state.elements[index] = { ...state.elements[index], ...updates } as CanvasElement;
            }
          }),

        deleteElement: (id) =>
          set((state) => {
            state.elements = state.elements.filter((e) => e.id !== id);
            state.selectedIds = state.selectedIds.filter((sid) => sid !== id);
          }),

        deleteSelectedElements: () =>
          set((state) => {
            state.elements = state.elements.filter((e) => !state.selectedIds.includes(e.id));
            state.selectedIds = [];
          }),

        duplicateElements: (ids) =>
          set((state) => {
            const toDuplicate = state.elements.filter((e) => ids.includes(e.id));
            const maxZIndex = Math.max(0, ...state.elements.map((e) => e.zIndex));
            const newElements = toDuplicate.map((e, i) => ({
              ...e,
              id: generateId(),
              x: e.x + 20,
              y: e.y + 20,
              zIndex: maxZIndex + i + 1,
            }));
            state.elements.push(...newElements);
            state.selectedIds = newElements.map((e) => e.id);
          }),

        // Selection
        selectElement: (id, append = false) =>
          set((state) => {
            if (append) {
              if (state.selectedIds.includes(id)) {
                state.selectedIds = state.selectedIds.filter((sid) => sid !== id);
              } else {
                state.selectedIds.push(id);
              }
            } else {
              state.selectedIds = [id];
            }
          }),

        selectElements: (ids) =>
          set((state) => {
            state.selectedIds = ids;
          }),

        deselectAll: () =>
          set((state) => {
            state.selectedIds = [];
          }),

        selectAll: () =>
          set((state) => {
            state.selectedIds = state.elements.map((e) => e.id);
          }),

        // Transform
        transformElement: (id, transform) =>
          set((state) => {
            const element = state.elements.find((e) => e.id === id);
            if (element) {
              Object.assign(element, transform);
            }
          }),

        transformSelectedElements: (transform) =>
          set((state) => {
            state.elements.forEach((element) => {
              if (state.selectedIds.includes(element.id)) {
                Object.assign(element, transform);
              }
            });
          }),

        // Layer ordering
        bringToFront: (ids) =>
          set((state) => {
            const maxZIndex = Math.max(...state.elements.map((e) => e.zIndex));
            ids.forEach((id, i) => {
              const element = state.elements.find((e) => e.id === id);
              if (element) {
                element.zIndex = maxZIndex + i + 1;
              }
            });
          }),

        sendToBack: (ids) =>
          set((state) => {
            const minZIndex = Math.min(...state.elements.map((e) => e.zIndex));
            ids.forEach((id, i) => {
              const element = state.elements.find((e) => e.id === id);
              if (element) {
                element.zIndex = minZIndex - (ids.length - i);
              }
            });
          }),

        moveUp: (ids) =>
          set((state) => {
            const sorted = [...state.elements].sort((a, b) => a.zIndex - b.zIndex);
            ids.forEach((id) => {
              const index = sorted.findIndex((e) => e.id === id);
              if (index < sorted.length - 1) {
                const current = sorted[index]!;
                const next = sorted[index + 1]!;
                const tempZIndex = current.zIndex;
                current.zIndex = next.zIndex;
                next.zIndex = tempZIndex;
              }
            });
          }),

        moveDown: (ids) =>
          set((state) => {
            const sorted = [...state.elements].sort((a, b) => a.zIndex - b.zIndex);
            ids.forEach((id) => {
              const index = sorted.findIndex((e) => e.id === id);
              if (index > 0) {
                const current = sorted[index]!;
                const prev = sorted[index - 1]!;
                const tempZIndex = current.zIndex;
                current.zIndex = prev.zIndex;
                prev.zIndex = tempZIndex;
              }
            });
          }),

        // History
        saveToHistory: () =>
          set((state) => {
            const newHistory = state.history.slice(0, state.historyIndex + 1);
            newHistory.push(JSON.parse(JSON.stringify(state.elements)));
            // Keep last 50 history states
            if (newHistory.length > 50) {
              newHistory.shift();
            }
            state.history = newHistory;
            state.historyIndex = newHistory.length - 1;
          }),

        undo: () =>
          set((state) => {
            if (state.historyIndex > 0) {
              state.historyIndex--;
              state.elements = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
              state.selectedIds = [];
            }
          }),

        redo: () =>
          set((state) => {
            if (state.historyIndex < state.history.length - 1) {
              state.historyIndex++;
              state.elements = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
              state.selectedIds = [];
            }
          }),

        // View
        setZoom: (zoom) =>
          set((state) => {
            state.zoom = Math.min(Math.max(zoom, 0.1), 5);
          }),

        setPan: (pan) =>
          set((state) => {
            state.pan = pan;
          }),

        resetView: () =>
          set((state) => {
            state.zoom = 1;
            state.pan = { x: 0, y: 0 };
          }),

        // Tools
        setActiveTool: (tool) =>
          set((state) => {
            state.activeTool = tool;
          }),

        setActiveShapeTool: (tool) =>
          set((state) => {
            state.activeShapeTool = tool;
          }),

        // Settings
        toggleGrid: () =>
          set((state) => {
            state.gridEnabled = !state.gridEnabled;
          }),

        toggleSnapToGrid: () =>
          set((state) => {
            state.snapToGrid = !state.snapToGrid;
          }),

        setGridSize: (size) =>
          set((state) => {
            state.gridSize = size;
          }),

        // Project
        clearCanvas: () =>
          set((state) => {
            state.elements = [];
            state.selectedIds = [];
            state.history = [[]];
            state.historyIndex = 0;
          }),

        loadProject: (elements) =>
          set((state) => {
            state.elements = elements;
            state.selectedIds = [];
            state.history = [elements];
            state.historyIndex = 0;
          }),

        exportState: () => {
          const state = get();
          return {
            elements: state.elements,
            selectedIds: state.selectedIds,
            history: state.history,
            historyIndex: state.historyIndex,
            zoom: state.zoom,
            pan: state.pan,
          };
        },
      })),
      {
        name: 'canvas-store',
        partialize: (state) => ({
          gridEnabled: state.gridEnabled,
          snapToGrid: state.snapToGrid,
          gridSize: state.gridSize,
        }),
      }
    ),
    { name: 'CanvasStore' }
  )
);
