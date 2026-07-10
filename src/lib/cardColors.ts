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

export const CARD_COLOR_BG: Record<CardColorKey, string> = Object.fromEntries(
    Object.entries(CARD_COLOR_HEX).map(([key, hex]) => [key, `bg-[${hex}]`]),
) as Record<CardColorKey, string>;

export function getCardColorKey(colors: string[] | undefined): CardColorKey {
    if (!colors || colors.length === 0) return 'C';
    if (colors.length > 1) return 'M';
    return colors[0] as CardColorKey;
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
