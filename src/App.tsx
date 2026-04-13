import './App.css';
import { ThemeProvider } from './components/theme-provider';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from './components/ui/resizable';
import { Timeline } from './components/Timeline';
import type { Player } from './components/types/player';
import { useState } from 'react';
import VideoPreview from './components/VideoPreview';
import type { VideoState } from './components/types/video';


function App() {
    const players: Player[] = [
        {
            id: 'player1',
            name: 'Player 1',
            handSize: 7,
            librarySize: 53,
            lifeTotal: 20,
        },
        {
            id: 'player2',
            name: 'Player 2',
            handSize: 7,
            librarySize: 53,
            lifeTotal: 20,
        },
    ];

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(15);
    const [video, setVideo] = useState<VideoState | null>(null);

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <section className="h-screen">
                <ResizablePanelGroup orientation="vertical">
                    <ResizablePanel minSize={100} defaultSize="70%">
                        <ResizablePanelGroup orientation="horizontal">
                            <ResizablePanel
                                minSize={100}
                                defaultSize="75%"
                                className="bg-muted/20"
                            >
                                <VideoPreview
                                    isPlaying={isPlaying}
                                    currentTime={currentTime}
                                    video={video}
                                    setVideo={setVideo}
                                    setCurrentTime={setCurrentTime}
                                />
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel minSize={100} defaultSize="25%">
                                <p>Inspector</p>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel minSize={100} defaultSize="30%">
                        <Timeline
                            setCurrentTime={setCurrentTime}
                            currentTime={currentTime}
                            playerData={players}
                            duration={video ? video.duration || 120 : 120}
                            isPlaying={isPlaying}
                            setIsPlaying={setIsPlaying}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </section>
        </ThemeProvider>
    );
}

export default App;
