import { Pause, Play } from "lucide-react-native"
import { ActivityIndicator } from "react-native"
import { useCSSVariable } from "uniwind"

import { useColorTheme } from "@/hooks/useColorTheme"
import { Storyteller } from "@/modules/readium"
import { useAppSelector } from "@/store/appState"
import {
  getIsAudioLoading,
  getIsPlaying,
} from "@/store/selectors/bookshelfSelectors"

import { Button, type ButtonProps } from "./ui/button"
import { Icon } from "./ui/icon"

type Props = {
  size?: number | undefined
  automaticRewind?: boolean
  buttonSize?: ButtonProps["size"]
  /** A solid accent circle, for the full player. */
  filled?: boolean
}

export function PlayPause({
  size = 24,
  automaticRewind = true,
  buttonSize = "icon",
  filled = false,
}: Props) {
  const isPlaying = useAppSelector(getIsPlaying)
  const isLoading = useAppSelector(getIsAudioLoading)
  const { foreground } = useColorTheme()
  const onPrimary = useCSSVariable("--color-primary-foreground") as string
  const iconFill = filled ? onPrimary : foreground
  const filledStyle = filled
    ? { height: size * 2, width: size * 2, borderRadius: size }
    : undefined

  if (isLoading) {
    return (
      <ActivityIndicator
        accessibilityLabel="Loading audio"
        accessibilityRole="progressbar"
        size={size}
      />
    )
  }

  return isPlaying ? (
    <Button
      accessibilityLabel="Pause"
      variant={filled ? "default" : "ghost"}
      size={buttonSize}
      style={filledStyle}
      onPress={() => {
        Storyteller.pause()
      }}
    >
      <Icon
        as={Pause}
        className={filled ? "text-primary-foreground" : ""}
        fill={iconFill}
        size={size}
      />
    </Button>
  ) : (
    <Button
      accessibilityLabel="Play"
      variant={filled ? "default" : "ghost"}
      size={buttonSize}
      style={filledStyle}
      onPress={() => {
        Storyteller.play(automaticRewind)
      }}
    >
      <Icon
        as={Play}
        fill={iconFill}
        className={filled ? "text-primary-foreground" : "bg-transparent"}
        size={size}
      />
    </Button>
  )
}
