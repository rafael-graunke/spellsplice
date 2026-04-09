import { useEffect, useRef, useState } from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable"
import { TimelineControls } from "./TimelineControls"
import type { Player } from "./types/player"
import TimelineTrackControl from "./TimelineTrackControl"
import TimelineRuler from "./TimelineRuler"
import type { PanelImperativeHandle } from "react-resizable-panels"


interface TimelineProps {
    playerData: Player[],
}

export function Timeline({ playerData }: TimelineProps) {

    const [zoom, setZoom] = useState(50);
    const [selectedPlayer, setSelectedPlayer] = useState<Player>(playerData[0]);
    const containerRef = useRef<HTMLDivElement>(null)
    const panelRef = useRef<PanelImperativeHandle>(null)

    const handleZoomChange = (newZoom: number) => {
        setZoom(newZoom);
    }

    const handlePlayerChange = (player: Player) => {
        setSelectedPlayer(player);
    }

    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const handler = (e: WheelEvent) => {
            e.preventDefault()

            const zoomIntensity = 0.001
            const oldZoom = zoom

            const rect = el.getBoundingClientRect()
            const mouseX = e.clientX - rect.left + el.scrollLeft

            const time = mouseX / oldZoom

            const delta = -e.deltaY
            const newZoom = Math.min(Math.max(5, oldZoom * (1 + delta * zoomIntensity)), 200)

            setZoom(newZoom)

            const newScrollLeft = time * newZoom - (e.clientX - rect.left)

            requestAnimationFrame(() => {
                el.scrollLeft = newScrollLeft
            })
        }

        el.addEventListener("wheel", handler, { passive: false })

        return () => {
            el.removeEventListener("wheel", handler)
        }
    }, [zoom])

    return (
        <div className="timeline flex flex-col h-full" ref={containerRef}>
            <TimelineControls duration={100} zoom={zoom} onZoomChange={handleZoomChange} />
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel minSize={100} defaultSize="20%">
                    <TimelineTrackControl
                        playerData={playerData}
                        currentPlayer={selectedPlayer}
                        onPlayerChange={handlePlayerChange}
                    />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel className="relative" minSize={100} defaultSize="80%" panelRef={panelRef}>
                    <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-100" />
                    <TimelineRuler duration={100} zoom={zoom} />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}