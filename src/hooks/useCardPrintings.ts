import { useCallback, useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { slowFetch } from '@/lib/scryfallQueue';

export interface Printing {
    set: string;
    set_name: string;
    collector_number: string;
    image_uris: { normal: string; border_crop?: string };
    frame?: string;
}

interface ScryfallList {
    data: Printing[];
    has_more: boolean;
    next_page?: string;
    total_cards?: number;
}

export function useCardPrintings(name: string) {
    const query = useInfiniteQuery({
        queryKey: ['printings', name],
        queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
            const url =
                pageParam ??
                `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(name)}"&unique=prints&order=released`;
            const res = await slowFetch(url);
            return res.json() as Promise<ScryfallList>;
        },
        getNextPageParam: (last) => (last.has_more ? last.next_page : undefined),
        initialPageParam: undefined as string | undefined,
        enabled: name.length > 0,
        staleTime: Infinity,
    });

    useEffect(() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
        }
    }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage]);

    const printings = useMemo(
        () => (query.data?.pages ?? []).flatMap((p) => p.data),
        [query.data],
    );

    // Sets that appear more than once need collector_number to disambiguate.
    const setCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const p of printings) counts.set(p.set, (counts.get(p.set) ?? 0) + 1);
        return counts;
    }, [printings]);

    const editionKey = useCallback(
        (p: Printing) =>
            (setCounts.get(p.set) ?? 0) > 1 ? `${p.set}#${p.collector_number}` : p.set,
        [setCounts],
    );

    const totalCards = query.data?.pages[0]?.total_cards;
    const isStreaming = query.hasNextPage || query.isFetchingNextPage;

    return {
        printings,
        editionKey,
        totalCards,
        loadedCount: printings.length,
        isStreaming,
        isFetching: query.isFetching,
    };
}
