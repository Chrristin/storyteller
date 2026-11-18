import { type HrefObject, useRouter } from "expo-router"
import { Pressable, View } from "react-native"

import { Text } from "./ui/text"

interface Props {
  title: string
  /** Where "All" goes. With no href the row has just the title. */
  href?: string | HrefObject | undefined
}

/**
 * The title row of a Home section: the title on the left and "All" on the
 * right of the same line, in the accent colour.
 */
export function SectionHeader({ title, href }: Props) {
  const router = useRouter()

  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-[16px] font-bold" numberOfLines={1}>
        {title}
      </Text>
      {href && (
        <Pressable
          accessibilityLabel={`All: ${title}`}
          accessibilityRole="button"
          className="-my-2 -mr-2 min-h-11 justify-center px-2"
          hitSlop={4}
          onPress={() => router.push(href)}
        >
          <Text className="text-primary text-[14px] font-semibold">All</Text>
        </Pressable>
      )}
    </View>
  )
}
