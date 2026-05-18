import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, fireEvent, within, screen } from 'storybook/test';
import { NLETimeline } from './NLETimeline';
import type { PasteItem, DuplicateItem, DeleteItem } from './NLETimeline';
import type { NLETrackGroup } from '../types/nle';
import type { NLEMoveResult } from './hooks/useNLEEventDrag';
import { useHistory } from '@/hooks/useHistory';

const meta: Meta<typeof NLETimeline> = {
    title: 'NLE/NLETimeline',
    component: NLETimeline,
    parameters: { layout: 'fullscreen' },
    decorators: [
        (Story) => (
            <div style={{ height: '100vh' }}>
                <Story />
            </div>
        ),
    ],
};
export default meta;
type Story = StoryObj<typeof NLETimeline>;

const emptyGroups: NLETrackGroup[] = [
    {
        id: 'group-1',
        label: 'Events',
        type: 'EVENT',
        tracks: [
            { id: 'E1', type: 'EVENT', events: [], player: null as never, isBlocked: false },
            { id: 'E2', type: 'EVENT', events: [], player: null as never, isBlocked: false },
            { id: 'E3', type: 'EVENT', events: [], player: null as never, isBlocked: false },
        ],
    },
    {
        id: 'group-2',
        label: 'Video',
        type: 'VIDEO',
        tracks: [
            { id: 'V1', type: 'VIDEO', events: [], player: null as never, isBlocked: false, isHidden: false },
            { id: 'V2', type: 'VIDEO', events: [], player: null as never, isBlocked: false, isHidden: false },
        ],
    },
    {
        id: 'group-3',
        label: 'Audio',
        type: 'AUDIO',
        tracks: [
            { id: 'A1', type: 'AUDIO', events: [], player: null as never, isBlocked: false, isMuted: false },
            { id: 'A2', type: 'AUDIO', events: [], player: null as never, isBlocked: false, isMuted: false },
        ],
    },
];

function makeInitialGroups(): NLETrackGroup[] {
    return [
        {
            id: 'group-1',
            label: 'Events',
            type: 'EVENT',
            tracks: [
                {
                    id: 'E1',
                    type: 'EVENT',
                    events: [
                        { id: 1, time: 5,  layer: 0, type: 'ADD_TO_HAND',     resizable: false },
                        { id: 2, time: 12, layer: 0, type: 'LOSE_LIFE',        resizable: false, meta: { amount: 3 } },
                        { id: 3, time: 20, layer: 0, type: 'DISPLAY_CARD',     resizable: true,  duration: 8 },
                        { id: 4, time: 35, layer: 0, type: 'GAIN_LIFE',        resizable: false, meta: { amount: 2 } },
                        { id: 5, time: 50, layer: 0, type: 'REMOVE_FROM_HAND', resizable: false },
                    ],
                    player: null as never,
                    isBlocked: false,
                },
                {
                    id: 'E2',
                    type: 'EVENT',
                    events: [
                        { id: 6, time: 8,  layer: 0, type: 'REVEAL_FROM_HAND', resizable: false },
                        { id: 7, time: 25, layer: 0, type: 'DISPLAY_CARD',     resizable: true,  duration: 12 },
                    ],
                    player: null as never,
                    isBlocked: false,
                },
                {
                    id: 'E3',
                    type: 'EVENT',
                    events: [
                        { id: 9,  time: 15, layer: 0, type: 'STACK_DECK',   resizable: false },
                        { id: 10, time: 40, layer: 0, type: 'UNSTACK_DECK', resizable: false },
                    ],
                    player: null as never,
                    isBlocked: false,
                },
            ],
        },
        {
            id: 'group-2',
            label: 'Video',
            type: 'VIDEO',
            tracks: [
                { id: 'V1', type: 'VIDEO', events: [], player: null as never, isBlocked: false, isHidden: false },
            ],
        },
        {
            id: 'group-3',
            label: 'Audio',
            type: 'AUDIO',
            tracks: [
                { id: 'A1', type: 'AUDIO', events: [], player: null as never, isBlocked: false, isMuted: false },
            ],
        },
    ];
}

function Wrapper(args: React.ComponentProps<typeof NLETimeline>) {
    const currentTimeRef = useRef(0);
    return <NLETimeline {...args} currentTimeRef={currentTimeRef} />;
}

function WithEventsWrapper(args: React.ComponentProps<typeof NLETimeline>) {
    const currentTimeRef = useRef(0);
    const nextIdRef = useRef(100);
    const { state: groups, record, undo, redo, canUndo, canRedo } =
        useHistory<NLETrackGroup[]>(makeInitialGroups());

    const handleMoveEvent = (moves: NLEMoveResult[]) => {
        record((draft) => {
            for (const { fromTrackId, toTrackId, eventId, newTime } of moves) {
                if (fromTrackId === toTrackId) {
                    for (const g of draft) {
                        const track = g.tracks.find((t) => t.id === fromTrackId);
                        const ev = track?.events.find((e) => e.id === eventId);
                        if (ev) ev.time = newTime;
                    }
                } else {
                    let movedEvent: (typeof draft)[0]['tracks'][0]['events'][0] | undefined;
                    for (const g of draft) {
                        const src = g.tracks.find((t) => t.id === fromTrackId);
                        if (src) {
                            const idx = src.events.findIndex((e) => e.id === eventId);
                            if (idx !== -1) [movedEvent] = src.events.splice(idx, 1);
                        }
                    }
                    if (movedEvent) {
                        movedEvent.time = newTime;
                        for (const g of draft) {
                            const dst = g.tracks.find((t) => t.id === toTrackId);
                            if (dst) dst.events.push(movedEvent);
                        }
                    }
                }
            }
        });
    };

    const handleUpdateEvent = (trackId: string, eventId: number, time: number, duration: number) => {
        record((draft) => {
            for (const g of draft) {
                const track = g.tracks.find((t) => t.id === trackId);
                const ev = track?.events.find((e) => e.id === eventId);
                if (ev) { ev.time = time; ev.duration = duration; }
            }
        });
    };

    const handleDeleteEvents = (items: DeleteItem[]) => {
        record((draft) => {
            for (const { trackId, eventId } of items) {
                for (const g of draft) {
                    const track = g.tracks.find((t) => t.id === trackId);
                    if (track) track.events = track.events.filter((e) => e.id !== eventId);
                }
            }
        });
    };

    const handleDuplicateEvents = (items: DuplicateItem[], onCreated: (newIds: number[]) => void) => {
        const newIds: number[] = [];
        record((draft) => {
            for (const { trackId, eventId } of items) {
                for (const g of draft) {
                    const track = g.tracks.find((t) => t.id === trackId);
                    const ev = track?.events.find((e) => e.id === eventId);
                    if (ev) {
                        const newId = nextIdRef.current++;
                        newIds.push(newId);
                        track!.events.push({ ...ev, id: newId, time: ev.time + 0.5 });
                    }
                }
            }
        });
        onCreated(newIds);
    };

    const handlePasteEvents = (items: PasteItem[], pasteTime: number, onCreated: (newIds: number[]) => void) => {
        const minTime = Math.min(...items.map((i) => i.event.time));
        const newIds: number[] = [];
        record((draft) => {
            for (const { trackId, event } of items) {
                for (const g of draft) {
                    const track = g.tracks.find((t) => t.id === trackId);
                    if (track) {
                        const newId = nextIdRef.current++;
                        newIds.push(newId);
                        track.events.push({
                            ...event,
                            id: newId,
                            time: pasteTime + (event.time - minTime),
                        });
                    }
                }
            }
        });
        onCreated(newIds);
    };

    const handleCreateEvent = (trackId: string, partial: Parameters<NonNullable<React.ComponentProps<typeof NLETimeline>['onCreateEvent']>>[1]) => {
        record((draft) => {
            for (const g of draft) {
                const track = g.tracks.find((t) => t.id === trackId);
                if (track) {
                    track.events.push({
                        id: nextIdRef.current++,
                        time: currentTimeRef.current,
                        layer: 0,
                        duration: partial.duration ?? 1,
                        resizable: partial.resizable ?? false,
                        ...partial,
                    });
                }
            }
        });
    };

    return (
        <NLETimeline
            {...args}
            currentTimeRef={currentTimeRef}
            trackGroups={groups}
            onMoveEvent={handleMoveEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvents={handleDeleteEvents}
            onDuplicateEvents={handleDuplicateEvents}
            onPasteEvents={handlePasteEvents}
            onCreateEvent={handleCreateEvent}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
        />
    );
}

export const Default: Story = {
    render: (args) => <Wrapper {...args} />,
    args: {
        duration: 120,
        isPlaying: false,
        setIsPlaying: () => {},
        setCurrentTime: () => {},
        trackGroups: emptyGroups,
        onUndo: () => {},
        onRedo: () => {},
        canUndo: false,
        canRedo: false,
    },
};

export const WithEvents: Story = {
    render: (args) => <WithEventsWrapper {...args} />,
    args: {
        duration: 120,
        isPlaying: false,
        setIsPlaying: () => {},
        setCurrentTime: () => {},
        trackGroups: [],
        onUndo: () => {},
        onRedo: () => {},
        canUndo: false,
        canRedo: false,
    },
};

// Regression test: duplicate from an already-selected event when multi-selected
// should duplicate all selected events, not just the right-clicked one.
export const MultiSelectDuplicate: Story = {
    render: (args) => <WithEventsWrapper {...args} />,
    args: {
        duration: 120,
        isPlaying: false,
        setIsPlaying: () => {},
        setCurrentTime: () => {},
        trackGroups: [],
        onUndo: () => {},
        onRedo: () => {},
        canUndo: false,
        canRedo: false,
    },
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);

        // Initial event count across all tracks
        const countEvents = () =>
            canvasElement.querySelectorAll('[data-testid^="nle-event-"]').length;
        const initialCount = countEvents();

        // Select event 1, then ctrl+click event 2 to add to selection
        const event1 = canvas.getByTestId('nle-event-1');
        const event2 = canvas.getByTestId('nle-event-2');
        await userEvent.click(event1);
        fireEvent.click(event2, { ctrlKey: true });

        // Right-click on event 1 (which was selected first) to open context menu
        fireEvent.contextMenu(event1);

        // Click "Duplicate" in the context menu (renders in a portal outside canvasElement)
        const duplicateItem = await screen.findByRole('menuitem', { name: 'Duplicate' });
        fireEvent.click(duplicateItem);

        // Both selected events should have been duplicated
        expect(countEvents()).toBe(initialCount + 2);
    },
};
