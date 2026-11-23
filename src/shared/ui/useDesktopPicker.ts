import { useSyncExternalStore } from 'react'

const desktopPickerQuery = '(min-width: 48rem) and (pointer: fine)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(desktopPickerQuery)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function useDesktopPicker() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(desktopPickerQuery).matches, () => false)
}
