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
                <h2 className="text-base font-medium mb-4">Scoreboard</h2>
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
                        <h3 className="text-sm font-semibold mb-3">
                            Left Player
                        </h3>
                        <ScoreboardConfigEditor
                            config={state.left}
                            onChange={(left) => onChange({ ...state, left })}
                            allowSidePicker={false}
                            ownSide="left"
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold mb-3">
                            Right Player
                        </h3>
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
