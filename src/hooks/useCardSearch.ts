import { useMemo } from 'react';
import { searchOracleCards } from '@/lib/oracleCards';
import type { Player } from '@/components/types/player';

export function useCardSearch(query: string, player?: Player | null) {
    // Local-first: the player's own hand + decklist, so their cards rank ahead
    // of the full database. Falls back to the offline bulk (instant, no debounce
    // and no network) when the query matches nothing they own.
    const data = useMemo(() => {
        const q = query.toLowerCase();

        if (player) {
            const hand = player.cards.map((c) => c.name);
            const deck = [
                ...(player.decklist?.maindeck ?? []),
                ...(player.decklist?.sideboard ?? []),
            ].map((e) => e.card.name);
            const all = [...new Set([...hand, ...deck])];
            if (all.length > 0) {
                if (query.length === 0) return all;
                const matches = all.filter((n) => n.toLowerCase().includes(q));
                if (matches.length > 0) return matches;
            }
        }

        if (query.length <= 1) return [];
        return searchOracleCards(query).map((c) => c.name);
    }, [query, player]);

    return { data, isFetching: false };
}
