import { View } from "react-native"

import { useColorTheme } from "@/hooks/useColorTheme"

import { CampfireLoader } from "./CampfireLoader"

export function LoadingView() {
  const { background } = useColorTheme()

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: background,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <View
        style={[
          {
            position: "absolute",
            top: 0,
            // Trying to line up with the Readium loading indicator
            bottom: 20,
            left: 0,
            right: 0,
            backgroundColor: background,
            justifyContent: "center",
            alignItems: "center",
          },
          {
            backgroundColor: background,
          },
        ]}
      >
        <CampfireLoader size={96} />
      </View>
    </View>
  )
}
