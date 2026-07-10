import { useEffect, useRef, useState } from 'react';
import { ensureOracleCards, searchOracleCards, type OracleCardsStatus } from '@/lib/oracleCards';

export function useOracleCards() {
    const [status, setStatus] = useState<OracleCardsStatus>('idle');
    const startedRef = useRef(false);

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        ensureOracleCards(setStatus).catch(() => {});
    }, []);

    return { status, search: searchOracleCards };
}
