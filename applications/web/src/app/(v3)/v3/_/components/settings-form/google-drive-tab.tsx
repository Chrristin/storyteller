"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@v3/_/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@v3/_/components/ui/field"
import { Input } from "@v3/_/components/ui/input"
import { Spinner } from "@v3/_/components/ui/spinner"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { cn } from "@/cn"
import {
  type DriveResult,
  driveRedirectUri,
  parseDriveResult,
} from "@/driveSync"
import { usePermission } from "@/hooks/usePermission"
import * as icon from "@/icons"
import {
  useConnectDriveMutation,
  useDisconnectDriveMutation,
  useGetDriveStatusQuery,
  useSaveDriveClientMutation,
} from "@/store/api"

import { SettingsCard, SettingsSection } from "./shared"

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
  const t = useTranslation("SettingsPage.tabs.server.sections.googleDrive")
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

function RedirectAddress() {
  const t = useTranslation("SettingsPage.tabs.server.sections.googleDrive")
  const uri = driveRedirectUri(window.location.origin)

  return (
    <Field>
      <FieldLabel htmlFor="driveRedirectUri">{t("redirectTitle")}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input id="driveRedirectUri" readOnly value={uri} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t.plain("copy")}
          onClick={() => {
            navigator.clipboard.writeText(uri).then(
              () => {
                toast.success(t.plain("copied"))
              },
              () => {
                toast.error(t.plain("copyFailed"))
              },
            )
          }}
        >
          <icon.Copy />
        </Button>
      </div>
      <FieldDescription>{t("redirectDescription")}</FieldDescription>
    </Field>
  )
}

export function GoogleDriveSection() {
  const t = useTranslation("SettingsPage.tabs.server.sections.googleDrive")
  const c = useCommon()
  const canConfigure = usePermission("settingsUpdate")
  const searchParams = useSearchParams()
  const [dismissedResult, setDismissedResult] = useState(false)
  const result = dismissedResult
    ? null
    : parseDriveResult(searchParams.get("drive"))

  const { data: status, isLoading } = useGetDriveStatusQuery()
  const [saveClient, { isLoading: isSaving }] = useSaveDriveClientMutation()
  const [connect, { isLoading: isConnecting }] = useConnectDriveMutation()
  const [disconnect, { isLoading: isDisconnecting }] =
    useDisconnectDriveMutation()
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")

  const canSave = clientId.trim() !== "" && clientSecret.trim() !== ""

  const statusText = !status
    ? null
    : status.connected
      ? status.accountEmail
        ? t("statusConnected", { email: status.accountEmail })
        : t("statusConnectedUnknown")
      : status.configured
        ? t("statusNotConnected")
        : t("statusNotSetUp")

  const handleSave = () => {
    if (!canSave) return
    saveClient({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    })
      .unwrap()
      .then(
        () => {
          setClientSecret("")
          toast.success(t.plain("clientSaved"))
        },
        () => {
          toast.error(t.plain("clientSaveFailed"))
        },
      )
  }

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

  const handleDisconnect = (all: boolean) => {
    disconnect({ all })
      .unwrap()
      .then(
        () => {
          if (all) setClientId("")
          toast.success(t.plain("disconnected"))
        },
        () => {
          toast.error(t.plain("disconnectFailed"))
        },
      )
  }

  return (
    <SettingsSection id="googleDrive">
      <SettingsCard title={t("title")} description={t("description")}>
        {result && (
          <ResultNotice
            result={result}
            onDismiss={() => {
              setDismissedResult(true)
            }}
          />
        )}

        <p className="text-muted-foreground text-xs">{t("privacy")}</p>

        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <p
              className="flex items-center gap-1.5 text-xs font-medium"
              data-testid="drive-status"
            >
              {status?.connected && (
                <icon.Check className="text-primary size-3.5" />
              )}
              {statusText}
            </p>

            {!canConfigure ? (
              <p className="text-muted-foreground text-xs">{t("usersNote")}</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="driveClientId">
                      {t("clientIdLabel")}
                    </FieldLabel>
                    <Input
                      id="driveClientId"
                      autoComplete="off"
                      spellCheck={false}
                      value={clientId}
                      onChange={(event) => {
                        setClientId(event.target.value)
                      }}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="driveClientSecret">
                      {t("clientSecretLabel")}
                    </FieldLabel>
                    <Input
                      id="driveClientSecret"
                      type="password"
                      autoComplete="off"
                      value={clientSecret}
                      placeholder={
                        status?.configured
                          ? t.plain("clientSecretSavedPlaceholder")
                          : t.plain("clientSecretPlaceholder")
                      }
                      onChange={(event) => {
                        setClientSecret(event.target.value)
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return
                        event.preventDefault()
                        handleSave()
                      }}
                    />
                    <FieldDescription>{t("clientSecretTip")}</FieldDescription>
                  </Field>
                </div>

                {status?.configured && (
                  <p className="text-muted-foreground text-xs">
                    {t("clientResetNote")}
                  </p>
                )}
                {status?.configured && !status.connected && (
                  <p className="text-muted-foreground text-xs">
                    {t("unverifiedNote")}
                  </p>
                )}

                <RedirectAddress />

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={!canSave || isSaving}
                    onClick={handleSave}
                  >
                    {isSaving && <Spinner className="size-3.5" />}
                    {c("actions.save")}
                  </Button>
                  {status?.configured && (
                    <Button
                      type="button"
                      className="rounded-full"
                      disabled={isConnecting}
                      onClick={handleConnect}
                    >
                      {isConnecting && <Spinner className="size-3.5" />}
                      {status.connected ? t("reconnect") : t("connect")}
                    </Button>
                  )}
                  {status?.connected && (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      disabled={isDisconnecting}
                      onClick={() => {
                        handleDisconnect(false)
                      }}
                    >
                      {t("disconnect")}
                    </Button>
                  )}
                  {status?.configured && (
                    <Button
                      type="button"
                      variant="ghost-destructive"
                      className="rounded-full"
                      disabled={isDisconnecting}
                      onClick={() => {
                        handleDisconnect(true)
                      }}
                    >
                      {t("removeClient")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </SettingsCard>
    </SettingsSection>
  )
}
