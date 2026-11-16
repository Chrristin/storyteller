import { View } from "react-native"

import { type BookWithRelations } from "@/database/books"

import { BookCover } from "./BookCover"

/**
 * Three covers stacked like a pile: the two behind lean left and right, the
 * front one is nearly straight. Read-only, so a tap goes to the parent.
 * The covers are drawn with the app's own BookCover.
 */
export function PileStack({
  covers,
  width,
}: {
  covers: BookWithRelations[]
  width: number
}) {
  const coverWidth = Math.round(width * 0.54)
  const coverHeight = Math.round(coverWidth * 1.5)
  const height = coverHeight + 12
  const [front, second, third] = covers

  const layer = (
    book: BookWithRelations | undefined,
    left: number,
    top: number,
    rotate: string,
  ) =>
    book ? (
      <View
        key={book.uuid}
        pointerEvents="none"
        style={{
          position: "absolute",
          left,
          top,
          transform: [{ rotate }],
        }}
      >
        <BookCover
          book={book}
          badge={false}
          progressLine={false}
          width={coverWidth}
          height={coverHeight}
        />
      </View>
    ) : null

  const centre = Math.round((width - coverWidth) / 2)
  const spread = Math.round(width * 0.17)

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height }}
    >
      {layer(third, centre - spread, 10, "-8deg")}
      {layer(second, centre + spread, 8, "7deg")}
      {layer(front, centre, 4, "-1.5deg")}
    </View>
  )
}
