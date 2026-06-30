import type { ProjectConfig } from '@/components/types/config';
import { Input } from '@/components/ui/input';

interface Props {
    config: ProjectConfig;
    onConfigChange: (c: ProjectConfig) => void;
}

function PlayerDefaultsSection({ config, onConfigChange }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-base font-medium mb-4">Player Defaults</h2>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="default-life" className="text-sm font-medium">Starting life total</label>
                        <Input
                            id="default-life"
                            type="number"
                            min={1}
                            max={999}
                            value={config.defaultLifeTotal}
                            onChange={(e) =>
                                onConfigChange({
                                    ...config,
                                    defaultLifeTotal: Math.max(1, Math.min(999, Number(e.target.value) || 1)),
                                })
                            }
                            className="w-28"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="default-layers" className="text-sm font-medium">Default layer count</label>
                        <Input
                            id="default-layers"
                            type="number"
                            min={1}
                            max={8}
                            value={config.defaultLayerCount}
                            onChange={(e) =>
                                onConfigChange({
                                    ...config,
                                    defaultLayerCount: Math.max(1, Math.min(8, Number(e.target.value) || 1)),
                                })
                            }
                            className="w-28"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PlayerDefaultsSection;
