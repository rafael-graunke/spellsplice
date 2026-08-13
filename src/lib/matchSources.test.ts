import { describe, expect, it } from 'vitest';
import type { MediaSource } from '@/types/source';
import { matchSources, toCandidates, unclaimedFiles } from './matchSources';

function src(over: Partial<MediaSource> & { id: string; name: string }): MediaSource {
    return { type: 'video', duration: 60, ...over };
}

function file(name: string, opts: { size?: number; lastModified?: number; type?: string } = {}): File {
    const f = new File(['x'], name, {
        type: opts.type ?? 'video/mp4',
        lastModified: opts.lastModified ?? 1000,
    });
    if (opts.size !== undefined) Object.defineProperty(f, 'size', { value: opts.size });
    return f;
}

describe('matchSources', () => {
    it('matches on size + lastModified even when the file was renamed', () => {
        const sources = [src({ id: 'a', name: 'cam-a.mp4', size: 500, lastModified: 42 })];
        const files = [file('renamed.mp4', { size: 500, lastModified: 42 })];

        const [match] = matchSources(sources, toCandidates(files));
        expect(match.confidence).toBe('exact');
        expect(match.reason).toBe('size + date');
        expect(match.file).toBe(files[0]);
    });

    it('never matches across media types', () => {
        const sources = [src({ id: 'a', name: 'take.wav', type: 'audio', size: 500, lastModified: 42 })];
        const files = [file('take.wav', { size: 500, lastModified: 42, type: 'video/mp4' })];

        expect(matchSources(sources, toCandidates(files))[0].confidence).toBe('none');
    });

    it('prefers relative path over bare name for same-named files in sibling folders', () => {
        const sources = [
            src({ id: 'a', name: 'cam.mp4', relativePath: 'seat-1/cam.mp4' }),
            src({ id: 'b', name: 'cam.mp4', relativePath: 'seat-2/cam.mp4' }),
        ];
        const candidates = [
            { file: file('cam.mp4'), relativePath: 'seat-2/cam.mp4' },
            { file: file('cam.mp4'), relativePath: 'seat-1/cam.mp4' },
        ];

        const matches = matchSources(sources, candidates);
        expect(matches[0].file).toBe(candidates[1].file);
        expect(matches[1].file).toBe(candidates[0].file);
        expect(matches.every((m) => m.reason === 'path')).toBe(true);
    });

    it('does not let two sources claim the same file', () => {
        const sources = [
            src({ id: 'a', name: 'cam.mp4', size: 500, lastModified: 42 }),
            src({ id: 'b', name: 'cam.mp4' }),
        ];
        const files = [file('cam.mp4', { size: 500, lastModified: 42 })];

        const matches = matchSources(sources, toCandidates(files));
        expect(matches[0].file).toBe(files[0]);
        expect(matches[1].file).toBeUndefined();
        expect(matches[1].confidence).toBe('none');
    });

    it('uses duration to promote a fuzzy name match', () => {
        const sources = [src({ id: 'a', name: 'commentary take 2.wav', type: 'audio', duration: 120 })];
        const files = [file('commentary-take-2.wav', { type: 'audio/wav' })];
        const durations = new Map([[files[0], 120]]);

        const [match] = matchSources(sources, toCandidates(files), durations);
        expect(match.confidence).toBe('weak');
        expect(match.reason).toBe('similar name + duration');
    });

    it('rejects a name match whose duration is wrong when nothing else fits', () => {
        const sources = [src({ id: 'a', name: 'cam-a.mp4', duration: 60 })];
        const files = [file('cam-a.mp4')];
        const durations = new Map([[files[0], 12]]);

        // Name alone still matches (score 60) — duration only downgrades the
        // reason, it cannot veto an exact filename hit.
        const [match] = matchSources(sources, toCandidates(files), durations);
        expect(match.reason).toBe('name');
        expect(match.confidence).toBe('strong');
    });

    it('reports files nothing claimed', () => {
        const sources = [src({ id: 'a', name: 'cam-a.mp4' })];
        const files = [file('cam-a.mp4'), file('unrelated-b-roll.mp4')];
        const candidates = toCandidates(files);

        const matches = matchSources(sources, candidates);
        expect(unclaimedFiles(candidates, matches).map((c) => c.file.name)).toEqual([
            'unrelated-b-roll.mp4',
        ]);
    });
});
