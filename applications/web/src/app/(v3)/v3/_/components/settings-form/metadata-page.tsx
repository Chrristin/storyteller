"use client"

import { HardcoverIdentifySection } from "./hardcover-identify-section"
import { MetadataProvidersSection } from "./metadata-providers-section"
import { DefaultStatusSection, ReadBehaviorSection } from "./metadata-tab"
import { TitleCleanupSection } from "./title-cleanup-section"

export function MetadataPage() {
  return (
    <div className="space-y-6">
      <ReadBehaviorSection />
      <MetadataProvidersSection />
      <DefaultStatusSection />
      <HardcoverIdentifySection />
      <TitleCleanupSection />
    </div>
  )
}
