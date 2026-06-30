export function getFileDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const el = document.createElement(file.type.startsWith('video') ? 'video' : 'audio');
        const url = URL.createObjectURL(file);
        el.src = url;
        el.preload = 'metadata';
        el.onloadedmetadata = () => {
            const duration = el.duration;
            URL.revokeObjectURL(url);
            resolve(isFinite(duration) ? duration : 0);
        };
        el.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load media metadata'));
        };
    });
}

export function generateThumbnail(file: File): Promise<string> {
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
            try {
                const canvas = new OffscreenCanvas(160, 90);
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('No 2D context');
                ctx.drawImage(video, 0, 0, 160, 90);
                canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 }).then((blob) => {
                    URL.revokeObjectURL(url);
                    resolve(URL.createObjectURL(blob));
                });
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load video'));
        };
    });
}
