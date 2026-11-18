import { type Metadata } from "next"

import { withPageAuth } from "@v3/_/server/page-auth-wrapper"

import { IdentifyPage } from "./identifyPage"

export const metadata: Metadata = {
  title: "Identify books",
}

export default withPageAuth(["bookUpdate"])(() => {
  return <IdentifyPage />
})
