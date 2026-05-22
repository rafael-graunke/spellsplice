import { useState, useEffect, useMemo } from 'react';
import type { MediaSource } from '@/components/types/source';

export interface ClipThumbnails {
    start?: string;
    end?: string;
}

export interface ClipInfo {
    id: string;
    sourceId: string;
    sourceOffset: number;
    duration: number;
}

// `${sourceId}:${time.toFixed(3)}` → blob URL
const frameCache = new Map<string, string>();
const framePromiseCache = new Map<string, Promise<string>>();
// Serial queue — one extraction active at a time
let extractionQueue: Promise<void> = Promise.resolve();

async function doExtractFrame(source: MediaSource, targetTime: number): Promise<string> {
    const objectUrl = URL.createObjectURL(source.file!);
    const video = document.createElement('video');
    video.preload = 'auto';

    try {
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Metadata timeout')), 15000);
            video.onloadedmetadata = () => { clearTimeout(timeout); resolve(); };
            video.onerror = () => { clearTimeout(timeout); reject(new Error('Video load error')); };
            video.src = objectUrl;
        });

        video.currentTime = targetTime;

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Seek timeout')), 10000);
            video.onseeked = () => { clearTimeout(timeout); resolve(); };
            video.onerror = () => { clearTimeout(timeout); reject(new Error('Seek error')); };
        });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);

        return await new Promise<string>((resolve, reject) => {
            canvas.toBlob(
                (blob) => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('toBlob failed')),
                'image/jpeg',
                0.8,
            );
        });
    } finally {
        URL.revokeObjectURL(objectUrl);
        video.src = '';
    }
}

function getOrExtractFrame(source: MediaSource, targetTime: number): Promise<string> {
    const key = `${source.id}:${targetTime.toFixed(3)}`;
    if (frameCache.has(key)) return Promise.resolve(frameCache.get(key)!);
    if (framePromiseCache.has(key)) return framePromiseCache.get(key)!;

    const promise: Promise<string> = new Promise((resolve, reject) => {
        extractionQueue = extractionQueue.then(async () => {
            if (frameCache.has(key)) { resolve(frameCache.get(key)!); return; }
            try {
                const url = await doExtractFrame(source, targetTime);
                frameCache.set(key, url);
                resolve(url);
            } catch (e) {
                framePromiseCache.delete(key);
                reject(e);
            }
        });
    });

    framePromiseCache.set(key, promise);
    return promise;
}

export function useVideoThumbnails(sources: MediaSource[], clips: ClipInfo[]): Map<string, ClipThumbnails> {
    const [map, setMap] = useState<Map<string, ClipThumbnails>>(new Map());

    const sourceMap = useMemo(() => {
        const m = new Map<string, MediaSource>();
        for (const s of sources) m.set(s.id, s);
        return m;
    }, [sources]);

    useEffect(() => {
        let cancelled = false;

        for (const clip of clips) {
            const source = sourceMap.get(clip.sourceId);
            if (!source || source.type !== 'video' || source.loading || !source.file) continue;

            const startTime = clip.sourceOffset;
            const endTime = clip.sourceOffset + Math.max(0, clip.duration - 0.1);

            getOrExtractFrame(source, startTime).then((url) => {
                if (cancelled) return;
                setMap((prev) => new Map([...prev, [clip.id, { ...prev.get(clip.id), start: url }]]));
            }).catch(() => {});

            if (Math.abs(endTime - startTime) > 0.5) {
                getOrExtractFrame(source, endTime).then((url) => {
                    if (cancelled) return;
                    setMap((prev) => new Map([...prev, [clip.id, { ...prev.get(clip.id), end: url }]]));
                }).catch(() => {});
            }
        }

        return () => { cancelled = true; };
    }, [clips, sourceMap]);

    return map;
}
