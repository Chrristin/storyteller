"use client"

import { type ComponentProps, type ReactNode, useState } from "react"
import { toast } from "sonner"

import { Button } from "@v3/_/components/ui/button"
import { ConfirmDialog } from "@v3/_/components/ui/confirm-dialog"
import { Spinner } from "@v3/_/components/ui/spinner"
import { apiErrorMessage } from "@v3/_/lib/api-error"

/**
 * A button with a spinner that opens a confirm dialog and only calls
 * `onConfirm` after the click is confirmed.
 */
export function ConfirmButton({
  label,
  isLoading,
  disabled,
  variant,
  title,
  description,
  confirmLabel,
  confirmVariant,
  onConfirm,
}: {
  label: ReactNode
  isLoading: boolean
  disabled: boolean
  variant?: ComponentProps<typeof Button>["variant"]
  title: string
  description: string
  confirmLabel: string
  confirmVariant?: "default" | "destructive"
  onConfirm: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className="rounded-full"
        disabled={disabled}
        onClick={() => {
          setOpen(true)
        }}
      >
        {isLoading && <Spinner className="size-3.5" />}
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        variant={confirmVariant}
        isLoading={isLoading}
        onConfirm={onConfirm}
      />
    </>
  )
}

/**
 * Runs an unwrapped request. On failure it shows an error toast built from
 * the server message and returns undefined, otherwise it returns the result.
 */
export async function runWithToast<T>(
  action: () => Promise<T>,
  failedText: (message: string) => string,
): Promise<T | undefined> {
  try {
    return await action()
  } catch (error) {
    toast.error(failedText(apiErrorMessage(error) ?? ""))
    return undefined
  }
}
