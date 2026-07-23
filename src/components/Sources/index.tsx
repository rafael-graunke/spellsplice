import React, { useRef, useCallback, useMemo } from 'react';
import { FolderOpen, Link2 } from 'lucide-react';
import type { MediaSource } from '../types/source';
import type { Clip } from '../types/clip';
import { SourceCard } from './SourceCard';
import { getFileDuration, generateThumbnail } from '../../lib/generateThumbnail';

interface SourcesProps {
    sources: MediaSource[];
    setSources: React.Dispatch<React.SetStateAction<MediaSource[]>>;
    clipsByTrack: Record<string, Clip[]>;
    onOpenRelinkDialog: () => void;
    onRelink?: (sourceId: string, file: File) => void;
    onDelete?: (sourceId: string) => void;
}

function SourcesInner({ sources, setSources, clipsByTrack, onOpenRelinkDialog, onRelink, onDelete }: SourcesProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = React.useState(false);

    const addFiles = useCallback(
        async (files: FileList | File[]) => {
            for (const file of Array.from(files)) {
                if (!file.type.startsWith('video') && !file.type.startsWith('audio')) continue;
                const type = file.type.startsWith('video') ? 'video' : 'audio';
                const source: MediaSource = {
                    id: crypto.randomUUID(),
                    name: file.name,
                    type,
                    duration: 0,
                    file,
                    loading: true,
                };
                setSources((prev) => [...prev, source]);

                const duration = await getFileDuration(file).catch(() => 0);
                const thumbnailUrl =
                    type === 'video' ? await generateThumbnail(file).catch(() => undefined) : undefined;

                setSources((prev) =>
                    prev.map((s) => (s.id === source.id ? { ...s, duration, thumbnailUrl, loading: false } : s)),
                );
            }
        },
        [setSources],
    );

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            addFiles(e.dataTransfer.files);
        },
        [addFiles],
    );

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const onDragLeave = () => setIsDragOver(false);

    const clipCountBySource = useMemo(() => {
        const counts = new Map<string, number>();
        for (const clips of Object.values(clipsByTrack)) {
            for (const clip of clips) {
                counts.set(clip.sourceId, (counts.get(clip.sourceId) ?? 0) + 1);
            }
        }
        return counts;
    }, [clipsByTrack]);

    const hasOffline = sources.some((s) => !s.file && !s.loading);

    return (
        <div
            className={`h-full flex flex-col transition-colors ${isDragOver ? 'bg-primary/10' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
        >
            <div className="flex items-center justify-between px-3 h-8 border-b border-border shrink-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    Sources
                    {hasOffline && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive" />
                    )}
                </span>
                <div className="flex items-center gap-0.5">
                    <button
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Manage sources"
                        onClick={onOpenRelinkDialog}
                    >
                        <Link2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Add files"
                        onClick={() => inputRef.current?.click()}
                    >
                        <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    accept="video/*,audio/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files) addFiles(e.target.files);
                        e.target.value = '';
                    }}
                />
            </div>

            {sources.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                    Drop video or audio files
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 content-start">
                    {sources.map((source) => (
                        <SourceCard
                            key={source.id}
                            source={source}
                            clipCount={clipCountBySource.get(source.id)}
                            onRelink={onRelink ? (file) => onRelink(source.id, file) : undefined}
                            onDelete={onDelete ? () => onDelete(source.id) : undefined}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Memoized so App's ~10Hz playback re-renders don't reconcile the source list
// (its props are stable during playback).
export const Sources = React.memo(SourcesInner);
