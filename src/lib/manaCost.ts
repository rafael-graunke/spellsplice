export function manaCostToClasses(manaCost: string): string[] {
    const symbols = manaCost.match(/\{([^}]+)\}/g) ?? [];
    return symbols.map((s) => {
        const token = s.slice(1, -1).toLowerCase().replace('/', '');
        return `ms ms-${token} ms-cost`;
    });
}

export function getManaValue(manaCost?: string): number {
    if (!manaCost) return 0;
    const symbols = manaCost.match(/\{([^}]+)\}/g) ?? [];
    let total = 0;
    for (const s of symbols) {
        const token = s.slice(1, -1).toUpperCase();
        if (token === 'X' || token === 'Y' || token === 'Z') continue;
        const numMatch = token.match(/\d+/);
        total += numMatch ? parseInt(numMatch[0], 10) : 1;
    }
    return total;
}
