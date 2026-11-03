import { Text, View } from "react-native"
import Svg, { Path } from "react-native-svg"
import { useCSSVariable } from "uniwind"

import { Button } from "./ui/button"

type Props = {
  direction: "back" | "forward"
  seconds: number
  size?: number
  onPress: () => void
}

/**
 * Skip control: two arrows pointing the way the audio moves, with the number of
 * seconds underneath.
 */
export function SkipButton({ direction, seconds, size = 30, onPress }: Props) {
  const foreground = useCSSVariable("--color-foreground") as string
  const muted = useCSSVariable("--color-muted-foreground") as string
  const label =
    direction === "back"
      ? `Rewind ${seconds} seconds`
      : `Forward ${seconds} seconds`

  return (
    <Button
      accessibilityLabel={label}
      className="h-auto w-auto rounded-xl px-2 py-1"
      onPress={onPress}
      variant="ghost"
    >
      <View className="items-center gap-0.5">
        <Svg height={size} viewBox="0 0 24 24" width={size}>
          <Path
            d={
              direction === "back"
                ? "M11 6.5v11L3.5 12zM20.5 6.5v11L13 12z"
                : "M13 6.5v11L20.5 12zM3.5 6.5v11L11 12z"
            }
            fill={foreground}
            stroke={foreground}
            strokeLinejoin="round"
            strokeWidth={1.4}
          />
        </Svg>
        <Text
          style={{
            color: muted,
            fontSize: 11,
            fontVariant: ["tabular-nums"],
            fontWeight: "700",
          }}
        >
          {seconds}
        </Text>
      </View>
    </Button>
  )
}
