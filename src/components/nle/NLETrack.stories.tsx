import type { Meta, StoryObj } from '@storybook/react-vite';
import { TrackInfo, Track, TrackGroup } from './NLETrack';
import { useTimelineScroll } from './hooks/useTimelineScroll';
import { TrackType } from '../types/nle';

const meta: Meta = { title: 'NLE/NLETrack' };
export default meta;

export const TrackInfoEvent: StoryObj = {
    render: () => (
        <TrackInfo
            trackId="E1"
            type={TrackType.Event}
            isBlocked={false}
            isHidden={false}
            onToggleBlocked={() => {}}
            onToggleHidden={() => {}}
        />
    ),
};

export const TrackInfoVideo: StoryObj = {
    render: () => (
        <TrackInfo
            trackId="V1"
            type={TrackType.Video}
            isBlocked={false}
            isHidden={false}
            onToggleBlocked={() => {}}
            onToggleHidden={() => {}}
        />
    ),
};

export const TrackInfoAudio: StoryObj = {
    render: () => (
        <TrackInfo
            trackId="A1"
            type={TrackType.Audio}
            isBlocked={false}
            isMuted={false}
            onToggleBlocked={() => {}}
            onToggleMuted={() => {}}
        />
    ),
};

export const TrackInfoBlocked: StoryObj = {
    render: () => (
        <TrackInfo
            trackId="E2"
            type={TrackType.Event}
            isBlocked={true}
            isHidden={false}
            onToggleBlocked={() => {}}
            onToggleHidden={() => {}}
        />
    ),
};

export const TrackInfoHidden: StoryObj = {
    render: () => (
        <TrackInfo
            trackId="V2"
            type={TrackType.Video}
            isBlocked={false}
            isHidden={true}
            onToggleBlocked={() => {}}
            onToggleHidden={() => {}}
        />
    ),
};

function TrackHarness({ type, id }: { type: (typeof TrackType)[keyof typeof TrackType]; id: string }) {
    const { scrollLeftRef, subscribe } = useTimelineScroll();
    const track = { id, type, events: [], player: null as never, isBlocked: false, isHidden: false, isMuted: false };
    return (
        <div className="w-[600px]">
            <Track
                track={track}
                trackId={id}
                duration={120}
                zoom={5}
                paddingX={20}
                scrollLeftRef={scrollLeftRef}
                subscribe={subscribe}
                onToggleBlocked={() => {}}
                onToggleHidden={() => {}}
                onToggleMuted={() => {}}
            />
        </div>
    );
}

export const TrackEvent: StoryObj = {
    render: () => <TrackHarness type={TrackType.Event} id="E1" />,
};

export const TrackVideo: StoryObj = {
    render: () => <TrackHarness type={TrackType.Video} id="V1" />,
};

export const TrackAudio: StoryObj = {
    render: () => <TrackHarness type={TrackType.Audio} id="A1" />,
};

function TrackGroupHarness() {
    const { scrollLeftRef, subscribe } = useTimelineScroll();
    const makeTrack = (id: string, type: (typeof TrackType)[keyof typeof TrackType]) => ({
        id, type, events: [], player: null as never, isBlocked: false, isHidden: false, isMuted: false,
    });
    const tracks = [
        makeTrack('E1', TrackType.Event),
        makeTrack('E2', TrackType.Event),
        makeTrack('E3', TrackType.Event),
    ];
    return (
        <div className="w-[600px]">
            <TrackGroup label="Events">
                {tracks.map((t) => (
                    <Track
                        key={t.id}
                        track={t}
                        trackId={t.id}
                        duration={120}
                        zoom={5}
                        paddingX={20}
                        scrollLeftRef={scrollLeftRef}
                        subscribe={subscribe}
                        onToggleBlocked={() => {}}
                        onToggleHidden={() => {}}
                        onToggleMuted={() => {}}
                    />
                ))}
            </TrackGroup>
        </div>
    );
}

export const TrackGroupEvents: StoryObj = {
    render: () => <TrackGroupHarness />,
};

function MultiGroupHarness() {
    const { scrollLeftRef, subscribe } = useTimelineScroll();
    const makeTrack = (id: string, type: (typeof TrackType)[keyof typeof TrackType]) => ({
        id, type, events: [], player: null as never, isBlocked: false, isHidden: false, isMuted: false,
    });
    return (
        <div className="w-[600px] flex flex-col gap-2">
            <TrackGroup label="Events">
                {[makeTrack('E1', TrackType.Event), makeTrack('E2', TrackType.Event)].map((t) => (
                    <Track key={t.id} track={t} trackId={t.id} duration={120} zoom={5} paddingX={20}
                        scrollLeftRef={scrollLeftRef} subscribe={subscribe}
                        onToggleBlocked={() => {}} onToggleHidden={() => {}} />
                ))}
            </TrackGroup>
            <TrackGroup label="Video">
                {[makeTrack('V1', TrackType.Video)].map((t) => (
                    <Track key={t.id} track={t} trackId={t.id} duration={120} zoom={5} paddingX={20}
                        scrollLeftRef={scrollLeftRef} subscribe={subscribe}
                        onToggleBlocked={() => {}} onToggleHidden={() => {}} />
                ))}
            </TrackGroup>
            <TrackGroup label="Audio">
                {[makeTrack('A1', TrackType.Audio), makeTrack('A2', TrackType.Audio)].map((t) => (
                    <Track key={t.id} track={t} trackId={t.id} duration={120} zoom={5} paddingX={20}
                        scrollLeftRef={scrollLeftRef} subscribe={subscribe}
                        onToggleBlocked={() => {}} onToggleMuted={() => {}} />
                ))}
            </TrackGroup>
        </div>
    );
}

export const MultiGroup: StoryObj = {
    render: () => <MultiGroupHarness />,
};
