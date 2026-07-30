import type { ProjectConfig } from '@/types/config';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
    config: ProjectConfig;
    onConfigChange: (c: ProjectConfig) => void;
}

function OverlayAppearanceSection({ config, onConfigChange }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-lg font-semibold mb-4">Overlay Behaviour</h2>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2.5">
                        <Checkbox
                            id="overlay-start-hidden"
                            checked={config.overlayStartHidden}
                            onCheckedChange={(checked) =>
                                onConfigChange({ ...config, overlayStartHidden: checked === true })
                            }
                        />
                        <label htmlFor="overlay-start-hidden" className="text-sm cursor-pointer select-none">
                            Start hidden
                            <span className="block text-xs text-muted-foreground">
                                Overlay is hidden at the start of playback
                            </span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OverlayAppearanceSection;
