import JSZip from 'jszip';
import type { Player } from '@/types/player';
import type { ProjectConfig } from '@/types/config';
import type { Clip } from '@/types/clip';
import type { MediaSource } from '@/types/source';
import type { TrackOverrideRow } from '@/features/timeline/hooks/usePlayerTracks';
import { cardDataCache, restoreCardDataCache } from './cardCache';

export type SourceMeta = Pick<MediaSource, 'id' | 'name' | 'duration' | 'type' | 'width' | 'height'>;

function sanitizeFilename(name: string): string {
    return name
        .trim()
        .replace(/[/\\?%*:|"<>]/g, '')
        .trim();
}

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

    const sourceMeta: SourceMeta[] = sources.map(({ id, name, duration, type, width, height }) => ({
        id,
        name,
        duration,
        type,
        width,
        height,
    }));

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

    const zipBytes = await zip.generateAsync({ type: 'uint8array' });
    // Prepend magic header so WhatsApp/Windows don't detect ZIP magic bytes and rename to .zip
    const magic = new Uint8Array([0x53, 0x50, 0x4c, 0x53]); // "SPLS"
    const out = new Uint8Array(magic.length + zipBytes.length);
    out.set(magic, 0);
    out.set(zipBytes, magic.length);
    const blob = new Blob([out], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(config.title) || 'Untitled'}.sps`;
    a.click();
    URL.revokeObjectURL(url);
}

export async function importProject(file: File): Promise<{
    manifest: ProjectExport;
    config: ProjectConfig | null;
    offlineSources: MediaSource[];
}> {
    const raw = await file.arrayBuffer();
    const magic = new Uint8Array([0x53, 0x50, 0x4c, 0x53]);
    const header = new Uint8Array(raw, 0, 4);
    const hasMagic = header.every((b, i) => b === magic[i]);
    const zipData = hasMagic ? raw.slice(4) : raw;
    const zip = await JSZip.loadAsync(zipData);

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
