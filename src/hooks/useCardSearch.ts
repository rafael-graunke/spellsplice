import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@uidotdev/usehooks';

export function useCardSearch(query: string) {
    const debouncedQuery = useDebounce(query, 500);
    return useQuery({
        queryKey: ['cards', debouncedQuery],
        queryFn: async () => {
            const res = await fetch(
                `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(debouncedQuery)}`
            );
            const json = await res.json();
            return json.data as string[];
        },
        enabled: debouncedQuery.length > 1,
        staleTime: 1000 * 60 * 10,
    });
}
