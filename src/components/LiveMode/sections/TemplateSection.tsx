import type { LiveTemplateState, TemplateMode } from '@/lib/liveMode';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import TemplateConfigEditor from './TemplateConfigEditor';

interface Props {
    state: LiveTemplateState;
    onChange: (next: LiveTemplateState) => void;
}

const MODE_OPTIONS: { id: TemplateMode; label: string }[] = [
    { id: 'shared', label: 'Shared' },
    { id: 'per-player', label: 'Per Player' },
];

function TemplateSection({ state, onChange }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-base font-medium mb-4">Template</h2>
                <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Template mode</span>
                    <div className="flex gap-1">
                        {MODE_OPTIONS.map((option) => (
                            <Button
                                key={option.id}
                                type="button"
                                size="sm"
                                variant={state.mode === option.id ? 'default' : 'outline'}
                                className={cn('cursor-pointer', state.mode === option.id && 'pointer-events-none')}
                                onClick={() => onChange({ ...state, mode: option.id })}
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {state.mode === 'shared' ? (
                <TemplateConfigEditor
                    config={state.shared}
                    onChange={(shared) => onChange({ ...state, shared })}
                    allowSidePicker
                />
            ) : (
                <div className="flex flex-col gap-6">
                    <div>
                        <h3 className="text-sm font-semibold mb-3">Left Player</h3>
                        <TemplateConfigEditor
                            config={state.left}
                            onChange={(left) => onChange({ ...state, left })}
                            allowSidePicker={false}
                            ownSide="left"
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold mb-3">Right Player</h3>
                        <TemplateConfigEditor
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

export default TemplateSection;
