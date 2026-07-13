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
import {
    loadLiveModeConfig,
    loadLiveTemplateState,
    type LiveMessage,
    type LivePlayerInfo,
    LIVE_PROJECT_KEY,
} from '@/lib/liveMode';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { LibraryPanel, type LibraryCardInstance } from './LibraryPanel';
import { PlayerHand } from './PlayerHand';
import { PlayerState } from './PlayerState';
import { Annotation } from './Annotation';
import { CardChip } from './CardChip';
import { CardDisplay } from './CardDisplay';

type Side = 'left' | 'right';
type Zone = 'hand' | 'graveyard' | 'topDeck';
type AnnotationZone = Exclude<Zone, 'hand'>;

const ZONE_DROP_ID: Record<Zone, (side: Side) => string> = {
    hand: (side) => `hand-${side}`,
    graveyard: (side) => `annotation-graveyard-${side}`,
    topDeck: (side) => `annotation-top-deck-${side}`,
};
const ZONES = Object.keys(ZONE_DROP_ID) as Zone[];
const ANNOTATION_ZONES = ZONES.filter((z): z is AnnotationZone => z !== 'hand');
const CARD_DISPLAY_DROP_ID = (side: Side) => `card-display-${side}`;

// Optional per-zone override for the title broadcast to the overlay; falls
// back to the humanized field name (e.g. "topDeck" -> "Top Deck") when unset.
const ZONE_DESCRIPTION: Partial<Record<AnnotationZone, string>> = {};

function humanizeFieldName(field: string): string {
    return field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

interface SideState {
    name: string;
    deckName: string;
    life: number;
    wins: number;
    decklist: Decklist | null;
    library: LibraryCardInstance[];
    hand: LibraryCardInstance[];
    graveyard: LibraryCardInstance[];
    topDeck: LibraryCardInstance[];
    displayCard: LibraryCardInstance | null;
}

function makeId() {
    return Math.random().toString(36).slice(2);
}

function emptySide(side: Side): SideState {
    return {
        name: side === 'left' ? 'Player 1' : 'Player 2',
        deckName: '',
        life: 20,
        wins: 0,
        decklist: null,
        library: [],
        hand: [],
        graveyard: [],
        topDeck: [],
        displayCard: null,
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
    const [skipDropAnimation, setSkipDropAnimation] = useState(false);

    const [config] = useState(() => loadLiveModeConfig());
    const sendRef = useRef<(msg: LiveMessage) => void>(() => {});

    const playerInfo = (side: Side): LivePlayerInfo => ({
        name: sides[side].name,
        deckName: sides[side].deckName,
        life: sides[side].life,
        wins: sides[side].wins,
    });

    const handleSocketMessage = (msg: LiveMessage) => {
        if (msg.type === 'request-state') {
            sendRef.current({
                type: 'live-state',
                state: { left: sides.left.hand, right: sides.right.hand },
            });
            for (const zone of ANNOTATION_ZONES) {
                sendRef.current({
                    type: 'annotation-state',
                    annotationId: zone,
                    title: ZONE_DESCRIPTION[zone] ?? humanizeFieldName(zone),
                    state: { left: sides.left[zone], right: sides.right[zone] },
                });
            }
            sendRef.current({
                type: 'card-display-state',
                left: sides.left.displayCard,
                right: sides.right.displayCard,
            });
            sendRef.current({ type: 'template-state', template: loadLiveTemplateState() });
            sendRef.current({ type: 'player-info-state', left: playerInfo('left'), right: playerInfo('right') });
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

    const broadcastAnnotation = (zone: AnnotationZone, side: Side, cards: LibraryCardInstance[]) => {
        sendRef.current({
            type: 'annotation-state',
            annotationId: zone,
            title: ZONE_DESCRIPTION[zone] ?? humanizeFieldName(zone),
            state: {
                left: side === 'left' ? cards : sides.left[zone],
                right: side === 'right' ? cards : sides.right[zone],
            },
        });
    };

    const broadcastZone = (zone: Zone, side: Side, cards: LibraryCardInstance[]) => {
        if (zone === 'hand') broadcastHand(side, cards);
        else broadcastAnnotation(zone, side, cards);
    };

    const broadcastDisplayCard = (side: Side, card: LibraryCardInstance | null) => {
        sendRef.current({
            type: 'card-display-state',
            left: side === 'left' ? card : sides.left.displayCard,
            right: side === 'right' ? card : sides.right.displayCard,
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

    const activeSide = useMemo(() => {
        if (!activeId) return null;
        const [prefix, key] = activeId.split(':');
        if (prefix === 'lib' || prefix === 'hand') return key as Side;
        if (prefix === 'annotation') return key.endsWith('-left') ? 'left' : 'right';
        return null;
    }, [activeId]);

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
        const { active, over } = e;
        let success = false;

        if (over) {
            const [prefix, key, instanceId] = String(active.id).split(':');

            if (prefix === 'lib') {
                const s = key as Side;
                const entry = sides[s].library.find((c) => c.id === instanceId);
                if (entry) {
                    if (over.id === CARD_DISPLAY_DROP_ID(s)) {
                        setSides((prev) => ({ ...prev, [s]: { ...prev[s], displayCard: entry } }));
                        broadcastDisplayCard(s, entry);
                        success = true;
                    } else {
                        for (const zone of ZONES) {
                            if (over.id === ZONE_DROP_ID[zone](s)) {
                                const newZoneCards = [...sides[s][zone], { id: makeId(), card: entry.card }];
                                setSides((prev) => ({ ...prev, [s]: { ...prev[s], [zone]: newZoneCards } }));
                                broadcastZone(zone, s, newZoneCards);
                                success = true;
                                break;
                            }
                        }
                    }
                }
            } else if (prefix === 'hand' || prefix === 'annotation') {
                const side: Side = prefix === 'hand' ? (key as Side) : key.endsWith('-left') ? 'left' : 'right';
                const sourceZone: Zone = prefix === 'hand' ? 'hand' : key.startsWith('graveyard') ? 'graveyard' : 'topDeck';
                const entry = sides[side][sourceZone].find((c) => c.id === instanceId);

                if (entry) {
                    if (over.id === CARD_DISPLAY_DROP_ID(side)) {
                        setSides((prev) => ({ ...prev, [side]: { ...prev[side], displayCard: entry } }));
                        broadcastDisplayCard(side, entry);
                        success = true;
                    } else if (over.id === `lib-${side}`) {
                        const newSourceCards = sides[side][sourceZone].filter((c) => c.id !== instanceId);
                        setSides((prev) => ({ ...prev, [side]: { ...prev[side], [sourceZone]: newSourceCards } }));
                        broadcastZone(sourceZone, side, newSourceCards);
                        success = true;
                    } else {
                        for (const zone of ZONES) {
                            if (zone === sourceZone || over.id !== ZONE_DROP_ID[zone](side)) continue;
                            const newSourceCards = sides[side][sourceZone].filter((c) => c.id !== instanceId);
                            const newTargetCards = [...sides[side][zone], entry];
                            setSides((prev) => ({
                                ...prev,
                                [side]: { ...prev[side], [sourceZone]: newSourceCards, [zone]: newTargetCards },
                            }));
                            broadcastZone(sourceZone, side, newSourceCards);
                            broadcastZone(zone, side, newTargetCards);
                            success = true;
                            break;
                        }
                    }
                }
            }
        }

        setSkipDropAnimation(success);
        setActiveId(null);
        setActiveWidth(null);
    };

    const handleClearHand = (side: Side) => {
        setSides((prev) => ({ ...prev, [side]: { ...prev[side], hand: [] } }));
        broadcastHand(side, []);
    };

    const handleClearAnnotation = (side: Side, zone: AnnotationZone) => {
        setSides((prev) => ({ ...prev, [side]: { ...prev[side], [zone]: [] } }));
        broadcastAnnotation(zone, side, []);
    };

    const handleClearDisplayCard = (side: Side) => {
        setSides((prev) => ({ ...prev, [side]: { ...prev[side], displayCard: null } }));
        broadcastDisplayCard(side, null);
    };

    const handleUpdateSide = (side: Side, patch: Partial<Pick<SideState, 'name' | 'deckName' | 'life' | 'wins'>>) => {
        setSides((prev) => {
            const next = { ...prev, [side]: { ...prev[side], ...patch } };
            sendRef.current({
                type: 'player-info-state',
                left: { name: next.left.name, deckName: next.left.deckName, life: next.left.life, wins: next.left.wins },
                right: {
                    name: next.right.name,
                    deckName: next.right.deckName,
                    life: next.right.life,
                    wins: next.right.wins,
                },
            });
            return next;
        });
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
                setSkipDropAnimation(false);
                setActiveId(null);
                setActiveWidth(null);
            }}
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
                <div className="flex flex-col min-h-0 gap-2">
                    <PlayerState
                        name={sides.left.name}
                        deckName={sides.left.deckName}
                        life={sides.left.life}
                        wins={sides.left.wins}
                        onChangeName={(name) => handleUpdateSide('left', { name })}
                        onChangeDeckName={(deckName) => handleUpdateSide('left', { deckName })}
                        onLifeChange={(life) => handleUpdateSide('left', { life })}
                        onWinsChange={(wins) => handleUpdateSide('left', { wins })}
                    />
                    <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                        <PlayerHand side="left" cards={sides.left.hand} onClear={() => handleClearHand('left')} />
                        <div className="flex flex-col gap-2 min-h-0">
                            <CardDisplay
                                side="left"
                                card={sides.left.displayCard}
                                disabled={activeSide !== null && activeSide !== 'left'}
                                onClear={() => handleClearDisplayCard('left')}
                            />
                            <Annotation
                                id="graveyard-left"
                                title="Graveyard"
                                description={ZONE_DESCRIPTION.graveyard}
                                cards={sides.left.graveyard}
                                onClear={() => handleClearAnnotation('left', 'graveyard')}
                            />
                            <Annotation
                                id="top-deck-left"
                                title="Top Deck"
                                description={ZONE_DESCRIPTION.topDeck}
                                cards={sides.left.topDeck}
                                onClear={() => handleClearAnnotation('left', 'topDeck')}
                            />
                            {/* <Button variant="outline" size="sm" className="cursor-pointer">
                                <PlusIcon />
                                Create annotation
                            </Button> */}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col min-h-0 gap-2">
                    <PlayerState
                        name={sides.right.name}
                        deckName={sides.right.deckName}
                        life={sides.right.life}
                        wins={sides.right.wins}
                        onChangeName={(name) => handleUpdateSide('right', { name })}
                        onChangeDeckName={(deckName) => handleUpdateSide('right', { deckName })}
                        onLifeChange={(life) => handleUpdateSide('right', { life })}
                        onWinsChange={(wins) => handleUpdateSide('right', { wins })}
                    />
                    <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
                        <div className="flex flex-col gap-2 min-h-0">
                            <CardDisplay
                                side="right"
                                card={sides.right.displayCard}
                                disabled={activeSide !== null && activeSide !== 'right'}
                                onClear={() => handleClearDisplayCard('right')}
                            />
                            <Annotation
                                id="graveyard-right"
                                title="Graveyard"
                                description={ZONE_DESCRIPTION.graveyard}
                                cards={sides.right.graveyard}
                                onClear={() => handleClearAnnotation('right', 'graveyard')}
                            />
                            <Annotation
                                id="top-deck-right"
                                title="Top Deck"
                                description={ZONE_DESCRIPTION.topDeck}
                                cards={sides.right.topDeck}
                                onClear={() => handleClearAnnotation('right', 'topDeck')}
                            />
                            {/* <Button variant="outline" size="sm" className="cursor-pointer">
                                <PlusIcon />
                                Create annotation
                            </Button> */}
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

            <DragOverlay dropAnimation={skipDropAnimation ? null : undefined}>
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
