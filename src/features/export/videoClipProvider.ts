import { streamVideoChunks } from './demux';

/**
 * A stateful decode cursor for ONE video clip during export. Streams the clip's
 * source, decodes on demand, and yields the frame nearest a requested source
 * time. Source time is requested monotonically increasing (a clip plays
 * forward), so the cursor only ever advances — cheap and leak-free.
 *
 * One provider per active clip lets overlapping clips (and clips from different-
 * codec sources) be composited together, unlike the old single-decoder loop.
 */
export class VideoClipProvider {
    private decoder: VideoDecoder;
    private gen: AsyncGenerator<EncodedVideoChunk>;
    private buffer: VideoFrame[] = [];
    private current: VideoFrame | null = null;
    private streamDone = false;
    private error: unknown = null;

    constructor(file: File, config: VideoDecoderConfig, signal: AbortSignal) {
        this.decoder = new VideoDecoder({
            output: (f) => this.buffer.push(f),
            error: (e) => { this.error = e; },
        });
        this.decoder.configure(config);
        this.gen = streamVideoChunks(file, signal);
    }

    /** Feed one chunk and let the decoder's async output callbacks run. */
    private async pump(): Promise<void> {
        if (this.streamDone) return;
        const { value, done } = await this.gen.next();
        if (done || !value) {
            await this.decoder.flush().catch(() => {});
            this.streamDone = true;
            return;
        }
        this.decoder.decode(value);
        while (this.decoder.decodeQueueSize > 10) {
            await new Promise<void>((r) => setTimeout(r, 0));
        }
        // Yield so queued output() callbacks push into the buffer.
        await new Promise<void>((r) => setTimeout(r, 0));
    }

    private hasFramePast(srcSec: number): boolean {
        for (const f of this.buffer) if (f.timestamp / 1e6 > srcSec) return true;
        return false;
    }

    /**
     * The decoded frame to show at output source time `srcSec` — the newest frame
     * with timestamp <= srcSec, held across output frames when the source fps is
     * lower than the export fps. Returns null before the first frame decodes.
     */
    async frameAt(srcSec: number): Promise<VideoFrame | null> {
        // Decode until a frame strictly past srcSec is buffered (so `current` is
        // final — the decoder emits in presentation order) or the stream ends.
        while (!this.streamDone && !this.hasFramePast(srcSec)) {
            await this.pump();
            if (this.error) throw this.error;
        }
        // Presentation order is guaranteed, but sort defensively.
        this.buffer.sort((a, b) => a.timestamp - b.timestamp);
        while (this.buffer.length && this.buffer[0].timestamp / 1e6 <= srcSec) {
            if (this.current) this.current.close();
            this.current = this.buffer.shift()!;
        }
        if (this.error) throw this.error;
        return this.current;
    }

    dispose(): void {
        try { this.decoder.close(); } catch { /* already closed */ }
        if (this.current) { this.current.close(); this.current = null; }
        for (const f of this.buffer) f.close();
        this.buffer.length = 0;
        void this.gen.return?.(undefined);
    }
}
