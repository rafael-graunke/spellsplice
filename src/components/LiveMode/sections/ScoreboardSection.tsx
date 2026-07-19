import type { LiveScoreboardState, ScoreboardMode } from '@/lib/liveMode';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ScoreboardConfigEditor from './ScoreboardConfigEditor';

interface Props {
    state: LiveScoreboardState;
    onChange: (next: LiveScoreboardState) => void;
}

const MODE_OPTIONS: { id: ScoreboardMode; label: string }[] = [
    { id: 'shared', label: 'Shared' },
    { id: 'per-player', label: 'Per Player' },
];

function ScoreboardSection({ state, onChange }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-lg font-semibold mb-4">Scoreboard</h2>
                <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Scoreboard mode</span>
                    <div className="flex gap-1">
                        {MODE_OPTIONS.map((option) => (
                            <Button
                                key={option.id}
                                type="button"
                                size="sm"
                                variant={
                                    state.mode === option.id
                                        ? 'default'
                                        : 'outline'
                                }
                                className={cn(
                                    'cursor-pointer',
                                    state.mode === option.id &&
                                        'pointer-events-none'
                                )}
                                onClick={() =>
                                    onChange({ ...state, mode: option.id })
                                }
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {state.mode === 'shared' ? (
                <ScoreboardConfigEditor
                    config={state.shared}
                    onChange={(shared) => onChange({ ...state, shared })}
                    allowSidePicker
                />
            ) : (
                <div className="flex flex-col gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-px flex-1 bg-border" />
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
                                Left Player
                            </h3>
                            <div className="h-px flex-1 bg-border" />
                        </div>
                        <ScoreboardConfigEditor
                            config={state.left}
                            onChange={(left) => onChange({ ...state, left })}
                            allowSidePicker={false}
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
                        <ScoreboardConfigEditor
                            config={state.right}
                            onChange={(right) => onChange({ ...state, right })}
                            allowSidePicker={false}
                            ownSide="right"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default ScoreboardSection;
