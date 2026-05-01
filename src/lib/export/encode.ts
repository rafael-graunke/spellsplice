export class Encoder {
    private enc: VideoEncoder;
    private _error: unknown = null;

    constructor(
        codec: string,
        fps: number,
        width: number,
        height: number,
        onChunk: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void,
    ) {
        this.enc = new VideoEncoder({
            output: onChunk,
            error: (e) => { this._error = e; },
        });
        const config: VideoEncoderConfig = {
            codec, width, height, framerate: fps,
            bitrate: 20_000_000,
            latencyMode: 'realtime',
        };
        if (codec.startsWith('avc')) config.avc = { format: 'annexb' };
        this.enc.configure(config);
    }

    get error(): unknown { return this._error; }

    encode(frame: VideoFrame, isKeyFrame: boolean): void {
        this.enc.encode(frame, { keyFrame: isKeyFrame });
    }

    get encodeQueueSize(): number {
        return this.enc.encodeQueueSize;
    }

    async drainIfNeeded(frameIdx: number, interval: number): Promise<void> {
        if (frameIdx % interval === 0) await this.enc.flush();
    }

    async flush(): Promise<void> {
        await this.enc.flush();
    }

    close(): void {
        this.enc.close();
    }
}
