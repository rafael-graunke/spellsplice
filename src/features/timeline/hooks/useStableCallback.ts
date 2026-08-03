import { useCallback, useEffect, useRef } from 'react';

/**
 * Identity-stable wrapper around a callback that closes over changing state.
 *
 * Needed where a memoized child ignores callback identity
 * (`propsEqualIgnoringFunctions`) but the callback would otherwise go stale
 * without any of that child's data props changing. `handlePaste` is the case
 * that forces it: copying a second time changes `copiedItems` while `canPaste`
 * stays true, so the child would keep pasting the first copy.
 *
 * The ref is written after commit, never during render. Handlers only fire from
 * user events, which is always after commit.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R) {
    const ref = useRef(fn);
    useEffect(() => {
        ref.current = fn;
    });
    return useCallback((...args: A) => ref.current(...args), []);
}
