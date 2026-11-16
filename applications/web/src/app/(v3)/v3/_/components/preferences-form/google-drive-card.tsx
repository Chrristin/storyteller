"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@v3/_/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@v3/_/components/ui/card"
import { Spinner } from "@v3/_/components/ui/spinner"
import { useTranslation } from "@v3/_/hooks/use-translation"
import { cn } from "@v3/_/lib/utils"

import { type DriveResult, parseDriveResult } from "@/driveSync"
import * as icon from "@/icons"
import {
  useConnectDriveMutation,
  useDisconnectDriveMutation,
  useGetDriveStatusQuery,
} from "@/store/api"

import { PreferencesSection } from "./shared"

const RESULT_KEYS = {
  connected: "resultConnected",
  denied: "resultDenied",
  failed: "resultFailed",
  "invalid-state": "resultInvalidState",
  "no-refresh-token": "resultNoRefreshToken",
} as const satisfies Record<DriveResult, string>

function ResultNotice({
  result,
  onDismiss,
}: {
  result: DriveResult
  onDismiss: () => void
}) {
  const t = useTranslation("PreferencesPage.tabs.devices.sections.googleDrive")
  const ok = result === "connected"

  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
        ok
          ? "border-primary/40 bg-primary/10"
          : "border-destructive/40 bg-destructive/10",
      )}
    >
      {ok ? (
        <icon.Check className="mt-0.5 size-3.5 shrink-0" />
      ) : (
        <icon.AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" />
      )}
      <div className="flex-1 space-y-1">
        <p>{t(RESULT_KEYS[result])}</p>
        {!ok && result !== "denied" && (
          <p className="text-muted-foreground">{t("unverifiedNote")}</p>
        )}
      </div>
      <Button
        type="button"
        variant="real-ghost"
        size="icon-xs"
        aria-label={t.plain("dismiss")}
        onClick={onDismiss}
      >
        <icon.Close />
      </Button>
    </div>
  )
}

export function GoogleDriveSection() {
  const t = useTranslation("PreferencesPage.tabs.devices.sections.googleDrive")
  const searchParams = useSearchParams()
  const [dismissedResult, setDismissedResult] = useState(false)
  const result = dismissedResult
    ? null
    : parseDriveResult(searchParams.get("drive"))

  const { data: status, isLoading, isError } = useGetDriveStatusQuery()
  const [connect, { isLoading: isConnecting }] = useConnectDriveMutation()
  const [disconnect, { isLoading: isDisconnecting }] =
    useDisconnectDriveMutation()

  // Users who cannot download books are never offered Drive sync.
  if (isError) return null

  const handleConnect = () => {
    connect({ origin: window.location.origin })
      .unwrap()
      .then(
        ({ url }) => {
          window.location.assign(url)
        },
        (error: unknown) => {
          const message = (error as { data?: { message?: string } }).data
            ?.message
          toast.error(t.plain("connectFailed"), { description: message })
        },
      )
  }

  const handleDisconnect = () => {
    disconnect()
      .unwrap()
      .then(
        () => {
          toast.success(t.plain("disconnected"))
        },
        () => {
          toast.error(t.plain("disconnectFailed"))
        },
      )
  }

  const statusText = !status
    ? null
    : status.connected
      ? status.accountEmail
        ? t("statusConnected", { email: status.accountEmail })
        : t("statusConnectedUnknown")
      : t("statusNotConnected")

  return (
    <PreferencesSection id="googleDrive">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result && (
            <ResultNotice
              result={result}
              onDismiss={() => {
                setDismissedResult(true)
              }}
            />
          )}

          {isLoading || !status ? (
            <Spinner />
          ) : !status.configured ? (
            <p className="text-muted-foreground text-sm">{t("notSetUp")}</p>
          ) : (
            <>
              <p className="text-muted-foreground text-xs">{t("privacy")}</p>

              <p
                className="flex items-center gap-1.5 text-xs font-medium"
                data-testid="drive-status"
              >
                {status.connected && (
                  <icon.Check className="text-primary size-3.5" />
                )}
                {statusText}
              </p>

              {!status.connected && (
                <p className="text-muted-foreground text-xs">
                  {t("unverifiedNote")}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  disabled={isConnecting}
                  onClick={handleConnect}
                >
                  {isConnecting && <Spinner className="size-3.5" />}
                  {status.connected ? t("reconnect") : t("connect")}
                </Button>
                {status.connected && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={isDisconnecting}
                    onClick={handleDisconnect}
                  >
                    {isDisconnecting && <Spinner className="size-3.5" />}
                    {t("disconnect")}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PreferencesSection>
  )
}
