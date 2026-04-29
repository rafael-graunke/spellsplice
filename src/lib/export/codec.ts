export type ContainerFormat = 'mp4' | 'webm';

export async function pickCodec(fps: number): Promise<{ codec: string; format: ContainerFormat }> {
    for (const [codec, format] of [
        ['avc1.42001f', 'mp4'],
        ['vp09.00.10.08', 'webm'],
    ] as const) {
        const { supported } = await VideoEncoder.isConfigSupported({
            codec, width: 1920, height: 1080, framerate: fps,
            bitrateMode: 'variable', bitrate: 2_000_000,
        });
        if (supported) return { codec, format };
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
