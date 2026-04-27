import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@uidotdev/usehooks';
import type { Player } from '@/components/types/player';

export function useCardSearch(query: string, player?: Player | null) {
    const debouncedQuery = useDebounce(query.toLowerCase(), 500);

    const localResults = useMemo(() => {
        if (!player) return null;
        const hand = player.cards.map((c) => c.name);
        const deck = [
            ...(player.decklist?.maindeck ?? []),
            ...(player.decklist?.sideboard ?? []),
        ].map((e) => e.card.name);
        const all = [...new Set([...hand, ...deck])];
        if (all.length === 0) return null;
        if (query.length === 0) return all;
        const q = query.toLowerCase();
        const matches = all.filter((n) => n.toLowerCase().includes(q));
        return matches.length > 0 ? matches : null;
    }, [query, player]);

    const scryfallResult = useQuery({
        queryKey: ['cards-autocomplete', debouncedQuery],
        queryFn: async () => {
            const res = await fetch(
                `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(debouncedQuery)}`,
                { headers: { Accept: 'application/json' } }
            );
            const json = await res.json();
            return json.data as string[];
        },
        enabled: localResults === null && query.length > 1 && debouncedQuery.length > 1,
        staleTime: Infinity,
    });

    if (localResults !== null) return { data: localResults, isFetching: false };
    return { data: scryfallResult.data, isFetching: scryfallResult.isFetching };
}
