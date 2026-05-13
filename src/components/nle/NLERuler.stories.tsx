import { useRef, useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import NLERuler from './NLERuler';
import { useTimelineScroll } from './hooks/useTimelineScroll';
import { useTimelineZoom } from './hooks/useTimelineZoom';

const meta: Meta = { title: 'NLE/NLERuler' };
export default meta;

function RulerHarness({ duration = 120, paddingX = 0 }: { duration?: number, paddingX?: number }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollLeftRef, setScroll, setMaxScroll, subscribe } = useTimelineScroll();
    const { zoom, zoomRef, setZoom } = useTimelineZoom();
    const seekTimeRef = useRef(0);
    const [seekTime, setSeekTime] = useState(0);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const delta = e.deltaY > 0 ? -2 : 2;
                const newScroll = setZoom(zoomRef.current + delta, e.clientX, scrollLeftRef.current);
                setScroll(newScroll);
            } else {
                setScroll(scrollLeftRef.current + e.deltaX + e.deltaY);
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [scrollLeftRef, setScroll, setZoom, zoomRef]);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="text-xs text-zinc-500">
                Scroll: wheel · Zoom: Ctrl+wheel · Seek: click
            </div>
            <div
                ref={containerRef}
                className="h-10 bg-zinc-900 border border-zinc-800 rounded overflow-hidden"
            >
                <NLERuler
                    duration={duration}
                    zoom={zoom}
                    scrollLeftRef={scrollLeftRef}
                    subscribe={subscribe}
                    onSeek={(t) => { seekTimeRef.current = t; setSeekTime(t); }}
                    setScroll={setScroll}
                    setMaxScroll={setMaxScroll}
                    paddingX={paddingX}
                />
            </div>
            <div className="text-xs text-zinc-500">
                zoom: {zoom.toFixed(1)} px/sec &nbsp;|&nbsp; seek: {seekTime.toFixed(2)}s
            </div>
        </div>
    );
}

export const Default: StoryObj = {
    render: () => <RulerHarness duration={120} />,
};

export const LongDuration: StoryObj = {
    render: () => <RulerHarness duration={600} />,
};

export const WithPadding: StoryObj = {
    render: () => <RulerHarness duration={120} paddingX={20} />,
};