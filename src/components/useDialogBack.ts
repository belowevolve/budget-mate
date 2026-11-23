import { useEffect, useRef, useState } from 'react'

type CloseChoice = () => void
type CloseWatcher = EventTarget & { destroy: () => void }

export function useAndroidPickerBack(close: CloseChoice) {
  const closeWatcher = useRef<CloseWatcher | null>(null)
  useEffect(() => () => { closeWatcher.current?.destroy() }, [])

  return (open: boolean) => {
    closeWatcher.current?.destroy()
    closeWatcher.current = null
    const Watcher = (window as Window & { CloseWatcher?: new () => CloseWatcher }).CloseWatcher
    if (!open || !Watcher || !navigator.userAgent.includes('Android')) return

    // These SDK pickers need a separate watcher when opened over a dialog.
    const watcher = new Watcher()
    watcher.addEventListener('close', close, { once: true })
    closeWatcher.current = watcher
  }
}

export function useDialogBack() {
  const [contentKey, setContentKey] = useState(0)
  const [choicePresent, setChoicePresent] = useState(false)
  const closeChoice = useRef<CloseChoice | null>(null)
  const replaceAfterChoice = useRef(false)

  function rearm() {
    // A native Back consumes ui-sdk's CloseWatcher. Reattach its content when the dialog stays open.
    setContentKey((key) => key + 1)
  }

  function onChoicePresence(close: CloseChoice | null) {
    closeChoice.current = close
    setChoicePresent(!!close)
    if (!close && replaceAfterChoice.current) {
      replaceAfterChoice.current = false
      rearm()
    }
  }

  function onDismissAttempt({ reason }: { reason: string }) {
    if (reason !== 'back' || !closeChoice.current) return false
    // Select sheets use their parent dialog's native Back handler.
    replaceAfterChoice.current = true
    closeChoice.current()
    return true
  }

  return { contentKey, choicePresent, rearm, onChoicePresence, onDismissAttempt }
}
