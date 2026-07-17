import type { CSSProperties } from 'react';

export type CardColorKey = 'C' | 'W' | 'U' | 'B' | 'R' | 'G' | 'M';

export const CARD_COLOR_HEX: Record<CardColorKey, string> = {
    C: '#ccc6c1',
    W: '#f3f4ef',
    U: '#bbd9e8',
    B: '#bcb1b7',
    R: '#f0c8b5',
    G: '#cfd3bd',
    M: '#d3c294',
};

export const CARD_COLOR_BG: Record<CardColorKey, string> = {
    C: 'bg-[#ccc6c1]',
    W: 'bg-[#f3f4ef]',
    U: 'bg-[#bbd9e8]',
    B: 'bg-[#bcb1b7]',
    R: 'bg-[#f0c8b5]',
    G: 'bg-[#cfd3bd]',
    M: 'bg-[#d3c294]',
};

export const CARD_COLOR_BORDER: Record<CardColorKey, string> = {
    C: 'border-[#dbdfe4]',
    W: 'border-[#f8f4e3]',
    U: 'border-[#297fb1]',
    B: 'border-[#7a7470]',
    R: 'border-[#de5b4e]',
    G: 'border-[#98b284]',
    M: 'border-[#dac984]',
};

export const CARD_COLOR_BORDER_HEX: Record<CardColorKey, string> = {
    C: '#dbdfe4',
    W: '#f8f4e3',
    U: '#297fb1',
    B: '#7a7470',
    R: '#de5b4e',
    G: '#98b284',
    M: '#dac984',
};


export function getCardColorKey(colors: string[] | undefined): CardColorKey {
    if (!colors || colors.length === 0) return 'C';
    if (colors.length > 1) return 'M';
    return colors[0] as CardColorKey;
}

const WUBRG_ORDER: Record<string, number> = { W: 0, U: 1, B: 2, R: 3, G: 4 };

// Returns the two mono colors of a two-color card, ordered by the shortest
// clockwise arc around the WUBRG color wheel (W→U→B→R→G→W). Every pair is 1 or 2
// steps apart one way and 3 or 4 the other; we start at whichever color reaches
// the other in the short direction. e.g. R+W → [R, W] (Red→Green→White, 2 steps),
// not White→Blue→Black→Red (3 steps).
// null for anything that isn't exactly two of the five colors (mono, 3+ colors,
// colorless) — those keep their solid CARD_COLOR_* key styling.
export function getTwoColorKeys(colors: string[] | undefined): [CardColorKey, CardColorKey] | null {
    if (!colors || colors.length !== 2) return null;
    const c = colors.filter((x) => x in WUBRG_ORDER);
    if (c.length !== 2) return null;
    const [x, y] = c;
    const d = (WUBRG_ORDER[y] - WUBRG_ORDER[x] + 5) % 5;
    const [a, b] = d <= 2 ? [x, y] : [y, x];
    return [a as CardColorKey, b as CardColorKey];
}

// Inline style for a two-color gradient chip: fill gradient on the padding box,
// border gradient on the border box (respects border-radius). Returns null for
// non-two-color cards, which fall back to solid Tailwind classes.
export function getGradientChipStyle(colors: string[] | undefined): CSSProperties | null {
    const keys = getTwoColorKeys(colors);
    if (!keys) return null;
    const [a, b] = keys;
    // Fill stays solid gold (M); only the border gets the two-color gradient.
    const fill = CARD_COLOR_HEX.M;
    const border = `linear-gradient(135deg, ${CARD_COLOR_BORDER_HEX[a]}, ${CARD_COLOR_BORDER_HEX[b]})`;
    return {
        background: `linear-gradient(${fill}, ${fill}) padding-box, ${border} border-box`,
        borderColor: 'transparent',
    };
}

export const CARD_COLOR_ORDER: Record<CardColorKey, number> = {
    W: 0,
    U: 1,
    B: 2,
    R: 3,
    G: 4,
    M: 5,
    C: 6,
};
