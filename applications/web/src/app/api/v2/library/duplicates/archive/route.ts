import { NextResponse } from "next/server"

import { withHasPermission } from "@/auth/auth"
import { archiveDuplicates } from "@/database/duplicates"

export const dynamic = "force-dynamic"

/**
 * @summary Archive chosen duplicate books
 * @desc Body: `{ groups: [{ keeperUuid, archiveUuids }] }`. The duplicate
 *       groups are found again on the server and every book to archive must be
 *       in a group with its keeper, otherwise the request is refused with 409
 *       and nothing is archived. Files are never touched.
 */
export const POST = withHasPermission("bookUpdate")(async (request) => {
  const body = (await request.json().catch(() => null)) as {
    groups?: unknown
  } | null

  const groups = body?.groups
  if (
    !Array.isArray(groups) ||
    !groups.every(
      (g: unknown) =>
        typeof g === "object" &&
        g !== null &&
        typeof (g as { keeperUuid?: unknown }).keeperUuid === "string" &&
        Array.isArray((g as { archiveUuids?: unknown }).archiveUuids) &&
        (g as { archiveUuids: unknown[] }).archiveUuids.every(
          (u) => typeof u === "string",
        ),
    )
  ) {
    return NextResponse.json(
      { message: "Expected { groups: [{ keeperUuid, archiveUuids }] }" },
      { status: 400 },
    )
  }

  const result = await archiveDuplicates(
    groups as { keeperUuid: string; archiveUuids: string[] }[],
  )
  if (!result.ok) {
    return NextResponse.json({ message: result.error }, { status: 409 })
  }

  return NextResponse.json({ archived: result.archived, groups: result.groups })
})
