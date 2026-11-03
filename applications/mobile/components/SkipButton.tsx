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
export function SkipButton({ direction, seconds, size = 28, onPress }: Props) {
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
                ? "M11 6 5 12l6 6M19 6l-6 6 6 6"
                : "M13 6l6 6-6 6M5 6l6 6-6 6"
            }
            fill="none"
            stroke={foreground}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
          />
        </Svg>
        <Text
          style={{
            color: muted,
            fontSize: 12,
            fontVariant: ["tabular-nums"],
            fontWeight: "500",
          }}
        >
          {seconds}
        </Text>
      </View>
    </Button>
  )
}
