"use client"

import { SpeedMenu } from "@v3/_/components/reader/MiniPlayer/SpeedMenu"
import { useTranslation } from "@v3/_/hooks/use-translation"

import { type BookWithRelations } from "@/database/books"

import { SeekBar } from "./MiniPlayer"
import { PlayerControls } from "./PlayerControls"

// compact player row for the book details hero, reusing the mini player parts
export function HeroPlayerControls({ book }: { book: BookWithRelations }) {
  const t = useTranslation("Reader.miniPlayer")

  return (
    <div
      role="group"
      aria-label={t.plain("playerControls")}
      className="text-tinted flex w-full flex-col gap-1"
    >
      <div className="flex items-center justify-center gap-1">
        <PlayerControls />
        <SpeedMenu book={book} />
      </div>
      <SeekBar tone="cover" />
    </div>
  )
}
