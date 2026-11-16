"use client"

import { Skeleton } from "@v3/_/components/ui/skeleton"

import { useUserPreferences } from "@/app/(v3)/v3/_/components/user-preferences-provider"

export function BookCardSkeleton() {
  const { titlesUnderCovers } = useUserPreferences()
  return (
    <div className="flex w-full min-w-0 flex-col">
      <div className="rounded-card bg-muted aspect-2/3 w-full shrink-0 animate-pulse" />
      {titlesUnderCovers && (
        <div className="mt-3 flex flex-col gap-0.5 px-1">
          <Skeleton className="h-3.5 w-2/3 animate-none" />
          <Skeleton className="mt-1 h-4 w-full animate-none" />
          <Skeleton className="h-4 w-1/3 animate-none" />
        </div>
      )}
    </div>
  )
}
