import { type Metadata } from "next"

import { withPageAuth } from "@v3/_/server/page-auth-wrapper"

import ArchivePage from "./archivePage"

export const metadata: Metadata = {
  title: "Archive",
}

export default withPageAuth(["bookList"])(() => {
  return <ArchivePage />
})
