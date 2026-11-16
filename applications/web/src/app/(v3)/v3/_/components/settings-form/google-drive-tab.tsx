"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@v3/_/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@v3/_/components/ui/field"
import { Input } from "@v3/_/components/ui/input"
import { Spinner } from "@v3/_/components/ui/spinner"
import { V3Link } from "@v3/_/components/v3-link"
import { useCommon, useTranslation } from "@v3/_/hooks/use-translation"

import { DRIVE_PREFERENCES_PATH, driveRedirectUri } from "@/driveSync"
import { usePermission } from "@/hooks/usePermission"
import * as icon from "@/icons"
import {
  useGetDriveClientQuery,
  useRemoveDriveClientMutation,
  useSaveDriveClientMutation,
} from "@/store/api"

import { SettingsCard, SettingsSection } from "./shared"

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

function ClientForm() {
  const t = useTranslation("SettingsPage.tabs.server.sections.googleDrive")
  const c = useCommon()
  const { data: client, isLoading } = useGetDriveClientQuery()
  const [saveClient, { isLoading: isSaving }] = useSaveDriveClientMutation()
  const [removeClient, { isLoading: isRemoving }] =
    useRemoveDriveClientMutation()
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [prefilled, setPrefilled] = useState(false)

  const savedClientId = client?.clientId ?? null
  const configured = !!savedClientId

  useEffect(() => {
    if (client && !prefilled) {
      setClientId(client.clientId ?? "")
      setPrefilled(true)
    }
  }, [client, prefilled])

  const canSave = clientId.trim() !== "" && clientSecret.trim() !== ""

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

  const handleRemove = () => {
    removeClient()
      .unwrap()
      .then(
        () => {
          setClientId("")
          setClientSecret("")
          toast.success(t.plain("clientRemoved"))
        },
        () => {
          toast.error(t.plain("clientRemoveFailed"))
        },
      )
  }

  if (isLoading) return <Spinner />

  return (
    <>
      <p className="text-xs font-medium" data-testid="drive-status">
        {configured ? t("statusSetUp") : t("statusNotSetUp")}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="driveClientId">{t("clientIdLabel")}</FieldLabel>
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
              configured
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

      {configured && (
        <p className="text-muted-foreground text-xs">{t("clientResetNote")}</p>
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
        {configured && (
          <Button
            type="button"
            variant="ghost-destructive"
            className="rounded-full"
            disabled={isRemoving}
            onClick={handleRemove}
          >
            {isRemoving && <Spinner className="size-3.5" />}
            {t("removeClient")}
          </Button>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        {t("usersNote")}{" "}
        <V3Link
          href={DRIVE_PREFERENCES_PATH}
          className="hover:text-foreground underline underline-offset-2"
        >
          {t("preferencesLink")}
        </V3Link>
      </p>
    </>
  )
}

export function GoogleDriveSection() {
  const t = useTranslation("SettingsPage.tabs.server.sections.googleDrive")
  const canConfigure = usePermission("settingsUpdate")

  if (!canConfigure) return null

  return (
    <SettingsSection id="googleDrive">
      <SettingsCard title={t("title")} description={t("description")}>
        <ClientForm />
      </SettingsCard>
    </SettingsSection>
  )
}
