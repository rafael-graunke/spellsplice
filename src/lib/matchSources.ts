import type { MediaSource } from '@/types/source';

export type MatchConfidence = 'exact' | 'strong' | 'weak' | 'none';

export interface SourceMatch {
    sourceId: string;
    file?: File;
    confidence: MatchConfidence;
    /** Short human-readable justification, shown under the row in the relink dialog. */
    reason: string;
}

/** A file offered as a relink candidate, plus the path it was found at (if known). */
export interface CandidateFile {
    file: File;
    relativePath?: string;
}

export function fingerprintOf(file: File): Pick<MediaSource, 'size' | 'lastModified' | 'relativePath'> {
    return {
        size: file.size,
        lastModified: file.lastModified,
        relativePath: file.webkitRelativePath || undefined,
    };
}

export function toCandidates(files: FileList | File[]): CandidateFile[] {
    return Array.from(files).map((file) => ({
        file,
        relativePath: file.webkitRelativePath || undefined,
    }));
}

export function kindOf(file: File): MediaSource['type'] | null {
    if (file.type.startsWith('video')) return 'video';
    if (file.type.startsWith('audio')) return 'audio';
    if (file.type.startsWith('image')) return 'image';
    return null;
}

function basename(path: string): string {
    const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return i === -1 ? path : path.slice(i + 1);
}

function normalizeName(name: string): string {
    return basename(name)
        .toLowerCase()
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/** Dice coefficient over character bigrams. 1 = identical, 0 = nothing in common. */
function similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const bigrams = new Map<string, number>();
    for (let i = 0; i < a.length - 1; i++) {
        const g = a.slice(i, i + 2);
        bigrams.set(g, (bigrams.get(g) ?? 0) + 1);
    }
    let hits = 0;
    for (let i = 0; i < b.length - 1; i++) {
        const g = b.slice(i, i + 2);
        const count = bigrams.get(g) ?? 0;
        if (count > 0) {
            bigrams.set(g, count - 1);
            hits++;
        }
    }
    return (2 * hits) / (a.length + b.length - 2);
}

interface Scored {
    score: number;
    confidence: MatchConfidence;
    reason: string;
}

const DURATION_TIGHT = 0.05;
const DURATION_LOOSE = 0.1;
const FUZZY_MIN = 0.8;

/**
 * Scores one (source, candidate) pair. Returns null when the pair is
 * disqualified: type is a hard filter, never a weighted signal, because a video
 * and an audio file are never the same media no matter how well the names line
 * up.
 */
function scorePair(source: MediaSource, cand: CandidateFile, duration?: number): Scored | null {
    const kind = kindOf(cand.file);
    if (kind === null || kind !== source.type) return null;

    const sameName = source.name === cand.file.name;
    const sameSize = source.size !== undefined && source.size === cand.file.size;
    const sameDate = source.lastModified !== undefined && source.lastModified === cand.file.lastModified;
    const samePath =
        source.relativePath !== undefined &&
        cand.relativePath !== undefined &&
        source.relativePath === cand.relativePath;

    if (sameSize && sameDate) return { score: 100, confidence: 'exact', reason: 'size + date' };
    if (sameSize && sameName) return { score: 95, confidence: 'exact', reason: 'size + name' };
    if (samePath) return { score: 90, confidence: 'exact', reason: 'path' };

    const dur = duration ?? (source.type === 'image' ? 0 : undefined);
    const durDelta =
        dur !== undefined && source.duration > 0 ? Math.abs(source.duration - dur) : undefined;

    if (sameName && durDelta !== undefined && durDelta < DURATION_LOOSE)
        return { score: 80, confidence: 'strong', reason: 'name + duration' };
    if (sameName) return { score: 60, confidence: 'strong', reason: 'name' };

    const fuzzy = similarity(normalizeName(source.name), normalizeName(cand.file.name));
    if (fuzzy >= FUZZY_MIN && durDelta !== undefined && durDelta < DURATION_LOOSE)
        return { score: 50, confidence: 'weak', reason: 'similar name + duration' };
    if (durDelta !== undefined && durDelta < DURATION_TIGHT)
        return { score: 40, confidence: 'weak', reason: 'duration' };
    if (fuzzy >= FUZZY_MIN) return { score: 30, confidence: 'weak', reason: 'similar name' };

    return null;
}

/**
 * Assigns candidate files to sources.
 *
 * Assignment is globally greedy, not per-source-best: every pair is scored, the
 * list is sorted descending, and a pair is taken only when both its source and
 * its file are still unclaimed. Picking each source's own best match
 * independently lets two sources claim the same file, and whichever is resolved
 * second silently ends up with nothing.
 *
 * `durations` is optional and keyed by File. Without it the metadata tiers
 * (size/date/path/name) still run; duration only breaks ties that those leave
 * open, which is why probing is a deliberate second pass rather than a
 * precondition.
 */
export function matchSources(
    sources: MediaSource[],
    candidates: CandidateFile[],
    durations?: Map<File, number>,
): SourceMatch[] {
    const pairs: Array<{ sourceId: string; cand: CandidateFile } & Scored> = [];
    for (const source of sources) {
        for (const cand of candidates) {
            const scored = scorePair(source, cand, durations?.get(cand.file));
            if (scored) pairs.push({ sourceId: source.id, cand, ...scored });
        }
    }
    pairs.sort((a, b) => b.score - a.score);

    const bySource = new Map<string, SourceMatch>();
    const claimed = new Set<File>();
    for (const pair of pairs) {
        if (bySource.has(pair.sourceId) || claimed.has(pair.cand.file)) continue;
        bySource.set(pair.sourceId, {
            sourceId: pair.sourceId,
            file: pair.cand.file,
            confidence: pair.confidence,
            reason: pair.reason,
        });
        claimed.add(pair.cand.file);
    }

    return sources.map(
        (s) => bySource.get(s.id) ?? { sourceId: s.id, confidence: 'none' as const, reason: 'no match' },
    );
}

/** Files left over after an assignment, in input order. Drives the manual override picker. */
export function unclaimedFiles(candidates: CandidateFile[], matches: SourceMatch[]): CandidateFile[] {
    const claimed = new Set(matches.map((m) => m.file).filter(Boolean));
    return candidates.filter((c) => !claimed.has(c.file));
}
