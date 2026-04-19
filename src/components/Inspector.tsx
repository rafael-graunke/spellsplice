import type { TrackEvent } from "./types/event";


interface InspectorProps {
    editObject: TrackEvent[] | null;
}


export function Inspector({editObject}: InspectorProps) {
    console.log(editObject)

    return (
        <div className="inspector p-4">
            <h4 className="scroll-m-20 text-l font-semibold tracking-tight">Inspector</h4>
            {editObject && editObject?.length !== 0 ? (
                <pre className="text-sm mt-2">{JSON.stringify(editObject, null, 2)}</pre>
                
            ) : (
                <p className="text-sm text-muted-foreground">Select an event to see details</p>
            )}
        </div>
    );
}
