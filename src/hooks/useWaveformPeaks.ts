import { useState, useEffect, useRef } from 'react';
import type { MediaSource } from '../types/source';

const PEAKS_PER_SECOND = 100;

// decodeAudioData resamples to the context's rate. 8000 is the spec minimum and still gives
// 80 samples per peak; decoding at hardware rate costs 6x the memory and scan for nothing.
const DECODE_SAMPLE_RATE = 8000;

export interface WaveformData {
    peaks: Float32Array;
    duration: number;
}

async function extractPeaks(source: MediaSource): Promise<WaveformData> {
    if (!source.file) throw new Error('Source has no file');
    const buf = await source.file.arrayBuffer();
    const audioCtx = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE);
    const audioBuffer = await audioCtx.decodeAudioData(buf);

    const sampleRate = audioBuffer.sampleRate;
    const samplesPerPeak = Math.max(1, Math.floor(sampleRate / PEAKS_PER_SECOND));
    const channel = audioBuffer.getChannelData(0);
    const numPeaks = Math.ceil(channel.length / samplesPerPeak);
    const peaks = new Float32Array(numPeaks);

    for (let i = 0; i < numPeaks; i++) {
        let max = 0;
        const start = i * samplesPerPeak;
        const end = Math.min(start + samplesPerPeak, channel.length);
        for (let j = start; j < end; j++) {
            const abs = channel[j] < 0 ? -channel[j] : channel[j];
            if (abs > max) max = abs;
        }
        peaks[i] = max;
    }

    return { peaks, duration: audioBuffer.duration };
}

export function useWaveformPeaks(sources: MediaSource[]): Map<string, WaveformData> {
    const [waveformMap, setWaveformMap] = useState<Map<string, WaveformData>>(new Map());
    const pendingRef = useRef<Set<string>>(new Set());
    const mapRef = useRef(waveformMap);
    mapRef.current = waveformMap;

    useEffect(() => {
        for (const source of sources) {
            if (!source.file) continue;
            if (mapRef.current.has(source.id)) continue;
            if (pendingRef.current.has(source.id)) continue;

            pendingRef.current.add(source.id);
            extractPeaks(source)
                .then((data) => {
                    setWaveformMap((prev) => {
                        const next = new Map(prev);
                        next.set(source.id, data);
                        return next;
                    });
                })
                .catch(() => { /* ignore decode errors (e.g. video-only sources) */ })
                .finally(() => { pendingRef.current.delete(source.id); });
        }
    }, [sources]);

    return waveformMap;
}
