"use client"

import { SpeedMenu } from "@v3/_/components/reader/MiniPlayer/SpeedMenu"
import { TooltipButton } from "@v3/_/components/ui/tooltip-button"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type BookWithRelations } from "@/database/books"
import * as icon from "@/icons"
import { readerPlayer } from "@/services/AudioPlayerService"
import { closeMiniPlayer, playerPositionUpdated } from "@/store/actions"
import { useAppDispatch, useAppSelector } from "@/store/appState"
import { selectCurrentTrack } from "@/store/slices/audioPlayerSlice"

import { SeekBar } from "./MiniPlayer"
import { PlayerControls } from "./PlayerControls"

// player block for the book details hero. It takes the place of the reading
// status and Listen buttons while this audiobook is loaded.
export function HeroPlayerControls({ book }: { book: BookWithRelations }) {
  const dispatch = useAppDispatch()
  const t = useTranslation("Reader.miniPlayer")
  const track = useAppSelector(selectCurrentTrack)

  // Pause, save the position right away (the regular sync is throttled and
  // closing would drop the last stretch), then close the session like the
  // mini player's close button does.
  const stop = () => {
    readerPlayer().pause()
    dispatch(playerPositionUpdated())
    dispatch(closeMiniPlayer())
  }

  return (
    <div
      role="group"
      aria-label={t.plain("playerControls")}
      className="text-tinted flex w-full flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs tracking-wide uppercase">
          {t.plain("nowPlaying")}
          {track?.title ? ` · ${track.title}` : ""}
        </span>
        <SpeedMenu book={book} />
      </div>
      <SeekBar tone="cover" />
      <div className="flex items-center justify-center gap-1">
        <PlayerControls />
        <span aria-hidden="true" className="bg-cover-accent/25 mx-1 h-6 w-px" />
        <TooltipButton
          variant="cover-outline"
          size="icon"
          className="rounded-full"
          tooltip={t.plain("stop")}
          aria-label={t.plain("stop")}
          onClick={stop}
        >
          <icon.Square className="fill-current" />
        </TooltipButton>
      </div>
    </div>
  )
}
