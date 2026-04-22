import { useQuery } from '@tanstack/react-query';

export interface Printing {
    set: string;
    set_name: string;
    collector_number: string;
}

export function useCardPrintings(name: string) {
    return useQuery({
        queryKey: ['printings', name],
        queryFn: async () => {
            const res = await fetch(
                `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(name)}"&unique=prints&order=released`
            );
            const json = await res.json();
            const data = json.data as Printing[];
            const seen = new Set<string>();
            return data.filter((p) => {
                if (seen.has(p.set)) return false;
                seen.add(p.set);
                return true;
            });
        },
        enabled: name.length > 0,
        staleTime: Infinity,
    });
}
