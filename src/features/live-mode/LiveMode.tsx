import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import {
    DndContext,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { useOracleCards } from '@/hooks/useOracleCards';
import { findOracleCard } from '@/lib/oracleCards';
import { CARD_COLOR_ORDER, getCardColorKey } from '@/lib/cardColors';
import { getManaValue } from '@/lib/manaCost';
import { warmCardImages, resolveCardImageData } from '@/lib/cardCache';
import type { Decklist } from '@/types/player';
import {
    defaultLiveScoreboardState,
    loadLiveModeConfig,
    loadLiveScoreboardState,
    loadLiveCardDisplayConfig,
    loadLiveHandStackConfig,
    loadLiveAnnotationConfig,
    loadLiveLayerOrder,
    defaultLiveCardDisplayConfig,
    defaultLiveHandStackConfig,
    DEFAULT_LAYER_ORDER,
    loadLivePlayerInfos,
    type LiveMessage,
    type LiveEvent,
    type LivePlayerInfo,
    LIVE_PROJECT_KEY,
} from '@/lib/liveMode';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { LibraryPanel, type LibraryCardInstance } from './LibraryPanel';
import { PlayerHand } from './PlayerHand';
import { PlayerState } from './PlayerState';
import { MatchControls } from './MatchControls';
import { Annotation } from './Annotation';
import { CreateAnnotationControl } from './CreateAnnotationControl';
import { CardDisplay } from './CardDisplay';
import { DragLayer } from './DragLayer';

type Side = 'left' | 'right';

interface AnnotationState {
    id: string;
    title: string;
    description?: string;
    cards: LibraryCardInstance[];
}

// Module-scope so the wall-clock read (Date.now(), impure) is not analyzed as
// a render-phase call. Only ever invoked from event handlers via emitHandDeltas.
function makeHandEvent(
    type: 'ADD_TO_HAND' | 'REMOVE_FROM_HAND',
    side: Side,
    card: LibraryCardInstance
): LiveEvent {
    return { type, side, time: Date.now(), card };
}

function makeAnnotationEvent(
    type: 'ANNOTATE_CARD' | 'UNANNOTATE_CARD',
    side: Side,
    annotationId: string,
    card: LibraryCardInstance
): LiveEvent {
    return { type, side, time: Date.now(), card, annotationId };
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
    standing: string;
    pronouns: string;
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
        standing: '',
        pronouns: '',
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
    // Reload player identity (name/deck/standing/pronouns) from the project
    // store, e.g. after the Players config dialog edited and persisted it.
    syncPlayerInfoFromStorage: () => void;
}

interface LiveModeProps {
    // Play-timer duration in ms; opens the settings dialog on the Card
    // Display section when the card display's settings icon is clicked.
    cardDisplayDuration: number;
    onOpenSettings: () => void;
    // Opens the settings dialog on the Players section (PlayerState edit icon).
    onEditPlayers: () => void;
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
    { cardDisplayDuration, onOpenSettings, onEditPlayers },
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
    // Whether the last drop landed on a valid target. Written in handleDragEnd,
    // read by DragLayer (via its useDndMonitor onDragEnd) to skip the return
    // animation. Kept out of state so drops don't force an extra render here.
    const dropSuccessRef = useRef(false);

    const [config] = useState(() => loadLiveModeConfig());
    const sendRef = useRef<(msg: LiveMessage) => void>(() => {});
    const playTimersRef = useRef<
        Record<Side, ReturnType<typeof setTimeout> | null>
    >({
        left: null,
        right: null,
    });

    const toPlayerInfo = (s: SideState): LivePlayerInfo => ({
        name: s.name,
        deckName: s.deckName,
        standing: s.standing,
        pronouns: s.pronouns,
        life: s.life,
        wins: s.wins,
    });
    const playerInfo = (side: Side): LivePlayerInfo =>
        toPlayerInfo(sides[side]);

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
                type: 'card-display-config',
                config: loadLiveCardDisplayConfig(),
            });
            sendRef.current({
                type: 'hand-stack-config',
                config: loadLiveHandStackConfig(),
            });
            sendRef.current({
                type: 'annotation-config',
                config: loadLiveAnnotationConfig(),
            });
            sendRef.current({
                type: 'layer-order',
                order: loadLiveLayerOrder(),
            });
            sendRef.current({
                type: 'player-info-state',
                left: playerInfo('left'),
                right: playerInfo('right'),
            });
            const preload = [
                ...sides.left.library,
                ...sides.right.library,
            ].flatMap(({ card }) => {
                const data = resolveCardImageData(card.name);
                return data ? [data] : [];
            });
            if (preload.length > 0) {
                sendRef.current({ type: 'preload-cards', cards: preload });
            }
        }
    };

    const { send, status: socketStatus } = useLiveModeSocket(
        config?.websocketUrl ?? null,
        handleSocketMessage
    );
    useEffect(() => {
        sendRef.current = send;
    }, [send]);

    useEffect(() => {
        if (socketStatus === 'open') {
            sendRef.current({
                type: 'scoreboard-state',
                scoreboard: loadLiveScoreboardState(),
            });
            sendRef.current({
                type: 'card-display-config',
                config: loadLiveCardDisplayConfig(),
            });
            sendRef.current({
                type: 'hand-stack-config',
                config: loadLiveHandStackConfig(),
            });
            sendRef.current({
                type: 'annotation-config',
                config: loadLiveAnnotationConfig(),
            });
            sendRef.current({
                type: 'layer-order',
                order: loadLiveLayerOrder(),
            });
        }
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
            sendRef.current({
                type: 'card-display-config',
                config: defaultLiveCardDisplayConfig(),
            });
            sendRef.current({
                type: 'hand-stack-config',
                config: defaultLiveHandStackConfig(),
            });
            sendRef.current({
                type: 'layer-order',
                order: [...DEFAULT_LAYER_ORDER],
            });
            sendRef.current({
                type: 'player-info-state',
                left: toPlayerInfo(emptySide('left')),
                right: toPlayerInfo(emptySide('right')),
            });
        },
        syncPlayerInfoFromStorage: () => {
            const infos = loadLivePlayerInfos();
            setSides((prev) => ({
                left: {
                    ...prev.left,
                    name: infos.left.name,
                    deckName: infos.left.deckName,
                    standing: infos.left.standing,
                    pronouns: infos.left.pronouns,
                },
                right: {
                    ...prev.right,
                    name: infos.right.name,
                    deckName: infos.right.deckName,
                    standing: infos.right.standing,
                    pronouns: infos.right.pronouns,
                },
            }));
        },
    }));

    // Emits a semantic ADD_TO_HAND / REMOVE_FROM_HAND per changed card so
    // /overlay can animate it. Diffs by stable instance id. `prev` comes from
    // sidesRef (committed state) since setSides has not flushed yet at call time.
    const emitHandDeltas = (
        side: Side,
        prevHand: LibraryCardInstance[],
        nextHand: LibraryCardInstance[]
    ) => {
        const prevIds = new Set(prevHand.map((c) => c.id));
        const nextIds = new Set(nextHand.map((c) => c.id));
        for (const card of nextHand) {
            if (!prevIds.has(card.id))
                sendRef.current({
                    type: 'live-event',
                    event: makeHandEvent('ADD_TO_HAND', side, card),
                });
        }
        for (const card of prevHand) {
            if (!nextIds.has(card.id))
                sendRef.current({
                    type: 'live-event',
                    event: makeHandEvent('REMOVE_FROM_HAND', side, card),
                });
        }
    };

    // Places a new hand card per that side's configured insert order: 'prepend'
    // puts it at the anchor end (index 0), 'append' (default) at the growth end.
    const placeInHand = (
        side: Side,
        hand: LibraryCardInstance[],
        entry: LibraryCardInstance
    ) => {
        const insert = loadLiveHandStackConfig()[side].insert ?? 'append';
        return insert === 'prepend' ? [entry, ...hand] : [...hand, entry];
    };

    // Same, for a card dropped into an annotation slot. Annotations carry their
    // own insert setting, so a caster can have the hand append while the
    // top-of-deck slot prepends.
    const placeInAnnotation = (
        side: Side,
        cards: LibraryCardInstance[],
        entry: LibraryCardInstance
    ) => {
        const insert = loadLiveAnnotationConfig()[side].insert ?? 'append';
        return insert === 'prepend' ? [entry, ...cards] : [...cards, entry];
    };

    const broadcastHand = (side: Side, hand: LibraryCardInstance[]) => {
        emitHandDeltas(side, sidesRef.current[side].hand, hand);
        sendRef.current({
            type: 'live-state',
            state: {
                left: side === 'left' ? hand : sides.left.hand,
                right: side === 'right' ? hand : sides.right.hand,
            },
        });
    };

    // Mirrors emitHandDeltas for a single annotation slot: emits one
    // ANNOTATE_CARD / UNANNOTATE_CARD per changed card so /overlay can animate
    // it. `prev` comes from the committed `sides` closure (findAnnotation),
    // which still holds the pre-change cards since setSides has not flushed.
    const emitAnnotationDeltas = (
        side: Side,
        annotationId: string,
        prevCards: LibraryCardInstance[],
        nextCards: LibraryCardInstance[]
    ) => {
        const prevIds = new Set(prevCards.map((c) => c.id));
        const nextIds = new Set(nextCards.map((c) => c.id));
        for (const card of nextCards) {
            if (!prevIds.has(card.id))
                sendRef.current({
                    type: 'live-event',
                    event: makeAnnotationEvent(
                        'ANNOTATE_CARD',
                        side,
                        annotationId,
                        card
                    ),
                });
        }
        for (const card of prevCards) {
            if (!nextIds.has(card.id))
                sendRef.current({
                    type: 'live-event',
                    event: makeAnnotationEvent(
                        'UNANNOTATE_CARD',
                        side,
                        annotationId,
                        card
                    ),
                });
        }
    };

    const broadcastAnnotation = (
        annotationId: string,
        side: Side,
        cards: LibraryCardInstance[]
    ) => {
        emitAnnotationDeltas(
            side,
            annotationId,
            findAnnotation(side, annotationId)?.cards ?? [],
            cards
        );
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

    // Resolve a drag id to its card for the DragLayer overlay. Only invoked
    // during a drag, when `sides` is unchanged.
    const resolveActiveCard = useCallback(
        (id: string) => {
            const [prefix, key, instanceId] = id.split(':');
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
        },
        [sides]
    );

    const handleImport = (side: Side, decklist: Decklist) => {
        const seen = new Set<string>();
        const library: LibraryCardInstance[] = [];
        for (const { card } of [
            ...decklist.maindeck,
            ...(decklist.sideboard ?? []),
        ]) {
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
        const cardNames = library.map(({ card }) => card.name);
        warmCardImages(cardNames);
        // Ship resolved image links to the overlay window (no oracle DB there).
        const preload = library.flatMap(({ card }) => {
            const data = resolveCardImageData(card.name);
            return data ? [data] : [];
        });
        sendRef.current({ type: 'preload-cards', cards: preload });
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
                        const newHand = placeInHand(s, sides[s].hand, {
                            id: makeId(),
                            card: entry.card,
                        });
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
                                const newCards = placeInAnnotation(
                                    s,
                                    annotation.cards,
                                    { id: makeId(), card: entry.card }
                                );
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
                        const newHand = placeInHand(
                            side,
                            sides[side].hand,
                            entry
                        );
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
                            const newTargetCards = placeInAnnotation(
                                side,
                                annotation.cards,
                                entry
                            );
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

        dropSuccessRef.current = success;
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
        patch: Partial<Pick<SideState, 'life' | 'wins'>>
    ) => {
        setSides((prev) => {
            const next = { ...prev, [side]: { ...prev[side], ...patch } };
            sendRef.current({
                type: 'player-info-state',
                left: toPlayerInfo(next.left),
                right: toPlayerInfo(next.right),
            });
            return next;
        });
    };

    const handleResetMatch = () => {
        cancelPlayTimer('left');
        cancelPlayTimer('right');

        for (const side of ['left', 'right'] as Side[]) {
            emitHandDeltas(side, sides[side].hand, []);
            for (const a of sides[side].annotations) {
                emitAnnotationDeltas(side, a.id, a.cards, []);
            }
        }

        sendRef.current({ type: 'live-state', state: { left: [], right: [] } });
        const annotationIds = new Set([
            ...sides.left.annotations.map((a) => a.id),
            ...sides.right.annotations.map((a) => a.id),
        ]);
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
            type: 'player-info-state',
            left: { ...playerInfo('left'), life: 20 },
            right: { ...playerInfo('right'), life: 20 },
        });

        const reset = (side: Side): SideState => ({
            ...sides[side],
            life: 20,
            hand: [],
            annotations: sides[side].annotations.map((a) => ({
                ...a,
                cards: [],
            })),
            displayCard: null,
            displayCardFlipped: false,
            displayCardPlayUntil: null,
        });
        setSides({ left: reset('left'), right: reset('right') });
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragEnd={handleDragEnd}
        >
            <div className="flex-1 min-h-0 grid grid-cols-6 grid-rows-[auto_1fr] p-2 gap-2 overflow-hidden">
                <div className="col-span-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <PlayerState
                        name={sides.left.name}
                        deckName={sides.left.deckName}
                        life={sides.left.life}
                        wins={sides.left.wins}
                        onEdit={onEditPlayers}
                        onLifeChange={(life) =>
                            handleUpdateSide('left', { life })
                        }
                        onWinsChange={(wins) =>
                            handleUpdateSide('left', { wins })
                        }
                    />
                    <MatchControls onResetMatch={handleResetMatch} />
                    <PlayerState
                        name={sides.right.name}
                        deckName={sides.right.deckName}
                        life={sides.right.life}
                        wins={sides.right.wins}
                        onEdit={onEditPlayers}
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

            <DragLayer
                resolveCard={resolveActiveCard}
                dropSuccessRef={dropSuccessRef}
            />
        </DndContext>
    );
});

export default LiveMode;
