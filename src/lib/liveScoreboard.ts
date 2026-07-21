import type { LivePlayerInfo, ScoreboardFieldMapping } from './liveMode';

// Comparison operators supported in `data-visible-if`, longest-first so a
// two-char op is matched before its one-char prefix (e.g. '>=' before '>').
const OPS = ['>=', '<=', '==', '!=', '>', '<'] as const;
type Op = (typeof OPS)[number];

function compare(value: number, op: Op, target: number): boolean {
    switch (op) {
        case '>=':
            return value >= target;
        case '<=':
            return value <= target;
        case '>':
            return value > target;
        case '<':
            return value < target;
        case '==':
            return value === target;
        case '!=':
            return value !== target;
    }
}

// Evaluates a `data-visible-if` expression like `wins>=2` or `right.life<=5`.
// The field may be side-prefixed (`left.`/`right.`); otherwise `defaultSide`
// (from the element's `data-side`, else 'left') applies. Malformed or
// non-numeric comparisons yield false (hidden), so a typo fails safe.
function evalVisibility(
    expr: string,
    defaultSide: 'left' | 'right',
    left: LivePlayerInfo,
    right: LivePlayerInfo
): boolean {
    let op: Op | null = null;
    let idx = -1;
    for (const candidate of OPS) {
        const at = expr.indexOf(candidate);
        if (at >= 0) {
            op = candidate;
            idx = at;
            break;
        }
    }
    if (!op) return true; // no operator: treat as always-visible

    let field = expr.slice(0, idx).trim();
    const target = Number(expr.slice(idx + op.length).trim());
    if (!Number.isFinite(target)) return false;

    let side = defaultSide;
    const dot = field.indexOf('.');
    if (dot >= 0) {
        const prefix = field.slice(0, dot);
        if (prefix === 'left' || prefix === 'right') side = prefix;
        field = field.slice(dot + 1);
    }

    const info = side === 'right' ? right : left;
    const value = Number((info as unknown as Record<string, unknown>)[field]);
    if (!Number.isFinite(value)) return false;
    return compare(value, op, target);
}

// Sets or deletes inline style properties by editing the element's `style`
// attribute string directly. Deliberately avoids the `.style` CSSStyleDeclaration:
// on elements from a DOMParser XML document (`image/svg+xml`) it can be absent or
// not reflect back through XMLSerializer, whereas the attribute always does.
function patchStyle(el: Element, props: Record<string, string | null>): void {
    const decls = new Map<string, string>();
    for (const part of (el.getAttribute('style') ?? '').split(';')) {
        const colon = part.indexOf(':');
        if (colon < 0) continue;
        const key = part.slice(0, colon).trim();
        if (key) decls.set(key, part.slice(colon + 1).trim());
    }
    for (const [key, value] of Object.entries(props)) {
        if (value === null) decls.delete(key);
        else decls.set(key, value);
    }
    if (decls.size === 0) {
        el.removeAttribute('style');
        return;
    }
    el.setAttribute(
        'style',
        [...decls].map(([k, v]) => `${k}: ${v}`).join('; ')
    );
}

// Shows/hides every `[data-visible-if]` element from its condition, letting an
// SVG author reveal parts by player state (e.g. best-of-3 win pips). Runs in
// place on the parsed document.
//
// The condition fully owns the element's visibility, so it must beat any
// authored default. A presentation attribute (`display`) is not enough: an
// inline `style="visibility:hidden"` (a common editor export for "hidden by
// default") outranks it. So drive it through inline style - hide with
// `display:none`, show by clearing that and forcing `visibility:visible` (which
// overrides an authored `visibility:hidden`).
function applyVisibility(
    doc: Document,
    left: LivePlayerInfo,
    right: LivePlayerInfo
): void {
    for (const el of doc.querySelectorAll('[data-visible-if]')) {
        const expr = el.getAttribute('data-visible-if');
        if (expr === null) continue;
        const side = el.getAttribute('data-side') === 'right' ? 'right' : 'left';
        const show = evalVisibility(expr, side, left, right);
        patchStyle(
            el,
            show
                ? { display: null, visibility: 'visible' }
                : { display: 'none' }
        );
    }
}

export function substituteScoreboard(
    svg: string,
    mappings: ScoreboardFieldMapping[],
    left: LivePlayerInfo,
    right: LivePlayerInfo
): string {
    // Nothing to bind and no conditional elements: return the source untouched
    // (skips the DOMParser round-trip entirely).
    if (mappings.length === 0 && !svg.includes('data-visible-if')) return svg;

    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return svg;

    for (const mapping of mappings) {
        const el = doc.getElementById(mapping.id);
        if (!el) continue;
        const info = mapping.side === 'left' ? left : right;
        el.textContent = String(info[mapping.field]);
    }

    applyVisibility(doc, left, right);

    return new XMLSerializer().serializeToString(doc);
}
