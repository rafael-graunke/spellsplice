import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { AnnotationSlot } from '../../types/config';

interface Props {
    slots: AnnotationSlot[];
    value: string | undefined;
    onChange: (slotId: string) => void;
    onManage?: () => void;
}

export function SlotSelect({ slots, value, onChange, onManage }: Props) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground">Slot</label>
            <div className="flex items-center gap-1.5">
                <Select value={value} onValueChange={onChange}>
                    <SelectTrigger size="sm" className="flex-1">
                        <SelectValue placeholder="Select a slot" />
                    </SelectTrigger>
                    <SelectContent>
                        {slots.map((slot) => (
                            <SelectItem key={slot.id} value={slot.id}>
                                {slot.title}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {onManage && (
                    <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={onManage}
                        aria-label="Manage annotation slots"
                        title="Manage slots"
                    >
                        <Plus />
                    </Button>
                )}
            </div>
        </div>
    );
}
