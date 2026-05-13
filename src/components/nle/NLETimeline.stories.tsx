import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NLETimeline } from './NLETimeline';
import type { NLETrackGroup } from '../types/nle';

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

const mockGroups: NLETrackGroup[] = [
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

function Wrapper(args: React.ComponentProps<typeof NLETimeline>) {
    const currentTimeRef = useRef(0);
    return <NLETimeline {...args} currentTimeRef={currentTimeRef} />;
}

export const Default: Story = {
    render: (args) => <Wrapper {...args} />,
    args: {
        duration: 120,
        isPlaying: false,
        setIsPlaying: () => {},
        setCurrentTime: () => {},
        trackGroups: mockGroups,
        onUndo: () => {},
        onRedo: () => {},
        canUndo: false,
        canRedo: false,
    },
};
