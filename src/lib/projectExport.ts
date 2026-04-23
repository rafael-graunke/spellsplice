import JSZip from 'jszip';
import type { Player } from '@/components/types/player';
import type { VideoState } from '@/components/types/video';
import {
    serializeImageCache, restoreImageCache,
    serializeBorderCropCache, restoreBorderCropCache,
    serializeFrameCache, restoreFrameCache,
} from './cardCache';

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

    const cachedImages = await serializeImageCache();
    for (const [key, imgBlob] of cachedImages) {
        zip.folder('images')!.file(`${encodeURIComponent(key)}.jpg`, imgBlob);
    }

    const cachedBorderCrops = await serializeBorderCropCache();
    for (const [key, imgBlob] of cachedBorderCrops) {
        zip.folder('border-crops')!.file(`${encodeURIComponent(key)}.jpg`, imgBlob);
    }

    zip.file('frame-cache.json', JSON.stringify(serializeFrameCache()));

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

    const imageEntries = new Map<string, Blob>();
    const imagesFolder = zip.folder('images');
    if (imagesFolder) {
        const tasks: Promise<void>[] = [];
        imagesFolder.forEach((relativePath, file) => {
            const key = decodeURIComponent(relativePath.replace(/\.jpg$/, ''));
            tasks.push(file.async('blob').then((blob) => { imageEntries.set(key, blob); }));
        });
        await Promise.all(tasks);
    }
    restoreImageCache(imageEntries);

    const borderCropEntries = new Map<string, Blob>();
    const borderCropsFolder = zip.folder('border-crops');
    if (borderCropsFolder) {
        const tasks: Promise<void>[] = [];
        borderCropsFolder.forEach((relativePath, file) => {
            const key = decodeURIComponent(relativePath.replace(/\.jpg$/, ''));
            tasks.push(file.async('blob').then((blob) => { borderCropEntries.set(key, blob); }));
        });
        await Promise.all(tasks);
    }
    restoreBorderCropCache(borderCropEntries);

    const frameCacheFile = zip.file('frame-cache.json');
    if (frameCacheFile) {
        const json = await frameCacheFile.async('string');
        restoreFrameCache(JSON.parse(json));
    }

    return { manifest, videoFile };
}
