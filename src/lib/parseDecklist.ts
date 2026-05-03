import type { Decklist } from '@/components/types/player';
import type { Card } from '@/components/types/card';

// Format per line: `<qty> <name> [(<set>)]`
// A line matching /^sideboard$/i switches all subsequent cards to sideboard.
export function parseDecklist(text: string): Decklist {
    const maindeck: Decklist['maindeck'] = [];
    const sideboard: NonNullable<Decklist['sideboard']> = [];
    let inSideboard = false;

    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        if (/^sideboard$/i.test(line)) { inSideboard = true; continue; }

        const match = line.match(/^(\d+)\s+(.+?)(?:\s+\(([^)]+)\))?$/);
        if (!match) continue;

        const quantity = parseInt(match[1], 10);
        const name = match[2].trim();
        const edition = match[3]?.trim();
        const card: Card = { name, ...(edition && { edition }) };

        (inSideboard ? sideboard : maindeck).push({ card, quantity });
    }

    return { maindeck, ...(sideboard.length > 0 && { sideboard }) };
}
