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
}
