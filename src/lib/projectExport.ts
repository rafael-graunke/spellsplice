import JSZip from 'jszip';
import type { Player } from '@/components/types/player';
import type { VideoState } from '@/components/types/video';
import type { ProjectConfig } from '@/components/types/config';
import type { Clip } from '@/components/types/clip';
import type { MediaSource } from '@/components/types/source';
import type { TrackOverrideRow } from '@/components/Timeline/hooks/usePlayerTracks';
import { cardDataCache, restoreCardDataCache } from './cardCache';

export type SourceMeta = Pick<MediaSource, 'id' | 'name' | 'duration' | 'type'>;

export interface ProjectExport {
    version: '1';
    createdAt: string;
    video?: {
        filename: string;
        duration: number;
    };
    players: Player[];
    config?: ProjectConfig;
    clipsByTrack?: Record<string, Clip[]>;
    trackOverrides?: Record<string, TrackOverrideRow[]>;
    sources?: SourceMeta[];
}

export async function exportProject(
    players: Player[],
    video: VideoState | null,
    config: ProjectConfig,
    clipsByTrack: Record<string, Clip[]>,
    trackOverrides: Record<string, TrackOverrideRow[]>,
    sources: MediaSource[],
) {
    const zip = new JSZip();

    const sourceMeta: SourceMeta[] = sources.map(({ id, name, duration, type }) => ({ id, name, duration, type }));

    const manifest: ProjectExport = {
        version: '1',
        createdAt: new Date().toISOString(),
        players,
        config,
        clipsByTrack,
        trackOverrides,
        sources: sourceMeta,
        ...(video && { video: { filename: video.file.name, duration: video.duration } }),
    };

    zip.file('project.json', JSON.stringify(manifest, null, 2));
    if (video) zip.folder('video')!.file(video.file.name, video.file);
    zip.file('card-data-cache.json', JSON.stringify(cardDataCache));

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.spellsplice';
    a.click();
    URL.revokeObjectURL(url);
}

export async function importProject(file: File): Promise<{
    manifest: ProjectExport;
    videoFile: File | null;
    config: ProjectConfig | null;
    offlineSources: MediaSource[];
}> {
    const zip = await JSZip.loadAsync(file);

    const json = await zip.file('project.json')!.async('string');
    const manifest = JSON.parse(json) as ProjectExport;

    let videoFile: File | null = null;
    if (manifest.video) {
        const entry = zip.file(`video/${manifest.video.filename}`);
        if (entry) {
            const blob = await entry.async('blob');
            videoFile = new File([blob], manifest.video.filename);
        }
    }

    const cardCacheFile = zip.file('card-data-cache.json');
    if (cardCacheFile) {
        const cacheJson = await cardCacheFile.async('string');
        restoreCardDataCache(JSON.parse(cacheJson));
    }

    const offlineSources: MediaSource[] = (manifest.sources ?? []).map((s) => ({
        ...s,
        file: undefined,
    }));

    return { manifest, videoFile, config: manifest.config ?? null, offlineSources };
}
