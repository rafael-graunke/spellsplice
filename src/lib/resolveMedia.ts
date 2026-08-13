import type { MediaSource } from '@/types/source';
import { getMediaMetadata } from './generateThumbnail';
import { collectFiles, ensureReadPermission, getMediaRoot } from './mediaRoots';
import {
    matchSources,
    unclaimedFiles,
    type CandidateFile,
    type SourceMatch,
} from './matchSources';

// Probing decodes each file's header, so it is bounded on both axes: only the
// leftovers of a metadata-only pass are probed, and never more than this many.
const MAX_PROBE = 60;
const PROBE_CONCURRENCY = 4;

export interface MediaResolution {
    matches: SourceMatch[];
    /**
     * Every file the walk turned up, not just the matched ones. The dialog needs
     * the full list to offer overrides, otherwise a wrong auto-match can only be
     * corrected by re-picking the folder.
     */
    candidates: CandidateFile[];
    /** A media folder is remembered for this project. */
    hasRoot: boolean;
    /** A folder is remembered but its permission lapsed; needs a user gesture to re-grant. */
    needsPermission: boolean;
    rootName?: string;
}

async function probeDurations(candidates: CandidateFile[]): Promise<Map<File, number>> {
    const targets = candidates.slice(0, MAX_PROBE);
    const durations = new Map<File, number>();
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(PROBE_CONCURRENCY, targets.length) }, async () => {
            while (next < targets.length) {
                const { file } = targets[next++];
                try {
                    durations.set(file, (await getMediaMetadata(file)).duration);
                } catch {
                    // Undecodable file simply stays out of the duration tiers.
                }
            }
        }),
    );
    return durations;
}

/**
 * Matches candidates against sources, probing durations only if the free
 * metadata tiers left something unmatched. The common case (media that was
 * merely reloaded, not renamed) resolves without decoding a single file.
 */
export async function matchCandidates(
    sources: MediaSource[],
    candidates: CandidateFile[],
): Promise<SourceMatch[]> {
    const first = matchSources(sources, candidates);
    if (first.every((m) => m.confidence !== 'none')) return first;

    const leftovers = unclaimedFiles(candidates, first);
    if (leftovers.length === 0) return first;

    return matchSources(sources, candidates, await probeDurations(leftovers));
}

/**
 * Attempts to reattach a project's offline media from its remembered folder.
 * Queries permission only — see ensureReadPermission on why requesting here
 * would fail.
 */
export async function resolveMedia(
    projectId: string,
    sources: MediaSource[],
): Promise<MediaResolution> {
    const empty = { matches: [], candidates: [], hasRoot: false, needsPermission: false };

    const offline = sources.filter((s) => !s.file);
    if (offline.length === 0) return empty;

    const handle = await getMediaRoot(projectId);
    if (!handle) return empty;

    if (!(await ensureReadPermission(handle)))
        return {
            matches: [],
            candidates: [],
            hasRoot: true,
            needsPermission: true,
            rootName: handle.name,
        };

    const candidates = await collectFiles(handle);
    return {
        matches: await matchCandidates(offline, candidates),
        candidates,
        hasRoot: true,
        needsPermission: false,
        rootName: handle.name,
    };
}
