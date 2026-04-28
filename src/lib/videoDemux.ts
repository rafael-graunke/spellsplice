import { createFile, DataStream, Endianness } from 'mp4box';
import type { ISOFile, Sample } from 'mp4box';

export interface VideoTrackMeta {
    config: VideoDecoderConfig;
    fps: number;
    duration: number;
}

function getDescription(mp4file: ISOFile, trackId: number): Uint8Array {
    const trak = mp4file.getTrackById(trackId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = (trak as any).mdia.minf.stbl.stsd.entries[0];
    const box = entry.avcC ?? entry.hvcC ?? entry.vpcC ?? entry.av1C;
    if (!box) return new Uint8Array(0);
    const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN);
    box.write(stream);
    // skip 4-byte size + 4-byte fourCC box type header
    return new Uint8Array((stream as unknown as { buffer: ArrayBuffer }).buffer, 8);
}

async function feedFile(mp4: ISOFile, file: File, signal: AbortSignal): Promise<void> {
    const CHUNK = 10 * 1024 * 1024;
    let offset = 0;
    while (offset < file.size) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const slice = file.slice(offset, offset + CHUNK);
        const ab = await slice.arrayBuffer() as ArrayBuffer & { fileStart: number };
        ab.fileStart = offset;
        const next = mp4.appendBuffer(ab);
        offset = next ?? (offset + CHUNK);
    }
    mp4.flush();
}

export function getVideoTrackMeta(file: File): Promise<VideoTrackMeta> {
    return new Promise((resolve, reject) => {
        const mp4 = createFile();
        const controller = new AbortController();

        mp4.onReady = (info) => {
            const track = info.videoTracks[0];
            if (!track) { reject(new Error('No video track found')); return; }

            const description = getDescription(mp4, track.id);
            const config: VideoDecoderConfig = {
                codec: track.codec,
                codedWidth: track.video!.width,
                codedHeight: track.video!.height,
                ...(description.byteLength > 0 ? { description } : {}),
            };

            const fps = track.nb_samples / (track.duration / track.timescale);
            const duration = track.movie_duration / track.movie_timescale;

            controller.abort();
            resolve({ config, fps, duration });
        };

        mp4.onError = (_module: string, message: string) => reject(new Error(message));

        feedFile(mp4, file, controller.signal).catch((err) => {
            if (!(err instanceof DOMException && err.name === 'AbortError')) reject(err);
        });
    });
}

export async function* streamVideoChunks(
    file: File,
    signal: AbortSignal,
): AsyncGenerator<EncodedVideoChunk> {
    const queue: EncodedVideoChunk[] = [];
    let resolve: (() => void) | null = null;
    let done = false;
    let error: unknown = null;

    const push = (chunk: EncodedVideoChunk) => {
        queue.push(chunk);
        resolve?.();
        resolve = null;
    };

    const wait = () => new Promise<void>((r) => {
        if (queue.length > 0) r();
        else resolve = r;
    });

    const mp4 = createFile();
    let trackId = -1;

    mp4.onReady = (info) => {
        const track = info.videoTracks[0];
        if (!track) { error = new Error('No video track found'); resolve?.(); return; }
        trackId = track.id;
        mp4.setExtractionOptions(trackId, null, { nbSamples: 100 });
        mp4.start();
    };

    mp4.onSamples = (_id: number, _user: unknown, samples: Sample[]) => {
        for (const s of samples) {
            if (!s.data) continue;
            push(new EncodedVideoChunk({
                type: s.is_sync ? 'key' : 'delta',
                timestamp: (s.cts / s.timescale) * 1e6,
                duration: (s.duration / s.timescale) * 1e6,
                data: s.data,
            }));
        }
    };

    mp4.onError = (_module: string, message: string) => {
        error = new Error(message);
        resolve?.();
    };

    feedFile(mp4, file, signal)
        .then(() => { done = true; resolve?.(); })
        .catch((err) => {
            if (err instanceof DOMException && err.name === 'AbortError') {
                done = true;
            } else {
                error = err;
            }
            resolve?.();
        });

    while (true) {
        await wait();
        if (error) throw error;
        while (queue.length > 0) yield queue.shift()!;
        if (done) break;
    }
}
