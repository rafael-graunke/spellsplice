// Mirrors the subset of node_modules/mana-font/css/mana.css needed to draw
// mana pips on canvas (mana-font's ::before/::after content + .ms-cost colors).
const CODEPOINTS: Record<string, string> = {
    '0': 'e605', '1': 'e606', '2': 'e607', '3': 'e608', '4': 'e609',
    '5': 'e60a', '6': 'e60b', '7': 'e60c', '8': 'e60d', '9': 'e60e',
    '10': 'e60f', '11': 'e610', '12': 'e611', '13': 'e612', '14': 'e613',
    '15': 'e614', '16': 'e62a', '17': 'e62b', '18': 'e62c', '19': 'e62d', '20': 'e62e',
    '100': 'e900', '1000000': 'e901',
    w: 'e600', u: 'e601', b: 'e602', r: 'e603', g: 'e604',
    x: 'e615', y: 'e616', z: 'e617', s: 'e619', c: 'e904',
    wu: 'e600', wb: 'e600', ub: 'e601', ur: 'e601', br: 'e602', bg: 'e602',
    rw: 'e603', rg: 'e603', gw: 'e604', gu: 'e604',
    '2w': 'e607', '2u': 'e607', '2b': 'e607', '2r': 'e607', '2g': 'e607',
    cw: 'e904', cu: 'e904', cb: 'e904', cr: 'e904', cg: 'e904',
    wp: 'e618', up: 'e618', bp: 'e618', rp: 'e618', gp: 'e618',
    wup: 'e618', wbp: 'e618', ubp: 'e618', urp: 'e618', brp: 'e618',
    bgp: 'e618', rwp: 'e618', rgp: 'e618', gwp: 'e618', gup: 'e618',
};

const SOLID_COLOR: Record<string, string> = {
    w: '#f0f2c0', u: '#b5cde3', b: '#aca29a', r: '#db8664', g: '#93b483',
    wp: '#f0f2c0', up: '#b5cde3', bp: '#aca29a', rp: '#db8664', gp: '#93b483',
};
const GENERIC_SOLID = '#beb9b2';

type SplitColor = 'w' | 'u' | 'b' | 'r' | 'g' | 'c';
const SPLIT_HEX: Record<SplitColor, string> = {
    w: '#fdfbce', u: '#bcdaf7', b: '#a7999e', r: '#f19b79', g: '#9fcba6', c: '#d0c6bb',
};

const SPLIT_PAIRS: Record<string, [SplitColor, SplitColor]> = {
    wu: ['w', 'u'], wb: ['w', 'b'], ub: ['u', 'b'], ur: ['u', 'r'], br: ['b', 'r'],
    bg: ['b', 'g'], rw: ['r', 'w'], rg: ['r', 'g'], gw: ['g', 'w'], gu: ['g', 'u'],
    '2w': ['c', 'w'], '2u': ['c', 'u'], '2b': ['c', 'b'], '2r': ['c', 'r'], '2g': ['c', 'g'],
    cw: ['c', 'w'], cu: ['c', 'u'], cb: ['c', 'b'], cr: ['c', 'r'], cg: ['c', 'g'],
    wup: ['w', 'u'], wbp: ['w', 'b'], ubp: ['u', 'b'], urp: ['u', 'r'], brp: ['b', 'r'],
    bgp: ['b', 'g'], rwp: ['r', 'w'], rgp: ['r', 'g'], gwp: ['g', 'w'], gup: ['g', 'u'],
};

const GLYPH_COLOR = '#111111';

export interface ManaPip {
    glyph: string | null;
    fill: string;
    split?: string;
}

let fontLoadTriggered = false;
export function ensureManaFontLoaded(): void {
    if (fontLoadTriggered || typeof document === 'undefined') return;
    fontLoadTriggered = true;
    document.fonts?.load('16px Mana').catch(() => {});
}

export function manaCostToPips(manaCost: string): ManaPip[] {
    const symbols = manaCost.match(/\{([^}]+)\}/g) ?? [];
    return symbols.map((s) => {
        const token = s.slice(1, -1).toLowerCase().replace('/', '');
        const codepoint = CODEPOINTS[token];
        const glyph = codepoint ? String.fromCodePoint(parseInt(codepoint, 16)) : null;
        const pair = SPLIT_PAIRS[token];
        if (pair) {
            return { glyph, fill: SPLIT_HEX[pair[0]], split: SPLIT_HEX[pair[1]] };
        }
        return { glyph, fill: SOLID_COLOR[token] ?? GENERIC_SOLID };
    });
}

export function drawManaPip(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    pip: ManaPip,
): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    if (pip.split) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = pip.fill;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.beginPath();
        ctx.moveTo(cx - radius, cy + radius);
        ctx.lineTo(cx + radius, cy + radius);
        ctx.lineTo(cx + radius, cy - radius);
        ctx.closePath();
        ctx.fillStyle = pip.split;
        ctx.fill();
        ctx.restore();
    } else {
        ctx.fillStyle = pip.fill;
        ctx.fill();
    }
    if (pip.glyph) {
        ctx.fillStyle = GLYPH_COLOR;
        ctx.font = `${Math.round(radius * 1.15)}px Mana`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pip.glyph, cx, cy + radius * 0.05);
    }
    ctx.restore();
}

export function drawManaCostRow(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    manaCost: string,
    rightX: number,
    cy: number,
    radius: number,
): void {
    const pips = manaCostToPips(manaCost);
    const step = radius * 2 + 3;
    let cx = rightX - radius;
    for (let i = pips.length - 1; i >= 0; i--) {
        drawManaPip(ctx, cx, cy, radius, pips[i]);
        cx -= step;
    }
}
