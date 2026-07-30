export type ContainerFormat = 'mp4' | 'webm';

export async function pickCodec(fps: number): Promise<{ codec: string; format: ContainerFormat }> {
    for (const [codec, format, audioCodec] of [
        ['avc1.64002a', 'mp4', 'mp4a.40.2'],
        ['vp09.00.10.08', 'webm', 'opus'],
    ] as const) {
        const [videoSupport, audioSupport] = await Promise.all([
            VideoEncoder.isConfigSupported({ codec, width: 1920, height: 1080, framerate: fps, bitrate: 20_000_000 }),
            AudioEncoder.isConfigSupported({ codec: audioCodec, sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 }),
        ]);
        if (videoSupport.supported && audioSupport.supported) return { codec, format };
    }
    throw new Error('No supported video encoder found. Try Chrome on a recent OS.');
}

export async function openSaveDialog(format: ContainerFormat): Promise<FileSystemWritableFileStream> {
    const ext = format === 'mp4' ? 'mp4' : 'webm';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle: FileSystemFileHandle = await (window as any).showSaveFilePicker({
        suggestedName: `spellsplice-export-${Date.now()}.${ext}`,
        types: [{ description: 'Video File', accept: { [`video/${ext}`]: [`.${ext}`] } }],
    });
    return handle.createWritable();
}
