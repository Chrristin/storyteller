import { colors } from "@/components/ui/tokens/colors"

export const defaultPreferences: Preferences = {
  darkMode: "auto",
  showReaderUi: false,
  colorThemes: [
    {
      name: "Day",
      foreground: colors.gray9,
      background: colors.white,
      isDark: false,
    },
    {
      name: "Sepia",
      foreground: colors.brown9,
      background: colors.yellow0,
      isDark: false,
    },
    {
      name: "Crisp White",
      foreground: colors.black,
      background: colors.white,
      isDark: false,
    },
    {
      name: "Night",
      foreground: colors.gray3,
      background: colors.black,
      isDark: true,
    },
    {
      name: "Dark Grey",
      foreground: "#d6d6d6",
      background: "#121212",
      isDark: true,
    },
    {
      name: "Soft Grey",
      foreground: "#c8c8c8",
      background: "#1a1a1a",
      isDark: true,
    },
    {
      name: "Warm Dark",
      foreground: "#cfc6b8",
      background: "#1b1815",
      isDark: true,
    },
    {
      name: "OLED Black",
      foreground: "#bdbdbd",
      background: "#000000",
      isDark: true,
    },
    {
      name: "Paper",
      foreground: "#222222",
      background: "#fbfaf7",
      isDark: false,
    },
    {
      name: "Soft Sepia",
      foreground: "#3b3226",
      background: "#f4ecd8",
      isDark: false,
    },
  ],
  lightTheme: "Day",
  darkTheme: "Night",
  typography: {
    scale: 1.0,
    lineHeight: 1.4,
    alignment: "justify",
    fontFamily: "Literata",
  },
  layout: {
    margins: {
      vertical: 1.0,
      horizontal: 1.0,
    },
    marginLeft: 0,
    marginRight: 0,
    columns: "auto",
    animation: true,
    scroll: false,
  },
  floatingToolbar: false,
  readaloudColor: "yellow",
  readaloudDecoratorStyle: "highlight",
  customFonts: [],
  automaticRewind: {
    enabled: true,
    afterInterruption: 3,
    afterBreak: 10,
  },
  hideStatusbar: {
    enabled: true,
  },
  logLevel: "info",
}

export type ColorTheme = {
  name: string
  foreground: string
  background: string
  isDark: boolean
}

type TypographyPreferences = {
  scale: number
  lineHeight: number
  alignment: "left" | "justify"
  fontFamily: string
}

type LayoutPreferences = {
  margins: {
    vertical: number
    horizontal: number
  }
  marginLeft?: number
  marginRight?: number
  columns: 1 | 2 | "auto"
  animation: boolean
  scroll?: boolean
}

type AudioPreferences = {
  speed: number
  readaloudSpeed: number
}

type AutomaticRewindPreferences = {
  enabled: boolean
  afterInterruption: number
  afterBreak: number
}

export type ReadaloudDecoratorStyle = "highlight" | "underline"

export interface BookPreferences {
  typography?: Partial<TypographyPreferences>
  layout?: Partial<LayoutPreferences>
  audio?: Partial<AudioPreferences>
  readaloudColor?: string
  readaloudDecoratorStyle?: ReadaloudDecoratorStyle
  detailView?: {
    mode: "audio" | "text"
    scope: "chapter" | "book"
  }
}

export type CustomFont = {
  filename: string
  name: string
  type: "ttf" | "otf"
}

export type HideStatusbarPreferences = {
  enabled: boolean
}

export interface Preferences {
  darkMode: boolean | "auto"
  colorThemes: ColorTheme[]
  showReaderUi: boolean
  lightTheme: string
  darkTheme: string
  typography: TypographyPreferences
  layout: LayoutPreferences
  readaloudColor: string
  readaloudDecoratorStyle: ReadaloudDecoratorStyle
  customFonts: CustomFont[]
  hideStatusbar: HideStatusbarPreferences
  automaticRewind: AutomaticRewindPreferences
  logLevel: "debug" | "info" | "error"
  floatingToolbar: boolean
}
