import { useCallback, useRef, useState } from 'react';
import { enablePatches, produceWithPatches, applyPatches, produce } from 'immer';
import type { Draft, Objectish, Patch } from 'immer';

enablePatches();

const MAX_HISTORY = 100;

type PatchEntry = { kind: 'patch'; patches: Patch[]; inversePatches: Patch[] };
type SnapshotEntry<S> = { kind: 'snapshot'; before: S; after: S };
type HistoryEntry<S> = PatchEntry | SnapshotEntry<S>;

export function useHistory<S extends Objectish>(initialState: S) {
    const [state, setState] = useState<S>(initialState);
    const stateRef = useRef<S>(initialState);
    stateRef.current = state;

    const historyRef = useRef<HistoryEntry<S>[]>([]);
    const futureRef = useRef<HistoryEntry<S>[]>([]);
    const [undoCount, setUndoCount] = useState(0);
    const [redoCount, setRedoCount] = useState(0);

    const pushEntry = useCallback((entry: HistoryEntry<S>) => {
        const history = historyRef.current;
        historyRef.current = history.length >= MAX_HISTORY
            ? [...history.slice(1), entry]
            : [...history, entry];
        futureRef.current = [];
        setUndoCount(historyRef.current.length);
        setRedoCount(0);
    }, []);

    const record = useCallback((recipe: (draft: Draft<S>) => void) => {
        const [nextState, patches, inversePatches] = produceWithPatches(stateRef.current, recipe);
        if (patches.length === 0) return;
        pushEntry({ kind: 'patch', patches, inversePatches });
        setState(nextState as S);
    }, [pushEntry]);

    const mutate = useCallback((recipe: (draft: Draft<S>) => void) => {
        setState(produce(stateRef.current, recipe) as S);
    }, []);

    // Records a history entry from a saved baseline to the current state (for resize commits).
    const recordFromBaseline = useCallback((before: S) => {
        if (before === stateRef.current) return;
        pushEntry({ kind: 'snapshot', before, after: stateRef.current });
    }, [pushEntry]);

    const undo = useCallback(() => {
        const history = historyRef.current;
        if (history.length === 0) return;
        const entry = history[history.length - 1];
        historyRef.current = history.slice(0, -1);
        const prev = entry.kind === 'patch'
            ? (applyPatches(stateRef.current, entry.inversePatches) as S)
            : entry.before;
        futureRef.current = [entry, ...futureRef.current.slice(0, MAX_HISTORY - 1)];
        setState(prev);
        setUndoCount(historyRef.current.length);
        setRedoCount(futureRef.current.length);
    }, []);

    const redo = useCallback(() => {
        const future = futureRef.current;
        if (future.length === 0) return;
        const [entry, ...rest] = future;
        futureRef.current = rest;
        const next = entry.kind === 'patch'
            ? (applyPatches(stateRef.current, entry.patches) as S)
            : entry.after;
        historyRef.current = [...historyRef.current, entry];
        setState(next);
        setUndoCount(historyRef.current.length);
        setRedoCount(futureRef.current.length);
    }, []);

    const clearHistory = useCallback(() => {
        historyRef.current = [];
        futureRef.current = [];
        setUndoCount(0);
        setRedoCount(0);
    }, []);

    return {
        state,
        setState,
        record,
        mutate,
        recordFromBaseline,
        undo,
        redo,
        canUndo: undoCount > 0,
        canRedo: redoCount > 0,
        clearHistory,
    };
}
