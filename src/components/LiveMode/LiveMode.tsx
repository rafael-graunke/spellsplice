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

import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    pointerWithin,
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
    defaultLiveScoreboardState,
    loadLiveModeConfig,
    loadLiveScoreboardState,
    type LiveMessage,
    type LivePlayerInfo,
    LIVE_PROJECT_KEY,
} from '@/lib/liveMode';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { LibraryPanel, type LibraryCardInstance } from './LibraryPanel';
import { PlayerHand } from './PlayerHand';
import { PlayerState } from './PlayerState';
import { Annotation } from './Annotation';
import { CreateAnnotationControl } from './CreateAnnotationControl';
import { CardChip } from './CardChip';
import { CardDisplay } from './CardDisplay';

type Side = 'left' | 'right';

interface AnnotationState {
    id: string;
    title: string;
    description?: string;
    cards: LibraryCardInstance[];
}

const CARD_DISPLAY_DROP_ID = (side: Side) => `card-display-${side}`;
const isCardDisplayDrop = (overId: string | number, side: Side) =>
    String(overId).startsWith(CARD_DISPLAY_DROP_ID(side));
const isPlayDrop = (overId: string | number, side: Side) =>
    String(overId) === `${CARD_DISPLAY_DROP_ID(side)}-play`;

const HAND_DROP_ID = (side: Side) => `hand-${side}`;
const annotationDropId = (annotationId: string, side: Side) =>
    `annotation-${annotationId}-${side}`;
const annotationSlug = (annotationId: string, side: Side) =>
    `${annotationId}-${side}`;

function parseAnnotationSlug(slug: string): {
    side: Side;
    annotationId: string;
} {
    const side: Side = slug.endsWith('-left') ? 'left' : 'right';
    return { side, annotationId: slug.slice(0, -(side.length + 1)) };
}

function humanizeFieldName(field: string): string {
    return field
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase());
}

interface SideState {
    name: string;
    deckName: string;
    life: number;
    wins: number;
    decklist: Decklist | null;
    library: LibraryCardInstance[];
    hand: LibraryCardInstance[];
    annotations: AnnotationState[];
    displayCard: LibraryCardInstance | null;
    displayCardFlipped: boolean;
    // Epoch ms when a played card auto-clears; drives the countdown bar. null = no timer.
    displayCardPlayUntil: number | null;
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
        annotations: [
            { id: 'graveyard', title: 'Graveyard', cards: [] },
            { id: 'top-deck', title: 'Top Deck', cards: [] },
        ],
        displayCard: null,
        displayCardFlipped: false,
        displayCardPlayUntil: null,
    };
}

export interface LiveModeHandle {
    resetOverlay: () => void;
}

interface LiveModeProps {
    // Play-timer duration in ms; opens the settings dialog on the Card
    // Display section when the card display's settings icon is clicked.
    cardDisplayDuration: number;
    onOpenSettings: () => void;
}

function loadLiveProject(): Record<Side, SideState> | null {
    try {
        const raw = localStorage.getItem(LIVE_PROJECT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<Side, Partial<SideState>>;
        return {
            // Drop any stale play timer: the setTimeout isn't restored across reloads.
            left: {
                ...emptySide('left'),
                ...parsed.left,
                displayCardPlayUntil: null,
            },
            right: {
                ...emptySide('right'),
                ...parsed.right,
                displayCardPlayUntil: null,
            },
        };
    } catch {
        return null;
    }
}

function saveLiveProject(sides: Record<Side, SideState>) {
    localStorage.setItem(LIVE_PROJECT_KEY, JSON.stringify(sides));
}

const LiveMode = forwardRef<LiveModeHandle, LiveModeProps>(function LiveMode(
    { cardDisplayDuration, onOpenSettings },
    ref
) {
    const { status } = useOracleCards();
    const sensors = useSensors(useSensor(PointerSensor));
    const [sides, setSides] = useState<Record<Side, SideState>>(
        () =>
            loadLiveProject() ?? {
                left: emptySide('left'),
                right: emptySide('right'),
            }
    );
    useEffect(() => {
        saveLiveProject(sides);
    }, [sides]);
    // Mirror of `sides` for reads inside deferred callbacks (e.g. the play timer),
    // where the render closure would otherwise be stale.
    const sidesRef = useRef(sides);
    useEffect(() => {
        sidesRef.current = sides;
    }, [sides]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeWidth, setActiveWidth] = useState<number | null>(null);
    const [skipDropAnimation, setSkipDropAnimation] = useState(false);

    const [config] = useState(() => loadLiveModeConfig());
    const sendRef = useRef<(msg: LiveMessage) => void>(() => {});
    const playTimersRef = useRef<
        Record<Side, ReturnType<typeof setTimeout> | null>
    >({
        left: null,
        right: null,
    });

    const playerInfo = (side: Side): LivePlayerInfo => ({
        name: sides[side].name,
        deckName: sides[side].deckName,
        life: sides[side].life,
        wins: sides[side].wins,
    });

    const findAnnotation = (side: Side, annotationId: string) =>
        sides[side].annotations.find((a) => a.id === annotationId);

    const handleSocketMessage = (msg: LiveMessage) => {
        if (msg.type === 'request-state') {
            sendRef.current({
                type: 'live-state',
                state: { left: sides.left.hand, right: sides.right.hand },
            });
            const annotationIds = new Set(
                [...sides.left.annotations, ...sides.right.annotations].map(
                    (a) => a.id
                )
            );
            for (const annotationId of annotationIds) {
                sendRef.current({
                    type: 'annotation-state',
                    annotationId,
                    title:
                        findAnnotation('left', annotationId)?.title ??
                        findAnnotation('right', annotationId)?.title ??
                        humanizeFieldName(annotationId),
                    state: {
                        left: findAnnotation('left', annotationId)?.cards ?? [],
                        right:
                            findAnnotation('right', annotationId)?.cards ?? [],
                    },
                });
            }
            sendRef.current({
                type: 'card-display-state',
                left: sides.left.displayCard
                    ? {
                          ...sides.left.displayCard,
                          flipped: sides.left.displayCardFlipped,
                      }
                    : null,
                right: sides.right.displayCard
                    ? {
                          ...sides.right.displayCard,
                          flipped: sides.right.displayCardFlipped,
                      }
                    : null,
            });
            sendRef.current({
                type: 'scoreboard-state',
                scoreboard: loadLiveScoreboardState(),
            });
            sendRef.current({
                type: 'player-info-state',
                left: playerInfo('left'),
                right: playerInfo('right'),
            });
        }
    };

    const { send, status: socketStatus } = useLiveModeSocket(
        config?.websocketUrl ?? null,
        handleSocketMessage
    );
    useEffect(() => {
        sendRef.current = send;
    }, [send]);

    // Push the current scoreboard as soon as control connects (session start),
    // rather than waiting for the overlay to ask via 'request-state' - a
    // persistent OBS Browser Source stays connected across sessions and never
    // sends that request on its own, so it would otherwise need a manual
    // browser-source refresh to pick up a new/default scoreboard.
    useEffect(() => {
        if (socketStatus === 'open')
            sendRef.current({
                type: 'scoreboard-state',
                scoreboard: loadLiveScoreboardState(),
            });
    }, [socketStatus]);

    useImperativeHandle(ref, () => ({
        resetOverlay: () => {
            sendRef.current({
                type: 'live-state',
                state: { left: [], right: [] },
            });
            const annotationIds = new Set(
                [...sides.left.annotations, ...sides.right.annotations].map(
                    (a) => a.id
                )
            );
            for (const annotationId of annotationIds) {
                sendRef.current({
                    type: 'annotation-state',
                    annotationId,
                    title:
                        findAnnotation('left', annotationId)?.title ??
                        findAnnotation('right', annotationId)?.title ??
                        humanizeFieldName(annotationId),
                    state: { left: [], right: [] },
                });
            }
            sendRef.current({
                type: 'card-display-state',
                left: null,
                right: null,
            });
            sendRef.current({
                type: 'scoreboard-state',
                scoreboard: defaultLiveScoreboardState(),
            });
            const freshInfo = (side: Side): LivePlayerInfo => {
                const fresh = emptySide(side);
                return {
                    name: fresh.name,
                    deckName: fresh.deckName,
                    life: fresh.life,
                    wins: fresh.wins,
                };
            };
            sendRef.current({
                type: 'player-info-state',
                left: freshInfo('left'),
                right: freshInfo('right'),
            });
        },
    }));

    const broadcastHand = (side: Side, hand: LibraryCardInstance[]) => {
        sendRef.current({
            type: 'live-state',
            state: {
                left: side === 'left' ? hand : sides.left.hand,
                right: side === 'right' ? hand : sides.right.hand,
            },
        });
    };

    const broadcastAnnotation = (
        annotationId: string,
        side: Side,
        cards: LibraryCardInstance[]
    ) => {
        const title =
            findAnnotation(side, annotationId)?.title ??
            findAnnotation(side === 'left' ? 'right' : 'left', annotationId)
                ?.title ??
            humanizeFieldName(annotationId);
        sendRef.current({
            type: 'annotation-state',
            annotationId,
            title,
            state: {
                left:
                    side === 'left'
                        ? cards
                        : (findAnnotation('left', annotationId)?.cards ?? []),
                right:
                    side === 'right'
                        ? cards
                        : (findAnnotation('right', annotationId)?.cards ?? []),
            },
        });
    };

    const setAnnotationCards = (
        side: Side,
        annotationId: string,
        cards: LibraryCardInstance[]
    ) => {
        setSides((prev) => ({
            ...prev,
            [side]: {
                ...prev[side],
                annotations: prev[side].annotations.map((a) =>
                    a.id === annotationId ? { ...a, cards } : a
                ),
            },
        }));
    };

    const setAnnotationMeta = (
        side: Side,
        annotationId: string,
        title: string,
        description: string
    ) => {
        setSides((prev) => ({
            ...prev,
            [side]: {
                ...prev[side],
                annotations: prev[side].annotations.map((a) =>
                    a.id === annotationId
                        ? { ...a, title, description: description || undefined }
                        : a
                ),
            },
        }));
    };

    const broadcastDisplayCard = (
        side: Side,
        card: LibraryCardInstance | null,
        flipped = false
    ) => {
        const toLive = (c: LibraryCardInstance | null, f: boolean) =>
            c ? { ...c, flipped: f } : null;
        sendRef.current({
            type: 'card-display-state',
            left:
                side === 'left'
                    ? toLive(card, flipped)
                    : toLive(
                          sidesRef.current.left.displayCard,
                          sidesRef.current.left.displayCardFlipped
                      ),
            right:
                side === 'right'
                    ? toLive(card, flipped)
                    : toLive(
                          sidesRef.current.right.displayCard,
                          sidesRef.current.right.displayCardFlipped
                      ),
        });
    };

    const activeCard = useMemo(() => {
        if (!activeId) return null;
        const [prefix, key, instanceId] = activeId.split(':');
        if (prefix === 'lib')
            return (
                sides[key as Side].library.find((c) => c.id === instanceId)
                    ?.card ?? null
            );
        if (prefix === 'hand')
            return (
                sides[key as Side].hand.find((c) => c.id === instanceId)
                    ?.card ?? null
            );
        if (prefix === 'annotation') {
            const { side, annotationId } = parseAnnotationSlug(key);
            return (
                sides[side].annotations
                    .find((a) => a.id === annotationId)
                    ?.cards.find((c) => c.id === instanceId)?.card ?? null
            );
        }
        return null;
    }, [activeId, sides]);

    const activeSide = useMemo(() => {
        if (!activeId) return null;
        const [prefix, key] = activeId.split(':');
        if (prefix === 'lib' || prefix === 'hand') return key as Side;
        if (prefix === 'annotation') return parseAnnotationSlug(key).side;
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
            const colorDiff =
                CARD_COLOR_ORDER[getCardColorKey(a.card.colors)] -
                CARD_COLOR_ORDER[getCardColorKey(b.card.colors)];
            if (colorDiff !== 0) return colorDiff;
            // Cards with a mana cost sort before cards without one (e.g. lands),
            // so zero-cost artifacts don't intermix with lands and colorless
            // high-CMC cards don't sink to the bottom.
            const aHasCost = !!a.card.mana_cost;
            const bHasCost = !!b.card.mana_cost;
            if (aHasCost !== bHasCost) return aHasCost ? -1 : 1;
            return (
                getManaValue(a.card.mana_cost) - getManaValue(b.card.mana_cost)
            );
        });
        setSides((prev) => ({
            ...prev,
            [side]: { ...prev[side], decklist, library, hand: [] },
        }));
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
                    if (isCardDisplayDrop(over.id, s)) {
                        setSides((prev) => ({
                            ...prev,
                            [s]: {
                                ...prev[s],
                                displayCard: entry,
                                displayCardFlipped: false,
                                displayCardPlayUntil: null,
                            },
                        }));
                        broadcastDisplayCard(s, entry);
                        // Library is a persistent source, so play/display differ only by the timer.
                        if (isPlayDrop(over.id, s)) startPlayTimer(s);
                        else cancelPlayTimer(s);
                        success = true;
                    } else if (over.id === HAND_DROP_ID(s)) {
                        const newHand = [
                            ...sides[s].hand,
                            { id: makeId(), card: entry.card },
                        ];
                        setSides((prev) => ({
                            ...prev,
                            [s]: { ...prev[s], hand: newHand },
                        }));
                        broadcastHand(s, newHand);
                        success = true;
                    } else {
                        for (const annotation of sides[s].annotations) {
                            if (
                                over.id === annotationDropId(annotation.id, s)
                            ) {
                                const newCards = [
                                    ...annotation.cards,
                                    { id: makeId(), card: entry.card },
                                ];
                                setAnnotationCards(s, annotation.id, newCards);
                                broadcastAnnotation(annotation.id, s, newCards);
                                success = true;
                                break;
                            }
                        }
                    }
                }
            } else if (prefix === 'hand' || prefix === 'annotation') {
                const side: Side =
                    prefix === 'hand'
                        ? (key as Side)
                        : parseAnnotationSlug(key).side;
                const sourceAnnotationId =
                    prefix === 'annotation'
                        ? parseAnnotationSlug(key).annotationId
                        : null;
                const entry =
                    prefix === 'hand'
                        ? sides[side].hand.find((c) => c.id === instanceId)
                        : findAnnotation(side, sourceAnnotationId!)?.cards.find(
                              (c) => c.id === instanceId
                          );

                if (entry) {
                    const removeFromSource = () => {
                        if (prefix === 'hand') {
                            const newHand = sides[side].hand.filter(
                                (c) => c.id !== instanceId
                            );
                            setSides((prev) => ({
                                ...prev,
                                [side]: { ...prev[side], hand: newHand },
                            }));
                            broadcastHand(side, newHand);
                        } else {
                            const newCards = findAnnotation(
                                side,
                                sourceAnnotationId!
                            )!.cards.filter((c) => c.id !== instanceId);
                            setAnnotationCards(
                                side,
                                sourceAnnotationId!,
                                newCards
                            );
                            broadcastAnnotation(
                                sourceAnnotationId!,
                                side,
                                newCards
                            );
                        }
                    };

                    if (isCardDisplayDrop(over.id, side)) {
                        setSides((prev) => ({
                            ...prev,
                            [side]: {
                                ...prev[side],
                                displayCard: entry,
                                displayCardFlipped: false,
                                displayCardPlayUntil: null,
                            },
                        }));
                        broadcastDisplayCard(side, entry);
                        // Play consumes the card from its origin (hand/annotation) and
                        // auto-clears after the timer; Display just shows it, untouched.
                        // Must run after the setSides above so startPlayTimer's
                        // displayCardPlayUntil isn't overwritten back to null.
                        if (isPlayDrop(over.id, side)) {
                            removeFromSource();
                            startPlayTimer(side);
                        } else {
                            cancelPlayTimer(side);
                        }
                        success = true;
                    } else if (over.id === `lib-${side}`) {
                        removeFromSource();
                        success = true;
                    } else if (
                        over.id === HAND_DROP_ID(side) &&
                        prefix !== 'hand'
                    ) {
                        removeFromSource();
                        const newHand = [...sides[side].hand, entry];
                        setSides((prev) => ({
                            ...prev,
                            [side]: { ...prev[side], hand: newHand },
                        }));
                        broadcastHand(side, newHand);
                        success = true;
                    } else {
                        for (const annotation of sides[side].annotations) {
                            if (
                                annotation.id === sourceAnnotationId ||
                                over.id !==
                                    annotationDropId(annotation.id, side)
                            ) {
                                continue;
                            }
                            removeFromSource();
                            const newTargetCards = [...annotation.cards, entry];
                            setAnnotationCards(
                                side,
                                annotation.id,
                                newTargetCards
                            );
                            broadcastAnnotation(
                                annotation.id,
                                side,
                                newTargetCards
                            );
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

    const handleClearAnnotation = (side: Side, annotationId: string) => {
        setAnnotationCards(side, annotationId, []);
        broadcastAnnotation(annotationId, side, []);
    };

    const handleCreateAnnotation = (
        side: Side,
        title: string,
        description: string
    ) => {
        setSides((prev) => ({
            ...prev,
            [side]: {
                ...prev[side],
                annotations: [
                    ...prev[side].annotations,
                    {
                        id: makeId(),
                        title,
                        description: description || undefined,
                        cards: [],
                    },
                ],
            },
        }));
    };

    const handleUpdateAnnotation = (
        side: Side,
        annotationId: string,
        title: string,
        description: string
    ) => {
        setAnnotationMeta(side, annotationId, title, description);
    };

    const handleDeleteAnnotation = (side: Side, annotationId: string) => {
        broadcastAnnotation(annotationId, side, []);
        setSides((prev) => ({
            ...prev,
            [side]: {
                ...prev[side],
                annotations: prev[side].annotations.filter(
                    (a) => a.id !== annotationId
                ),
            },
        }));
    };

    const cancelPlayTimer = (side: Side) => {
        if (playTimersRef.current[side] != null) {
            clearTimeout(playTimersRef.current[side]!);
            playTimersRef.current[side] = null;
        }
    };

    const handleClearDisplayCard = (side: Side) => {
        cancelPlayTimer(side);
        setSides((prev) => ({
            ...prev,
            [side]: {
                ...prev[side],
                displayCard: null,
                displayCardFlipped: false,
                displayCardPlayUntil: null,
            },
        }));
        broadcastDisplayCard(side, null);
    };

    const startPlayTimer = (side: Side) => {
        cancelPlayTimer(side);
        setSides((prev) => ({
            ...prev,
            [side]: {
                ...prev[side],
                displayCardPlayUntil: Date.now() + cardDisplayDuration,
            },
        }));
        playTimersRef.current[side] = setTimeout(() => {
            playTimersRef.current[side] = null;
            handleClearDisplayCard(side);
        }, cardDisplayDuration);
    };

    // Cancel pending play timers on unmount.
    useEffect(
        () => () => {
            cancelPlayTimer('left');
            cancelPlayTimer('right');
        },
        []
    );

    const handleFlipDisplayCard = (side: Side) => {
        const flipped = !sides[side].displayCardFlipped;
        setSides((prev) => ({
            ...prev,
            [side]: { ...prev[side], displayCardFlipped: flipped },
        }));
        broadcastDisplayCard(side, sides[side].displayCard, flipped);
    };

    const handleUpdateSide = (
        side: Side,
        patch: Partial<Pick<SideState, 'name' | 'deckName' | 'life' | 'wins'>>
    ) => {
        setSides((prev) => {
            const next = { ...prev, [side]: { ...prev[side], ...patch } };
            sendRef.current({
                type: 'player-info-state',
                left: {
                    name: next.left.name,
                    deckName: next.left.deckName,
                    life: next.left.life,
                    wins: next.left.wins,
                },
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
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
                setSkipDropAnimation(false);
                setActiveId(null);
                setActiveWidth(null);
            }}
        >
            <div className="flex-1 min-h-0 grid grid-cols-6 grid-rows-[auto_1fr] p-2 gap-2">
                <div className="col-span-3">
                    <PlayerState
                        name={sides.left.name}
                        deckName={sides.left.deckName}
                        life={sides.left.life}
                        wins={sides.left.wins}
                        onChangeName={(name) =>
                            handleUpdateSide('left', { name })
                        }
                        onChangeDeckName={(deckName) =>
                            handleUpdateSide('left', { deckName })
                        }
                        onLifeChange={(life) =>
                            handleUpdateSide('left', { life })
                        }
                        onWinsChange={(wins) =>
                            handleUpdateSide('left', { wins })
                        }
                    />
                </div>
                <div className="col-span-3">
                    <PlayerState
                        name={sides.right.name}
                        deckName={sides.right.deckName}
                        life={sides.right.life}
                        wins={sides.right.wins}
                        onChangeName={(name) =>
                            handleUpdateSide('right', { name })
                        }
                        onChangeDeckName={(deckName) =>
                            handleUpdateSide('right', { deckName })
                        }
                        onLifeChange={(life) =>
                            handleUpdateSide('right', { life })
                        }
                        onWinsChange={(wins) =>
                            handleUpdateSide('right', { wins })
                        }
                        reverse
                    />
                </div>
                <div className="flex flex-col min-h-0 overflow-hidden">
                    <LibraryPanel
                        side="left"
                        decklist={sides.left.decklist}
                        library={sides.left.library}
                        ready={status === 'ready'}
                        onImport={(d) => handleImport('left', d)}
                    />
                </div>
                <div className="flex flex-col gap-2 min-h-0">
                    <PlayerHand
                        side="left"
                        cards={sides.left.hand}
                        onClear={() => handleClearHand('left')}
                    />
                    <CardDisplay
                        side="left"
                        card={sides.left.displayCard}
                        flipped={sides.left.displayCardFlipped}
                        playUntil={sides.left.displayCardPlayUntil}
                        playDuration={cardDisplayDuration}
                        disabled={activeSide !== null && activeSide !== 'left'}
                        onClear={() => handleClearDisplayCard('left')}
                        onFlip={() => handleFlipDisplayCard('left')}
                        onSettings={onOpenSettings}
                    />
                </div>
                <div className="flex flex-col gap-2 min-h-0">
                    <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
                        {sides.left.annotations.map((a) => (
                            <Annotation
                                key={a.id}
                                id={annotationSlug(a.id, 'left')}
                                title={a.title}
                                description={a.description}
                                cards={a.cards}
                                onClear={() =>
                                    handleClearAnnotation('left', a.id)
                                }
                                onSave={(title, description) =>
                                    handleUpdateAnnotation(
                                        'left',
                                        a.id,
                                        title,
                                        description
                                    )
                                }
                                onDelete={() =>
                                    handleDeleteAnnotation('left', a.id)
                                }
                            />
                        ))}
                        <CreateAnnotationControl
                            onCreate={(title, description) =>
                                handleCreateAnnotation(
                                    'left',
                                    title,
                                    description
                                )
                            }
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-2 min-h-0">
                    <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
                        {sides.right.annotations.map((a) => (
                            <Annotation
                                key={a.id}
                                id={annotationSlug(a.id, 'right')}
                                title={a.title}
                                description={a.description}
                                cards={a.cards}
                                onClear={() =>
                                    handleClearAnnotation('right', a.id)
                                }
                                onSave={(title, description) =>
                                    handleUpdateAnnotation(
                                        'right',
                                        a.id,
                                        title,
                                        description
                                    )
                                }
                                onDelete={() =>
                                    handleDeleteAnnotation('right', a.id)
                                }
                            />
                        ))}
                        <CreateAnnotationControl
                            onCreate={(title, description) =>
                                handleCreateAnnotation(
                                    'right',
                                    title,
                                    description
                                )
                            }
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-2 min-h-0">
                    <PlayerHand
                        side="right"
                        cards={sides.right.hand}
                        onClear={() => handleClearHand('right')}
                    />
                    <CardDisplay
                        side="right"
                        card={sides.right.displayCard}
                        flipped={sides.right.displayCardFlipped}
                        playUntil={sides.right.displayCardPlayUntil}
                        playDuration={cardDisplayDuration}
                        disabled={activeSide !== null && activeSide !== 'right'}
                        onClear={() => handleClearDisplayCard('right')}
                        onFlip={() => handleFlipDisplayCard('right')}
                        onSettings={onOpenSettings}
                    />
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
});

export default LiveMode;
