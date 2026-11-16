import { skipToken } from "@reduxjs/toolkit/query"
import { documentDirectory } from "expo-file-system/legacy"
import { Image, type ImageStyle } from "expo-image"
import { type StyleProp } from "react-native"

import { type BookWithRelations } from "@/database/books"
import {
  useGetServerAccessTokenQuery,
  useGetServerQuery,
} from "@/store/localApi"
import { getCoverUrl } from "@/store/serverApi"

interface Props {
  book: BookWithRelations
  style?: StyleProp<ImageStyle>
  contentFit?: "cover" | "contain"
  /** Blur the image, used for the fill behind a square cover. */
  blurRadius?: number
}

export function AudiobookCover({
  book,
  style,
  contentFit = "cover",
  blurRadius,
}: Props) {
  const { data: server } = useGetServerQuery(
    book?.serverUuid ? { uuid: book.serverUuid } : skipToken,
  )
  const { data: accessToken } = useGetServerAccessTokenQuery(
    book?.serverUuid
      ? {
          serverUuid: book.serverUuid,
        }
      : skipToken,
  )

  const audiobookCoverUrl = book?.audiobookCoverUrl
    ? new URL(book.audiobookCoverUrl, documentDirectory!).toString()
    : server && book
      ? getCoverUrl(server.baseUrl, book, "audio")
      : null

  if (!audiobookCoverUrl) return null

  return (
    <Image
      style={[
        {
          flex: 1,
          height: "100%",
          width: "100%",
        },
        style,
      ]}
      alt=""
      {...(blurRadius === undefined ? {} : { blurRadius })}
      contentFit={contentFit}
      aria-hidden
      source={{
        uri: audiobookCoverUrl,
        headers: { Authorization: `Bearer ${accessToken}` },
      }}
    />
  )
}
