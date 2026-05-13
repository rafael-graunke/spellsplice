import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NLETimeline } from './NLETimeline';
import type { NLETrackGroup } from '../types/nle';
import type { TrackEvent } from '../types/event';
import type { NLEMoveResult } from './hooks/useNLEEventDrag';

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
        tracks: [
            { id: 'E1', type: 'EVENT', events: [], player: null as never, isBlocked: false },
            { id: 'E2', type: 'EVENT', events: [], player: null as never, isBlocked: false },
            { id: 'E3', type: 'EVENT', events: [], player: null as never, isBlocked: false },
        ],
    },
    {
        id: 'group-2',
        label: 'Video',
        tracks: [
            { id: 'V1', type: 'VIDEO', events: [], player: null as never, isBlocked: false, isHidden: false },
            { id: 'V2', type: 'VIDEO', events: [], player: null as never, isBlocked: false, isHidden: false },
        ],
    },
    {
        id: 'group-3',
        label: 'Audio',
        tracks: [
            { id: 'A1', type: 'AUDIO', events: [], player: null as never, isBlocked: false, isMuted: false },
            { id: 'A2', type: 'AUDIO', events: [], player: null as never, isBlocked: false, isMuted: false },
        ],
    },
];

const initialE1Events: TrackEvent[] = [
    { id: 1, time: 5,  layer: 0, type: 'ADD_TO_HAND',     resizable: false },
    { id: 2, time: 12, layer: 0, type: 'LOSE_LIFE',        resizable: false, meta: { amount: 3 } },
    { id: 3, time: 20, layer: 0, type: 'DISPLAY_CARD',     resizable: true,  duration: 8 },
    { id: 4, time: 35, layer: 0, type: 'GAIN_LIFE',        resizable: false, meta: { amount: 2 } },
    { id: 5, time: 50, layer: 0, type: 'REMOVE_FROM_HAND', resizable: false },
];

const initialE2Events: TrackEvent[] = [
    { id: 6, time: 8,  layer: 0, type: 'REVEAL_FROM_HAND', resizable: false },
    { id: 7, time: 25, layer: 0, type: 'DISPLAY_CARD',     resizable: true,  duration: 12 },
    { id: 8, time: 60, layer: 0, type: 'WIN',              resizable: false },
];

const initialE3Events: TrackEvent[] = [
    { id: 9,  time: 15, layer: 0, type: 'STACK_DECK',   resizable: false },
    { id: 10, time: 40, layer: 0, type: 'UNSTACK_DECK', resizable: false },
    { id: 11, time: 70, layer: 0, type: 'RESET',        resizable: false },
];

function makeInitialGroups(): NLETrackGroup[] {
    return [
        {
            id: 'group-1',
            label: 'Events',
            tracks: [
                { id: 'E1', type: 'EVENT', events: initialE1Events, player: null as never, isBlocked: false },
                { id: 'E2', type: 'EVENT', events: initialE2Events, player: null as never, isBlocked: false },
                { id: 'E3', type: 'EVENT', events: initialE3Events, player: null as never, isBlocked: false },
            ],
        },
        {
            id: 'group-2',
            label: 'Video',
            tracks: [
                { id: 'V1', type: 'VIDEO', events: [], player: null as never, isBlocked: false, isHidden: false },
            ],
        },
        {
            id: 'group-3',
            label: 'Audio',
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
    const [groups, setGroups] = useState<NLETrackGroup[]>(makeInitialGroups);

    const handleMoveEvent = (moves: NLEMoveResult[]) => {
        setGroups((prev) => {
            const next = prev.map((g) => ({
                ...g,
                tracks: g.tracks.map((t) => ({ ...t, events: [...t.events] })),
            }));
            for (const { fromTrackId, toTrackId, eventId, newTime } of moves) {
                if (fromTrackId === toTrackId) {
                    // Same track — update time only
                    for (const g of next) {
                        const track = g.tracks.find((t) => t.id === fromTrackId);
                        if (track) {
                            const ev = track.events.find((e) => e.id === eventId);
                            if (ev) ev.time = newTime;
                        }
                    }
                } else {
                    // Cross-track — remove from source, add to target
                    let movedEvent: TrackEvent | undefined;
                    for (const g of next) {
                        const src = g.tracks.find((t) => t.id === fromTrackId);
                        if (src) {
                            const idx = src.events.findIndex((e) => e.id === eventId);
                            if (idx !== -1) {
                                [movedEvent] = src.events.splice(idx, 1);
                            }
                        }
                    }
                    if (movedEvent) {
                        movedEvent.time = newTime;
                        for (const g of next) {
                            const dst = g.tracks.find((t) => t.id === toTrackId);
                            if (dst) dst.events.push(movedEvent);
                        }
                    }
                }
            }
            return next;
        });
    };

    const handleUpdateEvent = (trackId: string, eventId: number, time: number, duration: number) => {
        setGroups((prev) =>
            prev.map((g) => ({
                ...g,
                tracks: g.tracks.map((t) =>
                    t.id !== trackId
                        ? t
                        : {
                              ...t,
                              events: t.events.map((e) =>
                                  e.id !== eventId ? e : { ...e, time, duration },
                              ),
                          },
                ),
            })),
        );
    };

    const handleDeleteEvent = (trackId: string, eventId: number) => {
        setGroups((prev) =>
            prev.map((g) => ({
                ...g,
                tracks: g.tracks.map((t) =>
                    t.id !== trackId
                        ? t
                        : { ...t, events: t.events.filter((e) => e.id !== eventId) },
                ),
            })),
        );
    };

    return (
        <NLETimeline
            {...args}
            currentTimeRef={currentTimeRef}
            trackGroups={groups}
            onMoveEvent={handleMoveEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
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
