import { useEffect, useRef, useState } from 'react'

type CloseWatcher = EventTarget & { destroy: () => void }

// Select and DatePicker in ui-sdk beta.14 don't register for Android Back.
export function useAndroidPopupBack(close: () => void) {
  const watcher = useRef<CloseWatcher | null>(null)
  useEffect(() => () => watcher.current?.destroy(), [])

  return (open: boolean) => {
    watcher.current?.destroy()
    watcher.current = null
    if (!open || !navigator.userAgent.includes('Android')) return

    const Watcher = (window as Window & { CloseWatcher?: new () => CloseWatcher }).CloseWatcher
    if (!Watcher) return

    const active = new Watcher()
    active.addEventListener('close', close, { once: true })
    watcher.current = active
  }
}

export function useDialogBackRecovery() {
  const [contentKey, setContentKey] = useState(0)

  function onCanceledClose(reason: string) {
    // Canceling the SDK's state change can't reopen its consumed native watcher.
    if (reason === 'back') setContentKey((key) => key + 1)
  }

  return { contentKey, onCanceledClose }
}
