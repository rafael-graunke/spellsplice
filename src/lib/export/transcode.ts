import type { AudioTrackMeta } from './demux';

export async function transcodeToOpus(
    sourceMeta: AudioTrackMeta,
    sourceChunks: EncodedAudioChunk[],
): Promise<{ chunks: EncodedAudioChunk[]; meta: AudioTrackMeta }> {
    const OUTPUT_RATE = 48000;
    const outputChunks: EncodedAudioChunk[] = [];
    let opusDescription = new Uint8Array(0);
    let firstChunkSeen = false;
    let encoderError: unknown = null;
    let decoderError: unknown = null;

    const encoder = new AudioEncoder({
        output: (chunk, meta) => {
            if (!firstChunkSeen) {
                firstChunkSeen = true;
                const desc = meta?.decoderConfig?.description;
                if (desc) {
                    if (desc instanceof ArrayBuffer) {
                        opusDescription = new Uint8Array(desc);
                    } else if (ArrayBuffer.isView(desc)) {
                        opusDescription = new Uint8Array(desc.buffer as ArrayBuffer, desc.byteOffset, desc.byteLength);
                    }
                }
            }
            outputChunks.push(chunk);
        },
        error: (e) => { encoderError = e; },
    });
    encoder.configure({
        codec: 'opus',
        sampleRate: OUTPUT_RATE,
        numberOfChannels: sourceMeta.numberOfChannels,
        bitrate: 128000,
    });

    const decoder = new AudioDecoder({
        output: (audioData) => {
            encoder.encode(audioData);
            audioData.close();
        },
        error: (e) => { decoderError = e; },
    });
    decoder.configure({
        codec: sourceMeta.codec,
        sampleRate: sourceMeta.sampleRate,
        numberOfChannels: sourceMeta.numberOfChannels,
        ...(sourceMeta.description.byteLength > 0 ? { description: sourceMeta.description } : {}),
    });

    for (const chunk of sourceChunks) {
        decoder.decode(chunk);
    }
    await decoder.flush();
    if (decoderError) throw decoderError;
    await encoder.flush();
    if (encoderError) throw encoderError;
    encoder.close();
    decoder.close();

    return {
        chunks: outputChunks,
        meta: {
            codec: 'opus',
            sampleRate: OUTPUT_RATE,
            numberOfChannels: sourceMeta.numberOfChannels,
            description: opusDescription,
        },
    };
}
