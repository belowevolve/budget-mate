export const themeLabels = {
  system: 'Системная',
  light: 'Светлая',
  dark: 'Тёмная',
} as const

export type ThemePreference = keyof typeof themeLabels

const storageKey = 'budgetmates.theme'

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function currentThemePreference(): ThemePreference {
  const preference = document.documentElement.dataset.theme
  return isThemePreference(preference) ? preference : 'system'
}

function storedThemePreference(): ThemePreference {
  try {
    const preference = localStorage.getItem(storageKey)
    return isThemePreference(preference) ? preference : 'system'
  } catch {
    return 'system'
  }
}

function updateThemeColor() {
  const color = getComputedStyle(document.documentElement).backgroundColor
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', color)
}

function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = preference
  updateThemeColor()
}

export function saveThemePreference(preference: ThemePreference) {
  applyTheme(preference)
  try {
    localStorage.setItem(storageKey, preference)
  } catch {
    // The selected theme still works for this visit when storage is unavailable.
  }
}

export function initializeTheme() {
  applyTheme(storedThemePreference())
  const systemTheme = matchMedia('(prefers-color-scheme: dark)')
  systemTheme.addEventListener('change', updateThemeColor)
  return () => systemTheme.removeEventListener('change', updateThemeColor)
}
