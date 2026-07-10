/*
import { useState } from 'react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import { useOracleCards } from '@/hooks/useOracleCards';
import type { OracleCard } from '@/lib/oracleCards';
import { DraggableCard } from './DraggableCard';
import {
    Combobox,
    ComboboxInput,
    ComboboxContent,
    ComboboxList,
    ComboboxItem,
} from '@/components/ui/combobox';

const STATUS_LABEL: Record<string, string> = {
    idle: 'Loading card database...',
    checking: 'Checking card database...',
    downloading: 'Downloading card database...',
    storing: 'Storing card database...',
    error: 'Failed to load card database',
};

function makeId() {
    return Math.random().toString(36).slice(2);
}

function LiveMode() {
    const { status, search } = useOracleCards();
    const [query, setQuery] = useState('');
    const [comboKey, setComboKey] = useState(0);
    const [cards, setCards] = useState<Array<{ id: string; card: OracleCard }>>([]);
    const sensors = useSensors(useSensor(PointerSensor));

    const results = status === 'ready' ? search(query) : [];

    const handleDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        setCards((prev) => {
            const from = prev.findIndex((c) => c.id === active.id);
            const to = prev.findIndex((c) => c.id === over.id);
            if (from === -1 || to === -1) return prev;
            return arrayMove(prev, from, to);
        });
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            {status !== 'ready' && (
                <p className="text-sm text-muted-foreground">{STATUS_LABEL[status]}</p>
            )}

            <Combobox<OracleCard, false>
                key={comboKey}
                items={results}
                itemToStringLabel={(card) => card.name}
                filter={() => true}
                autoHighlight="always"
                onInputValueChange={(val, details) => {
                    if (details.reason === 'input-change') setQuery(val);
                }}
                onValueChange={(card) => {
                    if (!card) return;
                    setCards((prev) => [...prev, { id: makeId(), card }]);
                    setQuery('');
                    setComboKey((k) => k + 1);
                }}
            >
                <ComboboxInput
                    placeholder="Search cards…"
                    className="h-8 w-72"
                    disabled={status !== 'ready'}
                />
                <ComboboxContent>
                    <ComboboxList>
                        {results.map((card) => (
                            <ComboboxItem key={card.name} value={card}>
                                {card.name}
                                {card.mana_cost && (
                                    <span className="ml-auto pl-2 text-xs text-muted-foreground">
                                        {card.mana_cost}
                                    </span>
                                )}
                            </ComboboxItem>
                        ))}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex w-72 flex-col gap-1 rounded-xl border p-2">
                        {cards.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">No cards in hand</p>
                        ) : (
                            cards.map(({ id, card }) => (
                                <DraggableCard key={id} id={id} card={card} />
                            ))
                        )}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { useOracleCards } from '@/hooks/useOracleCards';
import { findOracleCard } from '@/lib/oracleCards';
import { CARD_COLOR_ORDER, getCardColorKey } from '@/lib/cardColors';
import { getManaValue } from '@/lib/manaCost';
import type { Decklist } from '@/components/types/player';
import { loadLiveModeConfig, type LiveMessage, LIVE_PROJECT_KEY } from '@/lib/liveMode';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { LibraryPanel, type LibraryCardInstance } from './LibraryPanel';
import { PlayerHand } from './PlayerHand';
import { CardChip } from './CardChip';

type Side = 'left' | 'right';

interface SideState {
    decklist: Decklist | null;
    library: LibraryCardInstance[];
    hand: LibraryCardInstance[];
}

function makeId() {
    return Math.random().toString(36).slice(2);
}

function emptySide(): SideState {
    return { decklist: null, library: [], hand: [] };
}

function loadLiveProject(): Record<Side, SideState> | null {
    try {
        const raw = localStorage.getItem(LIVE_PROJECT_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as Record<Side, SideState>;
    } catch {
        return null;
    }
}

function saveLiveProject(sides: Record<Side, SideState>) {
    localStorage.setItem(LIVE_PROJECT_KEY, JSON.stringify(sides));
}

function LiveMode() {
    const { status } = useOracleCards();
    const sensors = useSensors(useSensor(PointerSensor));
    const [sides, setSides] = useState<Record<Side, SideState>>(
        () => loadLiveProject() ?? { left: emptySide(), right: emptySide() },
    );
    useEffect(() => {
        saveLiveProject(sides);
    }, [sides]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeWidth, setActiveWidth] = useState<number | null>(null);

    const [config] = useState(() => loadLiveModeConfig());
    const sendRef = useRef<(msg: LiveMessage) => void>(() => {});

    const handleSocketMessage = (msg: LiveMessage) => {
        if (msg.type === 'request-state') {
            sendRef.current({
                type: 'live-state',
                state: { left: sides.left.hand, right: sides.right.hand },
            });
        }
    };

    const { send } = useLiveModeSocket(config?.websocketUrl ?? null, handleSocketMessage);
    useEffect(() => {
        sendRef.current = send;
    }, [send]);

    const broadcastHand = (side: Side, hand: LibraryCardInstance[]) => {
        sendRef.current({
            type: 'live-state',
            state: {
                left: side === 'left' ? hand : sides.left.hand,
                right: side === 'right' ? hand : sides.right.hand,
            },
        });
    };

    const activeCard = useMemo(() => {
        if (!activeId) return null;
        const [prefix, side, instanceId] = activeId.split(':');
        const pool = prefix === 'lib' ? sides[side as Side].library : sides[side as Side].hand;
        return pool.find((c) => c.id === instanceId)?.card ?? null;
    }, [activeId, sides]);

    const handleDragStart = (e: DragStartEvent) => {
        setActiveId(String(e.active.id));
        setActiveWidth(e.active.rect.current.initial?.width ?? null);
    };

    const handleImport = (side: Side, decklist: Decklist) => {
        const seen = new Set<string>();
        const library: LibraryCardInstance[] = [];
        for (const { card } of decklist.maindeck) {
            if (seen.has(card.name)) continue;
            const oracleCard = findOracleCard(card.name);
            if (!oracleCard) continue;
            seen.add(card.name);
            library.push({ id: makeId(), card: oracleCard });
        }
        library.sort((a, b) => {
            const colorDiff = CARD_COLOR_ORDER[getCardColorKey(a.card.colors)] - CARD_COLOR_ORDER[getCardColorKey(b.card.colors)];
            if (colorDiff !== 0) return colorDiff;
            return getManaValue(a.card.mana_cost) - getManaValue(b.card.mana_cost);
        });
        setSides((prev) => ({ ...prev, [side]: { decklist, library, hand: [] } }));
    };

    const handleDragEnd = (e: DragEndEvent) => {
        setActiveId(null);
        setActiveWidth(null);
        const { active, over } = e;
        if (!over) return;

        const [prefix, sideStr, instanceId] = String(active.id).split(':');
        const s = sideStr as Side;

        if (prefix === 'lib' && over.id === `hand-${sideStr}`) {
            const entry = sides[s].library.find((c) => c.id === instanceId);
            if (!entry) return;
            const newHand = [...sides[s].hand, { id: makeId(), card: entry.card }];
            setSides((prev) => ({ ...prev, [s]: { ...prev[s], hand: newHand } }));
            broadcastHand(s, newHand);
            return;
        }

        if (prefix === 'hand' && over.id === `lib-${sideStr}`) {
            const newHand = sides[s].hand.filter((c) => c.id !== instanceId);
            setSides((prev) => ({ ...prev, [s]: { ...prev[s], hand: newHand } }));
            broadcastHand(s, newHand);
        }
    };

    const handleClearHand = (side: Side) => {
        setSides((prev) => ({ ...prev, [side]: { ...prev[side], hand: [] } }));
        broadcastHand(side, []);
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => { setActiveId(null); setActiveWidth(null); }}
        >
            <div className="flex-1 min-h-0 grid grid-cols-[1fr_2fr_2fr_1fr] p-2 gap-2">
                <div className="flex flex-col min-h-0 overflow-hidden">
                    <LibraryPanel
                        side="left"
                        decklist={sides.left.decklist}
                        library={sides.left.library}
                        ready={status === 'ready'}
                        onImport={(d) => handleImport('left', d)}
                    />
                </div>
                <div className="flex flex-col min-h-0">
                    <PlayerHand side="left" cards={sides.left.hand} onClear={() => handleClearHand('left')} />
                </div>
                <div className="flex flex-col min-h-0">
                    <PlayerHand side="right" cards={sides.right.hand} onClear={() => handleClearHand('right')} />
                </div>
                <div className="flex flex-col min-h-0 overflow-hidden">
                    <LibraryPanel
                        side="right"
                        decklist={sides.right.decklist}
                        library={sides.right.library}
                        ready={status === 'ready'}
                        onImport={(d) => handleImport('right', d)}
                    />
                </div>
            </div>

            <DragOverlay>
                {activeCard ? (
                    <CardChip
                        card={activeCard}
                        className="shadow-lg"
                        style={activeWidth ? { width: activeWidth } : undefined}
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

export default LiveMode;
