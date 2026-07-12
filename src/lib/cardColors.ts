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
