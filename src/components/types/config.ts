export interface ProjectConfig {
    title: string;
    author: string;
    defaultLifeTotal: number;
    defaultLayerCount: number;
    overlayStartHidden: boolean;
}

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
    title: '',
    author: '',
    defaultLifeTotal: 20,
    defaultLayerCount: 4,
    overlayStartHidden: false,
};
