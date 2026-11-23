import type { ReactNode } from 'react'

export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{children}</div>
}
