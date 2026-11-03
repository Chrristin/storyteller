import { useRouter } from "expo-router"
import { X } from "lucide-react-native"
import { TouchableOpacity } from "react-native"

import { setBookPrefs } from "@/lib/bookPrefs"

import { Icon } from "./ui/icon"

/**
 * Closes the book. The place is already saved by the reader; this also marks
 * the book as closed, so the next time it is opened it shows its page (with
 * rating, favourite and delete) instead of resuming straight away.
 */
export function CloseBookButton({ bookUuid }: { bookUuid: string }) {
  const router = useRouter()

  return (
    <TouchableOpacity
      accessibilityLabel="Close book"
      accessibilityRole="button"
      className="size-11 items-center justify-center"
      onPress={() => {
        setBookPrefs(bookUuid, { closed: true })
        if (router.canGoBack()) {
          router.back()
        } else {
          router.replace("/")
        }
      }}
    >
      <Icon as={X} size={24} />
    </TouchableOpacity>
  )
}
