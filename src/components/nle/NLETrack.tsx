import { useRef, useEffect } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Eye, EyeOff, Lock, Volume2, VolumeOff } from 'lucide-react';
import type { NLETrack as NLETrackType } from '../types/nle';
import { TrackType, TrackTypeColorMap } from '../types/nle';
import {
    TRACK_HEIGHT,
    TRACK_INFO_WIDTH,
    TRACK_GROUP_LABEL_WIDTH,
} from '../Timeline/constants';
import { cn } from '@/lib/utils';

interface TrackGroupProps {
    children: ReactNode;
    label: string;
}

export function TrackGroup({ children, label }: TrackGroupProps) {
    return (
            <div className="flex flex-row h-full overflow-hidden">
                <div
                    style={{ width: TRACK_GROUP_LABEL_WIDTH }}
                    className="bg-zinc-800 text-zinc-300 rounded-l-md flex items-center justify-center text-md border-l border-y border-zinc-700"
                >
                    <p className="[writing-mode:sideways-lr]">{label}</p>
                </div>
                <div className="flex flex-col-reverse flex-1 bg-zinc-800 overflow-y-auto scrollbar-thin border-y border-l border-zinc-700">
                    {children}
                </div>
            </div>
    );
}

interface TrackInfoProps {
    trackId: string;
    type: NLETrackType['type'];
    isBlocked: boolean;
    isHidden?: boolean;
    isMuted?: boolean;
    onToggleBlocked: () => void;
    onToggleHidden?: () => void;
    onToggleMuted?: () => void;
}

export function TrackInfo({
    trackId,
    type,
    isBlocked,
    isHidden,
    isMuted,
    onToggleBlocked,
    onToggleHidden,
    onToggleMuted,
}: TrackInfoProps) {
    const showVisibility = type === TrackType.Event || type === TrackType.Video;
    const showMute = type === TrackType.Audio;

    return (
        <div
            className="shrink-0 flex items-center justify-between bg-zinc-900"
            style={{ width: TRACK_INFO_WIDTH, height: TRACK_HEIGHT }}
        >
            <span
                className={cn(
                    'text-sm font-bold text-zinc-200 w-10 h-full flex items-center justify-center',
                    TrackTypeColorMap[type]
                )}
            >
                {trackId}
            </span>
            <div className="h-full w-full border-t border-zinc-700 flex items-center justify-end">
                <div className="flex items-center gap-1 px-2">
                    {showVisibility && (
                        <button
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                            onClick={onToggleHidden}
                        >
                            {isHidden ? (
                                <EyeOff size={14} />
                            ) : (
                                <Eye size={14} />
                            )}
                        </button>
                    )}
                    {showMute && (
                        <button
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                            onClick={onToggleMuted}
                        >
                            {isMuted ? (
                                <VolumeOff size={14} />
                            ) : (
                                <Volume2 size={14} />
                            )}
                        </button>
                    )}
                    <button
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        onClick={onToggleBlocked}
                    >
                        <Lock
                            size={14}
                            className={isBlocked ? 'text-amber-400' : ''}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
}

interface TrackContentProps {
    children?: ReactNode;
    duration: number;
    zoom: number;
    paddingX?: number;
    scrollLeftRef: RefObject<number>;
    subscribe: (fn: (x: number) => void) => () => void;
}

export function TrackContent({
    children,
    duration,
    zoom,
    paddingX = 0,
    scrollLeftRef,
    subscribe,
}: TrackContentProps) {
    const innerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        return subscribe((x) => {
            if (innerRef.current)
                innerRef.current.style.transform = `translateX(${-x}px)`;
        });
    }, [subscribe]);

    return (
        <div
            className="flex-1 overflow-hidden border-t border-zinc-700 relative"
            style={{ height: TRACK_HEIGHT }}
        >
            <div
                ref={innerRef}
                className="absolute inset-y-0"
                style={{
                    left: paddingX,
                    width: duration * zoom,
                    transform: `translateX(${-(scrollLeftRef.current ?? 0)}px)`,
                }}
            >
                {children}
            </div>
        </div>
    );
}

interface TrackProps {
    track: NLETrackType;
    trackId: string;
    duration: number;
    zoom: number;
    paddingX?: number;
    scrollLeftRef: RefObject<number>;
    subscribe: (fn: (x: number) => void) => () => void;
    children?: ReactNode;
    onToggleBlocked: () => void;
    onToggleHidden?: () => void;
    onToggleMuted?: () => void;
}

export function Track({
    track,
    trackId,
    duration,
    zoom,
    paddingX = 0,
    scrollLeftRef,
    subscribe,
    children,
    onToggleBlocked,
    onToggleHidden,
    onToggleMuted,
}: TrackProps) {
    return (
        <div className="flex flex-row w-full">
            <TrackInfo
                trackId={trackId}
                type={track.type}
                isBlocked={track.isBlocked}
                isHidden={track.isHidden}
                isMuted={track.isMuted}
                onToggleBlocked={onToggleBlocked}
                onToggleHidden={onToggleHidden}
                onToggleMuted={onToggleMuted}
            />
            <TrackContent
                duration={duration}
                zoom={zoom}
                paddingX={paddingX}
                scrollLeftRef={scrollLeftRef}
                subscribe={subscribe}
            >
                {children}
            </TrackContent>
        </div>
    );
}
