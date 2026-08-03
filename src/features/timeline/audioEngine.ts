import type { Clip } from '../../types/clip';
import type { MediaSource } from '../../types/source';

/**
 * Web Audio mixing engine for the preview. Decodes each source once to an
 * AudioBuffer and schedules one AudioBufferSourceNode per clip occurrence
 * (per-clip GainNode for mute -> master GainNode for volume -> destination).
 *
 * This is how editors/DAWs mix: the AudioContext is a sample-accurate master
 * clock, clips are scheduled once with start(when, offset, duration) and stop
 * themselves, so overlapping clips mix cleanly with no re-seeking, and two
 * clips of the same source are just two source nodes over one shared buffer.
 *
 * Timing mirrors the rest of the app: a clip plays source[sourceOffset ..
 * sourceOffset+duration] at output time [clip.time .. clip.time+duration].
 */

interface Voice {
    src: AudioBufferSourceNode;
    gain: GainNode;
    clipId: string;
}

const VOLUME_RAMP = 0.02; // seconds; avoids zipper noise on volume/mute changes.
const SCHEDULE_LOOKAHEAD = 0.03; // seconds of headroom when anchoring the transport.

export class AudioEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private buffers = new Map<string, AudioBuffer>();
    // Callbacks waiting on an in-flight decode, keyed by source id. Multiple
    // clips of the same source must ALL be notified when the buffer lands.
    private pending = new Map<string, Array<(buffer: AudioBuffer) => void>>();
    // Keyed by a unique voice id (NOT clip id) so overlapping clips — including
    // two that happen to share a clip id — each get an independent voice.
    private voices = new Map<number, Voice>();
    private nextVoiceId = 0;

    // Transport anchor: output time `startOutput` corresponds to context time
    // `startCtxTime`. getOutputTime() maps the running ctx clock back to output.
    private startCtxTime = 0;
    private startOutput = 0;
    private playing = false;
    // Bumped on every play/seek/reschedule so stale async decode->schedule
    // callbacks from a previous transport don't fire late.
    private epoch = 0;

    private volume = 1;
    private mutedTrackIds = new Set<string>();

    private ensureContext(): AudioContext {
        if (!this.ctx) {
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.ctx.destination);
        }
        return this.ctx;
    }

    get isPlaying(): boolean {
        return this.playing;
    }

    /** Output time (seconds) derived from the AudioContext clock. */
    getOutputTime(): number {
        if (!this.ctx) return this.startOutput;
        return this.startOutput + (this.ctx.currentTime - this.startCtxTime);
    }

    /**
     * Resolve a source's decoded AudioBuffer, invoking `cb` synchronously if it's
     * already cached, else once the (deduped) decode completes. All callbacks
     * queued for the same in-flight decode fire — so overlapping clips of one
     * source each get scheduled.
     */
    private requestBuffer(source: MediaSource, cb: (buffer: AudioBuffer) => void): void {
        const cached = this.buffers.get(source.id);
        if (cached) { cb(cached); return; }
        if (!source.file) return;
        const waiting = this.pending.get(source.id);
        if (waiting) { waiting.push(cb); return; }
        const ctx = this.ensureContext();
        this.pending.set(source.id, [cb]);
        source.file
            .arrayBuffer()
            .then((buf) => ctx.decodeAudioData(buf))
            .then((audioBuf) => {
                this.buffers.set(source.id, audioBuf);
                const cbs = this.pending.get(source.id) ?? [];
                this.pending.delete(source.id);
                for (const c of cbs) c(audioBuf);
            })
            .catch((err) => {
                this.pending.delete(source.id);
                if (import.meta.env.DEV) {
                    console.warn(`[audio] decode failed for "${source.name}" — clip will be silent`, err);
                }
            });
    }

    /** Start playback of all audio clips from `outputTime`. */
    play(
        outputTime: number,
        clips: Clip[],
        sources: MediaSource[],
        volume: number,
        mutedTrackIds: Set<string>,
    ): void {
        const ctx = this.ensureContext();
        void ctx.resume();
        this.volume = volume;
        this.mutedTrackIds = new Set(mutedTrackIds);
        if (this.masterGain) this.masterGain.gain.value = volume;
        this.playing = true;
        this.anchorAndSchedule(outputTime, clips, sources);
    }

    /** Re-anchor the transport at `outputTime` and (re)schedule every clip. */
    seek(outputTime: number, clips: Clip[], sources: MediaSource[]): void {
        if (!this.playing) return;
        this.anchorAndSchedule(outputTime, clips, sources);
    }

    /** Reschedule after clip edits while playing (from the live output time). */
    reschedule(clips: Clip[], sources: MediaSource[]): void {
        if (!this.playing) return;
        this.anchorAndSchedule(this.getOutputTime(), clips, sources);
    }

    private anchorAndSchedule(outputTime: number, clips: Clip[], sources: MediaSource[]): void {
        const ctx = this.ensureContext();
        this.stopAllVoices();
        this.epoch++;
        const epoch = this.epoch;
        this.startCtxTime = ctx.currentTime + SCHEDULE_LOOKAHEAD;
        this.startOutput = outputTime;

        const sourceById = new Map(sources.map((s) => [s.id, s]));
        for (const clip of clips) {
            const source = sourceById.get(clip.sourceId);
            if (!source) continue;
            // Already fully in the past — nothing to play.
            if (clip.time + clip.duration <= outputTime) continue;
            const cached = this.buffers.get(source.id);
            if (cached) {
                this.scheduleClip(clip, outputTime, cached);
            } else {
                this.requestBuffer(source, (buffer) => {
                    // Buffer arrived after we anchored: schedule from the live
                    // output time, if this transport is still current.
                    if (epoch !== this.epoch || !this.playing) return;
                    this.scheduleClip(clip, this.getOutputTime(), buffer);
                });
            }
        }
    }

    private scheduleClip(clip: Clip, fromOutput: number, known?: AudioBuffer): void {
        const ctx = this.ctx;
        if (!ctx || !this.masterGain) return;
        const buffer = known ?? this.buffers.get(clip.sourceId);
        if (!buffer) return;

        const playFrom = Math.max(clip.time, fromOutput);
        const clipEnd = clip.time + clip.duration;
        if (clipEnd <= playFrom) return;

        let offset = clip.sourceOffset + (playFrom - clip.time);
        let dur = clipEnd - playFrom;
        // Clamp to the buffer: a clip may be longer than its source.
        if (offset >= buffer.duration) return;
        dur = Math.min(dur, buffer.duration - offset);
        if (dur <= 0) return;
        offset = Math.max(0, offset);

        const whenCtx = this.startCtxTime + (playFrom - this.startOutput);
        const when = Math.max(ctx.currentTime, whenCtx);

        const gain = ctx.createGain();
        gain.gain.value = this.isClipMuted(clip) ? 0 : 1;
        gain.connect(this.masterGain);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(gain);
        const voiceId = this.nextVoiceId++;
        const voice: Voice = { src, gain, clipId: clip.id };
        src.onended = () => {
            this.voices.delete(voiceId);
            try {
                src.disconnect();
                gain.disconnect();
            } catch {
                // already torn down
            }
        };
        this.voices.set(voiceId, voice);
        src.start(when, offset, dur);
    }

    private isClipMuted(clip: Clip): boolean {
        return clip.trackId ? this.mutedTrackIds.has(clip.trackId) : false;
    }

    private stopAllVoices(): void {
        for (const { src } of this.voices.values()) {
            src.onended = null;
            try {
                src.stop();
                src.disconnect();
            } catch {
                // not started / already stopped
            }
        }
        this.voices.clear();
    }

    pause(): void {
        this.playing = false;
        this.epoch++;
        this.stopAllVoices();
    }

    setVolume(volume: number): void {
        this.volume = volume;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, VOLUME_RAMP);
        }
    }

    setMuted(mutedTrackIds: Set<string>, clips: Clip[]): void {
        this.mutedTrackIds = new Set(mutedTrackIds);
        if (!this.ctx) return;
        const clipById = new Map(clips.map((c) => [c.id, c]));
        for (const voice of this.voices.values()) {
            const clip = clipById.get(voice.clipId);
            if (!clip) continue;
            const target = this.isClipMuted(clip) ? 0 : 1;
            voice.gain.gain.setTargetAtTime(target, this.ctx.currentTime, VOLUME_RAMP);
        }
    }

    dispose(): void {
        this.pause();
        this.buffers.clear();
        this.pending.clear();
        if (this.ctx) {
            void this.ctx.close();
            this.ctx = null;
            this.masterGain = null;
        }
    }
}
