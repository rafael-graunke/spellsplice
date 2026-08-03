/**
 * Editor annotation on the timeline ruler. Deliberately NOT a TrackEvent:
 * markers never reach derivePlayerState, the overlay renderers, or the export.
 */
export interface Marker {
    id: string;
    time: number;
    name?: string;
    color: MarkerColor;
    /** Span in seconds. Absent or 0 = a point marker. */
    duration?: number;
}

export const MARKER_COLORS = [
    'red',
    'orange',
    'yellow',
    'green',
    'cyan',
    'blue',
    'violet',
] as const;

export type MarkerColor = (typeof MARKER_COLORS)[number];

export const DEFAULT_MARKER_COLOR: MarkerColor = 'cyan';

/** Explicit literals so Tailwind's scanner keeps these classes. */
export const MarkerColorMap: Record<MarkerColor, { bg: string; border: string; text: string }> = {
    red: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-500' },
    orange: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500' },
    yellow: { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-500' },
    green: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-500' },
    cyan: { bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-500' },
    blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500' },
    violet: { bg: 'bg-violet-500', border: 'border-violet-500', text: 'text-violet-500' },
};
