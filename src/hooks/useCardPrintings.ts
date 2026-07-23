import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { slowFetch } from '@/lib/scryfallQueue';
import { getPrintings } from '@/lib/oracleCards';

export interface Printing {
    set: string;
    set_name: string;
    collector_number: string;
    image_uris: { normal?: string; border_crop?: string };
    card_faces?: Array<{ image_uris?: { normal?: string; border_crop?: string } }>;
    frame?: string;
    layout?: string;
}

interface ScryfallList {
    data: Printing[];
    has_more: boolean;
    next_page?: string;
}

// Fallback for cards missing from the local bulk (e.g. a set newer than the
// cached copy): walk every page of the Scryfall prints search.
async function fetchFromScryfall(name: string): Promise<Printing[]> {
    const out: Printing[] = [];
    let url: string | undefined =
        `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(name)}"&unique=prints&order=released`;
    while (url) {
        const res = await slowFetch(url);
        if (!res.ok) break;
        const page = (await res.json()) as ScryfallList;
        out.push(...page.data);
        url = page.has_more ? page.next_page : undefined;
    }
    return out;
}

export function useCardPrintings(name: string) {
    const query = useQuery({
        queryKey: ['printings', name],
        queryFn: async (): Promise<Printing[]> => {
            const local = await getPrintings(name);
            if (local.length > 0) {
                return local.map((c) => ({
                    set: c.edition ?? '',
                    set_name: c.set_name ?? c.edition ?? '',
                    collector_number: c.cn ?? '',
                    image_uris: {
                        normal: c.image_uris?.normal,
                        border_crop: c.image_uris?.border_crop,
                    },
                    frame: c.frame,
                    layout: c.layout,
                }));
            }
            return fetchFromScryfall(name);
        },
        enabled: name.length > 0,
        staleTime: Infinity,
    });

    const printings = useMemo(
        () =>
            (query.data ?? []).map((c) => ({
                ...c,
                image_uris: c.image_uris ?? c.card_faces?.[0]?.image_uris ?? {},
            })),
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

    return {
        printings,
        editionKey,
        totalCards: printings.length,
        loadedCount: printings.length,
        isStreaming: false,
        isFetching: query.isFetching,
    };
}
