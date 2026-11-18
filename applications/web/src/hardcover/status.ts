import {
  type IdentityCounts,
  getIdentityCounts,
} from "@/database/hardcoverIdentity"
import { readHardcoverToken } from "@/database/providerTokens"

import { type IdentifyProgress, getIdentifyProgress } from "./identifyJob"

export type HardcoverIdentifyStatus = {
  /** A Hardcover token is saved (never the token itself). */
  configured: boolean
  running: boolean
  progress: IdentifyProgress
  counts: IdentityCounts
}

export async function getHardcoverIdentifyStatus(): Promise<HardcoverIdentifyStatus> {
  const [{ status }, counts] = await Promise.all([
    readHardcoverToken(),
    getIdentityCounts(),
  ])
  const progress = getIdentifyProgress()
  return {
    configured: status.tokenSet,
    running: progress.running,
    progress,
    counts,
  }
}
