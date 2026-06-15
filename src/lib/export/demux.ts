import { createFile, DataStream, Endianness } from 'mp4box';
import type { ISOFile, Sample } from 'mp4box';

export interface VideoTrackMeta {
    config: VideoDecoderConfig;
    fps: number;
    duration: number;
}

export interface AudioTrackMeta {
    sampleRate: number;
    numberOfChannels: number;
    codec: string;
    description: Uint8Array;
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

function getAudioDescription(mp4file: ISOFile, trackId: number): Uint8Array {
    const trak = mp4file.getTrackById(trackId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = (trak as any).mdia.minf.stbl.stsd.entries[0];
    // AudioSpecificConfig lives in: stsd entry → esds → ESD → DecoderConfigDescriptor → DecoderSpecificInfo → data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const asc: Uint8Array | undefined = (entry as any)?.esds?.esd?.descs?.[0]?.descs?.[0]?.descs?.[0]?.data;
    return asc ?? new Uint8Array(0);
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

export function getAudioTrackMeta(file: File): Promise<AudioTrackMeta | null> {
    return new Promise((resolve, reject) => {
        const mp4 = createFile();
        const controller = new AbortController();

        mp4.onReady = (info) => {
            const track = info.audioTracks[0];
            if (!track) { controller.abort(); resolve(null); return; }

            if (!track.audio) { controller.abort(); resolve(null); return; }
            const description = getAudioDescription(mp4, track.id);
            controller.abort();
            resolve({
                sampleRate: track.audio.sample_rate,
                numberOfChannels: track.audio.channel_count,
                codec: track.codec,
                description,
            });
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

// Decode any browser-supported audio file (MP3, WAV, OGG, FLAC, M4A, etc.) via the Web Audio API
// and encode the requested clip regions to AAC. This is used for audio-only MediaSources where
// mp4box cannot parse the container.
export async function extractAudioFromFile(
    file: File,
    clips: ReadonlyArray<{ sourceOffset: number; duration: number; time: number }>,
    signal: AbortSignal,
    targetCodec: 'mp4a.40.2' | 'opus' = 'mp4a.40.2',
): Promise<{ chunks: EncodedAudioChunk[]; meta: AudioTrackMeta } | null> {
    let arrayBuffer: ArrayBuffer;
    try {
        arrayBuffer = await file.arrayBuffer();
    } catch {
        return null;
    }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const audioCtx = new AudioContext();
    let audioBuffer: AudioBuffer;
    try {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch {
        return null; // Unsupported format
    } finally {
        audioCtx.close();
    }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const { sampleRate, numberOfChannels } = audioBuffer;

    const encoderConfig = targetCodec === 'opus'
        ? { codec: 'opus' as const, sampleRate, numberOfChannels, bitrate: 128000 }
        : { codec: 'mp4a.40.2' as const, sampleRate, numberOfChannels, bitrate: 128000 };
    const support = await AudioEncoder.isConfigSupported(encoderConfig);
    if (!support.supported) {
        throw new Error(
            `${targetCodec === 'mp4a.40.2' ? 'AAC' : 'Opus'} audio encoding is not supported in this browser. ` +
            (targetCodec === 'mp4a.40.2'
                ? 'Try exporting as WebM, or use a video file with built-in audio instead of a separate audio file.'
                : 'Opus encoding should be available in all Chromium-based browsers.'),
        );
    }

    const outputChunks: EncodedAudioChunk[] = [];
    let description = new Uint8Array(0);
    let firstOutput = true;
    let encoderError: unknown = null;

    const encoder = new AudioEncoder({
        output: (chunk, meta) => {
            if (firstOutput) {
                firstOutput = false;
                const desc = meta?.decoderConfig?.description;
                if (desc instanceof ArrayBuffer) {
                    description = new Uint8Array(desc);
                } else if (ArrayBuffer.isView(desc)) {
                    description = new Uint8Array(desc.buffer as ArrayBuffer, desc.byteOffset, desc.byteLength);
                }
            }
            outputChunks.push(chunk);
        },
        error: (e) => { encoderError = e; },
    });
    encoder.configure(encoderConfig);

    const FRAME_SIZE = 1024; // AAC frame size
    for (const clip of clips) {
        if (signal.aborted) break;
        const startFrame = Math.floor(clip.sourceOffset * sampleRate);
        const endFrame = Math.min(Math.ceil((clip.sourceOffset + clip.duration) * sampleRate), audioBuffer.length);
        for (let offset = startFrame; offset < endFrame; offset += FRAME_SIZE) {
            if (signal.aborted) break;
            const frames = Math.min(FRAME_SIZE, endFrame - offset);
            const timestamp = Math.round((clip.time + (offset - startFrame) / sampleRate) * 1e6);
            const data = new Float32Array(numberOfChannels * frames);
            for (let c = 0; c < numberOfChannels; c++) {
                data.set(audioBuffer.getChannelData(c).subarray(offset, offset + frames), c * frames);
            }
            const audioData = new AudioData({ format: 'f32-planar', sampleRate, numberOfChannels, numberOfFrames: frames, timestamp, data });
            encoder.encode(audioData);
            audioData.close();
        }
    }

    try {
        await encoder.flush();
    } catch {
        // encoder may have closed due to error; throw that instead
    }
    encoder.close();
    if (encoderError) throw encoderError;

    return {
        chunks: outputChunks,
        meta: { codec: targetCodec, sampleRate, numberOfChannels, description },
    };
}

export async function* streamAudioChunks(
    file: File,
    signal: AbortSignal,
): AsyncGenerator<EncodedAudioChunk> {
    const queue: EncodedAudioChunk[] = [];
    let resolve: (() => void) | null = null;
    let done = false;
    let error: unknown = null;

    const push = (chunk: EncodedAudioChunk) => {
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
        const track = info.audioTracks[0];
        if (!track) { done = true; resolve?.(); return; }
        trackId = track.id;
        mp4.setExtractionOptions(trackId, null, { nbSamples: 100 });
        mp4.start();
    };

    mp4.onSamples = (_id: number, _user: unknown, samples: Sample[]) => {
        for (const s of samples) {
            if (!s.data) continue;
            push(new EncodedAudioChunk({
                type: 'key',
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
