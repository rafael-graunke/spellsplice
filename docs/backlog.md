# Backlog

## Performance

### Zoom: eliminate TimelineEvent re-renders via CSS variable

**Problem:** Every zoom change re-renders all `TimelineEvent` components (200 events × 4 layers = 800 re-renders). Each event computes `left: time * zoom` and `width: duration * zoom` as inline styles, so zoom in the memo comparator forces a re-render.

**Fix:** Replace inline `zoom`-multiplied styles with CSS custom property `--zoom` on the track container, updated directly via DOM (bypassing React). Events use `calc(${time} * var(--zoom))` — browser handles recalculation with no React re-renders.

**Scope:**
- `Timeline.tsx` or `TimelineTrack.tsx` — `useLayoutEffect` to set `--zoom` on track DOM node
- `TimelineTrack.tsx` — remove `zoom` prop, derive track width via CSS var
- `TimelineEvent.tsx` — remove `zoom` prop, use CSS vars for positioning; switch resize drag to read zoom from a ref instead of props
- `TimelineEventIcon.tsx` — check if zoom used for positioning

**Impact:** Eliminates ~800 re-renders per zoom gesture. Lower priority than cursor-drag/playback fixes (zoom is manual, not continuous).
