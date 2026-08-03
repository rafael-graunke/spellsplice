/**
 * `React.memo` comparator that compares every prop except the identity of
 * function props.
 *
 * The timeline re-renders on every mousemove of a drag (the ghost maps are
 * component state), and each render rebuilds the inline arrows passed to every
 * track. A shallow compare therefore never skips anything, so dragging one clip
 * reconciled every track, header icon included.
 *
 * Generic over the key set rather than an explicit prop list, so a new data prop
 * is covered automatically instead of silently defeating the memo.
 *
 * **Safe only while function props are free of stale state.** Two rules keep
 * that true here:
 * - Handlers closing over changing state must be ref-backed (see `stableRef` in
 *   Timeline.tsx for `handleCopy` / `handlePaste`).
 * - Handlers derived from `trackGroups` are fine, because the `track` prop comes
 *   from `trackGroups` too: if the closure goes stale, `track` changed with it
 *   and forces the re-render anyway.
 *
 * A function becoming `undefined` (or vice versa) IS a change: switching tools
 * toggles `onTrimStart`/`onRazorCut` that way, and the track must re-render.
 */
export function propsEqualIgnoringFunctions<P extends object>(prev: P, next: P): boolean {
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const key of keys) {
        const a = (prev as Record<string, unknown>)[key];
        const b = (next as Record<string, unknown>)[key];
        if (typeof a === 'function' && typeof b === 'function') continue;
        if (!Object.is(a, b)) return false;
    }
    return true;
}
