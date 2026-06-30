import JSZip from 'jszip';
import type { Player } from '@/components/types/player';
import type { ProjectConfig } from '@/components/types/config';
import type { Clip } from '@/components/types/clip';
import type { MediaSource } from '@/components/types/source';
import type { TrackOverrideRow } from '@/components/Timeline/hooks/usePlayerTracks';
import { cardDataCache, restoreCardDataCache } from './cardCache';

export type SourceMeta = Pick<MediaSource, 'id' | 'name' | 'duration' | 'type'>;

export interface ProjectExport {
    version: '1';
    createdAt: string;
    players: Player[];
    config?: ProjectConfig;
    clipsByTrack?: Record<string, Clip[]>;
    trackOverrides?: Record<string, TrackOverrideRow[]>;
    sources?: SourceMeta[];
}

export async function exportProject(
    players: Player[],
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
    };

    zip.file('project.json', JSON.stringify(manifest, null, 2));
    zip.file('card-data-cache.json', JSON.stringify(cardDataCache));

    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.sps';
    a.click();
    URL.revokeObjectURL(url);
}

export async function importProject(file: File): Promise<{
    manifest: ProjectExport;
    config: ProjectConfig | null;
    offlineSources: MediaSource[];
}> {
    const zip = await JSZip.loadAsync(file);

    const json = await zip.file('project.json')!.async('string');
    const manifest = JSON.parse(json) as ProjectExport;

    const cardCacheFile = zip.file('card-data-cache.json');
    if (cardCacheFile) {
        const cacheJson = await cardCacheFile.async('string');
        restoreCardDataCache(JSON.parse(cacheJson));
    }

    const offlineSources: MediaSource[] = (manifest.sources ?? []).map((s) => ({
        ...s,
        file: undefined,
    }));

    return { manifest, config: manifest.config ?? null, offlineSources };
}
