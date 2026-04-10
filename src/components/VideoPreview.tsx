import { Button } from "./ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./ui/empty";


function VideoPreview() {
    return (
        <Empty className="h-full border border-dashed">
            <EmptyHeader>
                <EmptyMedia>
                    <img src="/assets/logo.svg" width={200}/>
                </EmptyMedia>
                <EmptyTitle className="text-xl">Start with a video</EmptyTitle>
                <EmptyDescription>Drop a file here or select one to begin editing</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button size="lg" className="text-md">Select video</Button>
            </EmptyContent>
        </Empty>
    )
}

export default VideoPreview;
