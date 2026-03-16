import { useRef, useCallback } from 'react';

interface UndoEntry {
  rowIndex: number;
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  /** Full row snapshot for complex changes (e.g. NDC clear) */
  oldRow?: Record<string, any>;
  newRow?: Record<string, any>;
}

const MAX_STACK = 200;

/**
 * In-memory undo/redo stack for scan table cell edits.
 * Works fully offline — no persistence needed.
 */
export function useScanUndoRedo() {
  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);

  const pushUndo = useCallback((entry: UndoEntry) => {
    undoStack.current.push(entry);
    if (undoStack.current.length > MAX_STACK) {
      undoStack.current.shift();
    }
    // Any new edit clears redo
    redoStack.current = [];
  }, []);

  const undo = useCallback((): UndoEntry | null => {
    const entry = undoStack.current.pop();
    if (!entry) return null;
    redoStack.current.push(entry);
    return entry;
  }, []);

  const redo = useCallback((): UndoEntry | null => {
    const entry = redoStack.current.pop();
    if (!entry) return null;
    undoStack.current.push(entry);
    return entry;
  }, []);

  const canUndo = useCallback(() => undoStack.current.length > 0, []);
  const canRedo = useCallback(() => redoStack.current.length > 0, []);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
  }, []);

  return { pushUndo, undo, redo, canUndo, canRedo, clear };
}
