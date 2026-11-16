import { Stack as RouterStack } from "expo-router"
import { type ReactNode } from "react"
import { View } from "react-native"

import { usesSystemHeader } from "@/lib/nativeChrome"
import { cn } from "@/lib/utils"

import { BackButton } from "./BackButton"
import { ScreenBackButton } from "./ScreenBackButton"
import { Stack } from "./ui/Stack"
import { Text } from "./ui/text"

/**
 * Title and back button in the same two ways BookGrid draws them: the system
 * bar when the platform has one, otherwise a plain row. `children` is the body.
 */
export function ScreenHeader({
  title,
  right,
  children,
}: {
  title: string
  right?: ReactNode
  children: ReactNode
}) {
  return (
    <>
      {usesSystemHeader && (
        <>
          <RouterStack.Header style={{ shadowColor: "transparent" }} />
          <RouterStack.Title>{title}</RouterStack.Title>
          <ScreenBackButton />
        </>
      )}
      <Stack
        className={cn("flex-1 items-stretch", !usesSystemHeader && "pt-safe")}
      >
        {!usesSystemHeader && (
          <View className="px-safe-or-2 w-full flex-row items-center justify-start gap-2 self-start">
            <BackButton />
            <Text className="my-2" variant="h3">
              {title}
            </Text>
            {right && <View className="mr-4 ml-auto">{right}</View>}
          </View>
        )}
        {children}
      </Stack>
    </>
  )
}
