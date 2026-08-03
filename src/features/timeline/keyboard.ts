/** Keys a focused control activates on, and therefore must not share. */
const ACTIVATION_KEYS = new Set([' ', 'Spacebar', 'Enter']);

const FOCUSABLE_CONTROLS =
    'button, select, a[href], [role="button"], [role="combobox"], [role="menuitem"]';

/**
 * Whether a global shortcut should stand down for this event.
 *
 * Text entry swallows everything. A focused *control* is narrower: a button
 * only consumes Space and Enter, so treating it as a blanket typing target
 * meant clicking a toolbar button silently disabled every single-letter
 * shortcut until focus moved elsewhere. Pass `key` to get that distinction;
 * omitting it keeps the conservative behaviour.
 *
 * An open dialog traps focus, so `closest` catches it precisely — a global
 * `querySelector('[role="dialog"]')` would also match unrelated popovers
 * mounted elsewhere in the app.
 */
export function isTypingTarget(target: EventTarget | null, key?: string): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return true;
    if (el.closest?.('[role="dialog"]')) return true;
    if (el.closest?.(FOCUSABLE_CONTROLS)) return key === undefined || ACTIVATION_KEYS.has(key);
    return false;
}
