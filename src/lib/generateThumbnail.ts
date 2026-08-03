export interface MediaMetadata {
    duration: number;
    /** Intrinsic pixel dimensions; 0 when not applicable (audio). */
    width: number;
    height: number;
}

function mediaKind(file: File): 'video' | 'audio' | 'image' {
    if (file.type.startsWith('image')) return 'image';
    if (file.type.startsWith('video')) return 'video';
    return 'audio';
}

/** Read duration + intrinsic dimensions from a media file. */
export function getMediaMetadata(file: File): Promise<MediaMetadata> {
    const kind = mediaKind(file);
    const url = URL.createObjectURL(file);

    if (kind === 'image') {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve({ duration: 0, width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image metadata'));
            };
            img.src = url;
        });
    }

    return new Promise((resolve, reject) => {
        const el = document.createElement(kind);
        el.src = url;
        el.preload = 'metadata';
        el.onloadedmetadata = () => {
            const duration = el.duration;
            const width = kind === 'video' ? (el as HTMLVideoElement).videoWidth : 0;
            const height = kind === 'video' ? (el as HTMLVideoElement).videoHeight : 0;
            URL.revokeObjectURL(url);
            resolve({ duration: isFinite(duration) ? duration : 0, width, height });
        };
        el.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load media metadata'));
        };
    });
}

/** Back-compat: duration only. Prefer getMediaMetadata for new callers. */
export async function getFileDuration(file: File): Promise<number> {
    return (await getMediaMetadata(file)).duration;
}

/** Capture a thumbnail (160×90 JPEG data URL) for a video or image file. */
export function generateThumbnail(file: File): Promise<string> {
    if (file.type.startsWith('image')) return generateImageThumbnail(file);
    return generateVideoThumbnail(file);
}

function toThumbnailBlob(source: CanvasImageSource): Promise<string> {
    const canvas = new OffscreenCanvas(160, 90);
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new Error('No 2D context'));
    ctx.drawImage(source, 0, 0, 160, 90);
    return canvas
        .convertToBlob({ type: 'image/jpeg', quality: 0.7 })
        .then((blob) => URL.createObjectURL(blob));
}

function generateImageThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            toThumbnailBlob(img)
                .then((thumb) => {
                    URL.revokeObjectURL(url);
                    resolve(thumb);
                })
                .catch((err) => {
                    URL.revokeObjectURL(url);
                    reject(err);
                });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };
        img.src = url;
    });
}

function generateVideoThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);
        video.src = url;
        video.preload = 'metadata';
        video.muted = true;

        video.onloadedmetadata = () => {
            video.currentTime = Math.min(0.5, video.duration * 0.1);
        };

        video.onseeked = () => {
            toThumbnailBlob(video)
                .then((thumb) => {
                    URL.revokeObjectURL(url);
                    resolve(thumb);
                })
                .catch((err) => {
                    URL.revokeObjectURL(url);
                    reject(err);
                });
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load video'));
        };
    });
}
