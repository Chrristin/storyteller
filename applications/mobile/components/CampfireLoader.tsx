import { Image } from "expo-image"
import { useEffect } from "react"
import { View } from "react-native"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"

/* eslint-disable @typescript-eslint/no-require-imports */
const flameSource = require("../assets/campfire-flame.png") as number
const baseSource = require("../assets/campfire-base.png") as number
/* eslint-enable @typescript-eslint/no-require-imports */

/** Where the flame is cut from the stones, as a fraction of the image height. */
const CUT = 555 / 1024

/**
 * The campfire logo with a flickering flame. The picture is split in two: the
 * stones stay still and the flame above them sways and stretches from where it
 * meets the stones.
 */
export function CampfireLoader({ size = 96 }: { size?: number }) {
  const reduceMotion = useReducedMotion()
  const rise = useSharedValue(0)
  const sway = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return
    const ease = Easing.inOut(Easing.sin)
    rise.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 520, easing: ease }),
        withTiming(0.2, { duration: 380, easing: ease }),
        withTiming(0.8, { duration: 460, easing: ease }),
        withTiming(0, { duration: 540, easing: ease }),
      ),
      -1,
    )
    sway.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: ease }),
        withTiming(-1, { duration: 1100, easing: ease }),
      ),
      -1,
      true,
    )
    return () => {
      cancelAnimation(rise)
      cancelAnimation(sway)
    }
  }, [reduceMotion, rise, sway])

  // Scale and rotate around the line where the flame meets the stones.
  const pivot = (CUT - 0.5) * size
  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: pivot },
      { rotate: `${sway.value * 1.6}deg` },
      { scaleX: 1 - rise.value * 0.03 },
      { scaleY: 1 + rise.value * 0.07 },
      { translateY: -pivot },
    ],
  }))

  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={{ height: size, width: size }}
    >
      <Image
        contentFit="contain"
        source={baseSource}
        style={{ height: size, position: "absolute", width: size }}
      />
      <Animated.View
        style={[
          { height: size, position: "absolute", width: size },
          flameStyle,
        ]}
      >
        <Image
          contentFit="contain"
          source={flameSource}
          style={{ height: size, width: size }}
        />
      </Animated.View>
    </View>
  )
}
