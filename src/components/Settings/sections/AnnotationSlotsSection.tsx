import type { ProjectConfig, AnnotationSlot } from '@/components/types/config';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2Icon } from 'lucide-react';

interface Props {
    config: ProjectConfig;
    onConfigChange: (c: ProjectConfig) => void;
}

function makeSlotId() {
    return `slot-${Math.random().toString(36).slice(2, 8)}`;
}

function AnnotationSlotsSection({ config, onConfigChange }: Props) {
    const slots = config.annotationSlots;

    const setSlots = (next: AnnotationSlot[]) =>
        onConfigChange({ ...config, annotationSlots: next });

    const rename = (id: string, title: string) =>
        setSlots(slots.map((s) => (s.id === id ? { ...s, title } : s)));

    const remove = (id: string) => setSlots(slots.filter((s) => s.id !== id));

    const add = () => setSlots([...slots, { id: makeSlotId(), title: 'New Slot' }]);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-base font-medium mb-1">Annotations</h2>
                <p className="text-xs text-muted-foreground mb-4">
                    Named slots that annotation events target. Slot titles show on the overlay.
                </p>
                <div className="flex flex-col gap-2">
                    {slots.map((slot) => (
                        <div key={slot.id} className="flex items-center gap-2">
                            <Input
                                value={slot.title}
                                onChange={(e) => rename(slot.id, e.target.value)}
                                placeholder="Slot title"
                                className="h-8"
                            />
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => remove(slot.id)}
                                aria-label={`Delete ${slot.title}`}
                            >
                                <Trash2Icon />
                            </Button>
                        </div>
                    ))}
                    {slots.length === 0 && (
                        <p className="text-xs text-muted-foreground">No slots yet.</p>
                    )}
                </div>
                <Button variant="outline" size="sm" className="mt-3" onClick={add}>
                    <Plus /> Add slot
                </Button>
            </div>
        </div>
    );
}

export default AnnotationSlotsSection;
