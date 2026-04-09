import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import { Button } from './components/ui/button'
import { ThemeProvider } from './components/theme-provider'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './components/ui/resizable'
import { Timeline } from './components/Timeline'
import type { Player } from './components/types/player'


function App() {

  const players: Player[] = [
    {id: "player1", name: "Player 1", handSize: 7, librarySize: 53, lifeTotal: 20},
    {id: "player2", name: "Player 2", handSize: 7, librarySize: 53, lifeTotal: 20},
  ]

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <section className="h-screen">
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel minSize={100} defaultSize="70%">
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel minSize={100} defaultSize="75%">
                <p>Video Preview</p>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel minSize={100} defaultSize="25%">
                <p>Inspector</p>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel minSize={100} defaultSize="30%">
            <Timeline playerData={players}/>
          </ResizablePanel>
        </ResizablePanelGroup>
      </section>
    </ThemeProvider>
  )
}

export default App
