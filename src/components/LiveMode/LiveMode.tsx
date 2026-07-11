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
import { PlusIcon } from 'lucide-react';
import { useOracleCards } from '@/hooks/useOracleCards';
import { findOracleCard } from '@/lib/oracleCards';
import { CARD_COLOR_ORDER, getCardColorKey } from '@/lib/cardColors';
import { getManaValue } from '@/lib/manaCost';
import type { Decklist } from '@/components/types/player';
import { loadLiveModeConfig, type LiveMessage, LIVE_PROJECT_KEY } from '@/lib/liveMode';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { Button } from '@/components/ui/button';
import { LibraryPanel, type LibraryCardInstance } from './LibraryPanel';
import { PlayerHand } from './PlayerHand';
import { PlayerState } from './PlayerState';
import { Annotation } from './Annotation';
import { CardChip } from './CardChip';

type Side = 'left' | 'right';
type AnnotationZone = 'graveyard' | 'topDeck';

const ANNOTATION_DROP_ID: Record<AnnotationZone, (side: Side) => string> = {
    graveyard: (side) => `annotation-graveyard-${side}`,
    topDeck: (side) => `annotation-top-deck-${side}`,
};

interface SideState {
    name: string;
    deckName: string;
    life: number;
    decklist: Decklist | null;
    library: LibraryCardInstance[];
    hand: LibraryCardInstance[];
    graveyard: LibraryCardInstance[];
    topDeck: LibraryCardInstance[];
}

function makeId() {
    return Math.random().toString(36).slice(2);
}

function emptySide(side: Side): SideState {
    return {
        name: side === 'left' ? 'Player 1' : 'Player 2',
        deckName: '',
        life: 20,
        decklist: null,
        library: [],
        hand: [],
        graveyard: [],
        topDeck: [],
    };
}

function loadLiveProject(): Record<Side, SideState> | null {
    try {
        const raw = localStorage.getItem(LIVE_PROJECT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<Side, Partial<SideState>>;
        return {
            left: { ...emptySide('left'), ...parsed.left },
            right: { ...emptySide('right'), ...parsed.right },
        };
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
        () => loadLiveProject() ?? { left: emptySide('left'), right: emptySide('right') },
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
        const [prefix, key, instanceId] = activeId.split(':');
        if (prefix === 'lib') return sides[key as Side].library.find((c) => c.id === instanceId)?.card ?? null;
        if (prefix === 'hand') return sides[key as Side].hand.find((c) => c.id === instanceId)?.card ?? null;
        if (prefix === 'annotation') {
            const side: Side = key.endsWith('-left') ? 'left' : 'right';
            const zone: AnnotationZone = key.startsWith('graveyard') ? 'graveyard' : 'topDeck';
            return sides[side][zone].find((c) => c.id === instanceId)?.card ?? null;
        }
        return null;
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
        setSides((prev) => ({ ...prev, [side]: { ...prev[side], decklist, library, hand: [] } }));
    };

    const handleDragEnd = (e: DragEndEvent) => {
        setActiveId(null);
        setActiveWidth(null);
        const { active, over } = e;
        if (!over) return;

        const [prefix, sideStr, instanceId] = String(active.id).split(':');
        const s = sideStr as Side;

        if (prefix === 'lib') {
            const entry = sides[s].library.find((c) => c.id === instanceId);
            if (!entry) return;

            if (over.id === `hand-${sideStr}`) {
                const newHand = [...sides[s].hand, { id: makeId(), card: entry.card }];
                setSides((prev) => ({ ...prev, [s]: { ...prev[s], hand: newHand } }));
                broadcastHand(s, newHand);
                return;
            }

            for (const zone of Object.keys(ANNOTATION_DROP_ID) as AnnotationZone[]) {
                if (over.id === ANNOTATION_DROP_ID[zone](s)) {
                    const newZone = [...sides[s][zone], { id: makeId(), card: entry.card }];
                    setSides((prev) => ({ ...prev, [s]: { ...prev[s], [zone]: newZone } }));
                    return;
                }
            }
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

    const handleClearAnnotation = (side: Side, zone: AnnotationZone) => {
        setSides((prev) => ({ ...prev, [side]: { ...prev[side], [zone]: [] } }));
    };

    const handleUpdateSide = (side: Side, patch: Partial<Pick<SideState, 'name' | 'deckName' | 'life'>>) => {
        setSides((prev) => ({ ...prev, [side]: { ...prev[side], ...patch } }));
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
                <div className="flex flex-col min-h-0 gap-2 rounded-lg border p-2">
                    <p className="text-sm font-medium">Player Control</p>
                    <PlayerState
                        name={sides.left.name}
                        deckName={sides.left.deckName}
                        life={sides.left.life}
                        onChangeName={(name) => handleUpdateSide('left', { name })}
                        onChangeDeckName={(deckName) => handleUpdateSide('left', { deckName })}
                        onLifeChange={(life) => handleUpdateSide('left', { life })}
                    />
                    <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                        <PlayerHand side="left" cards={sides.left.hand} onClear={() => handleClearHand('left')} />
                        <div className="flex flex-col gap-2 min-h-0">
                            <div className="flex flex-1 min-h-24 items-center justify-center rounded-lg border p-2 text-xs text-muted-foreground">
                                Card display
                            </div>
                            <Annotation
                                id="graveyard-left"
                                title="Graveyard"
                                cards={sides.left.graveyard}
                                onClear={() => handleClearAnnotation('left', 'graveyard')}
                            />
                            <Annotation
                                id="top-deck-left"
                                title="Top Deck"
                                cards={sides.left.topDeck}
                                onClear={() => handleClearAnnotation('left', 'topDeck')}
                            />
                            <Button variant="outline" size="sm" className="cursor-pointer">
                                <PlusIcon />
                                Create annotation
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col min-h-0 gap-2 rounded-lg border p-2">
                    <p className="text-sm font-medium">Player Control</p>
                    <PlayerState
                        name={sides.right.name}
                        deckName={sides.right.deckName}
                        life={sides.right.life}
                        onChangeName={(name) => handleUpdateSide('right', { name })}
                        onChangeDeckName={(deckName) => handleUpdateSide('right', { deckName })}
                        onLifeChange={(life) => handleUpdateSide('right', { life })}
                    />
                    <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                        <div className="flex flex-col gap-2 min-h-0">
                            <div className="flex flex-1 min-h-24 items-center justify-center rounded-lg border p-2 text-xs text-muted-foreground">
                                Card display
                            </div>
                            <Annotation
                                id="graveyard-right"
                                title="Graveyard"
                                cards={sides.right.graveyard}
                                onClear={() => handleClearAnnotation('right', 'graveyard')}
                            />
                            <Annotation
                                id="top-deck-right"
                                title="Top Deck"
                                cards={sides.right.topDeck}
                                onClear={() => handleClearAnnotation('right', 'topDeck')}
                            />
                            <Button variant="outline" size="sm" className="cursor-pointer">
                                <PlusIcon />
                                Create annotation
                            </Button>
                        </div>
                        <PlayerHand side="right" cards={sides.right.hand} onClear={() => handleClearHand('right')} />
                    </div>
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
