import { useEffect, useState } from "react"
import { View } from "react-native"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Text } from "./ui/text"

/**
 * Your own notes on a book. They are saved as your review on the server, so
 * they show up in the web app too.
 */
export function BookNotes({
  review,
  onSave,
}: {
  review: string
  onSave: (review: string) => void
}) {
  const [draft, setDraft] = useState(review)
  const [focused, setFocused] = useState(false)

  // Pick up a change from the server, but never while you are typing.
  useEffect(() => {
    if (!focused) setDraft(review)
  }, [review, focused])

  const changed = draft.trim() !== review.trim()

  return (
    <View className="mb-4 gap-2 self-stretch">
      <Text className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Your notes
      </Text>
      <Input
        accessibilityLabel="Your notes on this book"
        className="min-h-24 items-start py-3"
        multiline
        onBlur={() => setFocused(false)}
        onChangeText={setDraft}
        onFocus={() => setFocused(true)}
        placeholder="Add a note or review"
        textAlignVertical="top"
        value={draft}
      />
      {changed && (
        <Button
          accessibilityLabel="Save notes"
          className="self-end"
          onPress={() => onSave(draft)}
          size="sm"
        >
          <Text>Save</Text>
        </Button>
      )}
    </View>
  )
}
