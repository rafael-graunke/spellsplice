export interface MediaSource {
    id: string;
    name: string;
    type: 'video' | 'audio';
    duration: number;
    file: File;
    thumbnailUrl?: string;
}
