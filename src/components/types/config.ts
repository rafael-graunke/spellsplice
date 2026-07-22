export interface AnnotationSlot {
    id: string;
    title: string;
}

export interface ProjectConfig {
    title: string;
    author: string;
    defaultLifeTotal: number;
    defaultLayerCount: number;
    overlayStartHidden: boolean;
    annotationSlots: AnnotationSlot[];
}

// Default annotation slot that Cmd+K-created events target and that legacy
// deck-stack events migrate into.
export const DEFAULT_ANNOTATION_SLOT_ID = 'top-deck';

export const DEFAULT_ANNOTATION_SLOTS: AnnotationSlot[] = [
    { id: 'graveyard', title: 'Graveyard' },
    { id: 'top-deck', title: 'Top Deck' },
    { id: 'pithing-needle', title: 'Pithing Needle' },
    { id: 'disruptor-flute', title: 'Disruptor Flute' },
    { id: 'meddling-mage', title: 'Meddling Mage' },
];

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
    title: '',
    author: '',
    defaultLifeTotal: 20,
    defaultLayerCount: 4,
    overlayStartHidden: false,
    annotationSlots: DEFAULT_ANNOTATION_SLOTS,
};
