import { AudioLines } from 'lucide-react';
import type { MediaSource } from '../types/source';

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface SourceCardProps {
    source: MediaSource;
}

export function SourceCard({ source }: SourceCardProps) {
    const loading = source.loading;
    return (
        <div
            className={`flex flex-col rounded overflow-hidden border border-border bg-muted/30 text-xs ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
            draggable={!loading}
            onDragStart={loading ? undefined : (e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData(
                    'application/x-spellsplice-source',
                    JSON.stringify({ sourceId: source.id, sourceType: source.type }),
                );
            }}
        >
            <div className="relative w-full aspect-video bg-muted flex items-center justify-center">
                {source.type === 'video' ? (
                    source.thumbnailUrl ? (
                        <img
                            src={source.thumbnailUrl}
                            alt={source.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-muted animate-pulse" />
                    )
                ) : (
                    <AudioLines className="w-6 h-6 text-muted-foreground" />
                )}
                <span className="absolute bottom-1 right-1 bg-black/70 text-white rounded px-1 leading-none py-0.5">
                    {formatDuration(source.duration)}
                </span>
            </div>
            <div className="px-1.5 py-1 truncate text-foreground/80" title={source.name}>
                {source.name}
            </div>
        </div>
    );
}
