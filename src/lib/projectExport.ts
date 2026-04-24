import JSZip from 'jszip';
import type { Player } from '@/components/types/player';
import type { VideoState } from '@/components/types/video';
import { cardDataCache, restoreCardDataCache } from './cardCache';

export interface ProjectExport {
    version: '1';
    createdAt: string;
    video?: {
        filename: string;
        duration: number;
    };
    players: Player[];
}

export async function exportProject(players: Player[], video: VideoState | null) {
    const zip = new JSZip();

    const manifest: ProjectExport = {
        version: '1',
        createdAt: new Date().toISOString(),
        players,
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

    return { manifest, videoFile };
}
