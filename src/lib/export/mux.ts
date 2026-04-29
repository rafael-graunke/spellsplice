import type { AudioTrackMeta } from './demux';

export interface MuxerHandle {
    addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void;
    feedAudioUpTo(chunks: EncodedAudioChunk[], timestampUs: number): void;
    finalize(): void;
}

export async function createMuxer(
    format: 'mp4' | 'webm',
    writableStream: FileSystemWritableFileStream,
    opts: { fps: number; width: number; height: number; audioMeta: AudioTrackMeta | null },
): Promise<MuxerHandle> {
    const { fps, width, height, audioMeta } = opts;

    if (format === 'mp4') {
        const { Muxer, FileSystemWritableFileStreamTarget } = await import('mp4-muxer');
        const muxer = new Muxer({
            target: new FileSystemWritableFileStreamTarget(writableStream),
            video: { codec: 'avc', width, height, frameRate: fps },
            audio: audioMeta
                ? { codec: 'aac', sampleRate: audioMeta.sampleRate, numberOfChannels: audioMeta.numberOfChannels }
                : undefined,
            firstTimestampBehavior: 'offset',
            fastStart: false,
        });

        let audioIdx = 0;
        let audioMetaSent = false;

        return {
            addVideoChunk: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            feedAudioUpTo: (chunks, timestampUs) => {
                if (!audioMeta) return;
                while (audioIdx < chunks.length && chunks[audioIdx].timestamp <= timestampUs) {
                    const chunkMeta = !audioMetaSent ? {
                        decoderConfig: {
                            codec: audioMeta.codec,
                            sampleRate: audioMeta.sampleRate,
                            numberOfChannels: audioMeta.numberOfChannels,
                            ...(audioMeta.description.byteLength > 0 ? { description: audioMeta.description } : {}),
                        },
                    } : undefined;
                    muxer.addAudioChunk(chunks[audioIdx++], chunkMeta);
                    audioMetaSent = true;
                }
            },
            finalize: () => muxer.finalize(),
        };
    } else {
        const { Muxer, FileSystemWritableFileStreamTarget } = await import('webm-muxer');
        const muxer = new Muxer({
            target: new FileSystemWritableFileStreamTarget(writableStream),
            video: { codec: 'V_VP9', width, height, frameRate: fps },
            audio: audioMeta
                ? { codec: 'A_OPUS', sampleRate: audioMeta.sampleRate, numberOfChannels: audioMeta.numberOfChannels }
                : undefined,
            firstTimestampBehavior: 'offset',
        });

        let audioIdx = 0;
        let audioMetaSent = false;

        return {
            addVideoChunk: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            feedAudioUpTo: (chunks, timestampUs) => {
                if (!audioMeta) return;
                while (audioIdx < chunks.length && chunks[audioIdx].timestamp <= timestampUs) {
                    const chunkMeta = !audioMetaSent ? {
                        decoderConfig: {
                            codec: 'opus',
                            sampleRate: audioMeta.sampleRate,
                            numberOfChannels: audioMeta.numberOfChannels,
                            ...(audioMeta.description.byteLength > 0 ? { description: audioMeta.description } : {}),
                        },
                    } : undefined;
                    muxer.addAudioChunk(chunks[audioIdx++], chunkMeta);
                    audioMetaSent = true;
                }
            },
            finalize: () => muxer.finalize(),
        };
    }
}
