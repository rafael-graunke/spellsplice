import type { LiveHandStackConfig } from '@/lib/liveMode';
import HandStackConfigEditor from './HandStackConfigEditor';

interface Props {
    handStackConfig: LiveHandStackConfig;
    onHandStackConfigChange: (next: LiveHandStackConfig) => void;
}

function HandStackSection({ handStackConfig, onHandStackConfigChange }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-lg font-semibold mb-1">Hand Stack</h2>
                <p className="text-xs text-muted-foreground">
                    Placement and sizing of each player's hand of cards.
                </p>
            </div>

            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                        Left Player
                    </h3>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <HandStackConfigEditor
                    config={handStackConfig.left}
                    onChange={(left) =>
                        onHandStackConfigChange({ ...handStackConfig, left })
                    }
                    ownSide="left"
                />
            </div>
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-border" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                        Right Player
                    </h3>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <HandStackConfigEditor
                    config={handStackConfig.right}
                    onChange={(right) =>
                        onHandStackConfigChange({ ...handStackConfig, right })
                    }
                    ownSide="right"
                />
            </div>
        </div>
    );
}

export default HandStackSection;
