export interface MediaSource {
    id: string;
    name: string;
    type: 'video' | 'audio' | 'image';
    duration: number;
    file?: File;
    thumbnailUrl?: string;
    loading?: boolean;
    /** Intrinsic pixel dimensions of the source (video/image); absent for audio. */
    width?: number;
    height?: number;
    // Relink fingerprint, captured from the File when the source is added or
    // relinked and round-tripped through the project file. size+lastModified
    // identifies a file that has been renamed or moved; relativePath survives a
    // whole-folder move and disambiguates same-named files in sibling folders.
    size?: number;
    lastModified?: number;
    relativePath?: string;
}
