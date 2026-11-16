import { type Metadata } from "next"

import { withPageAuth } from "@v3/_/server/page-auth-wrapper"

import PilesPage from "@/app/(v3)/v3/_/components/piles/PilesPage"

export const metadata: Metadata = { title: null }

export default withPageAuth(["bookList"])(() => {
  return <PilesPage />
})
