import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export function ChoiceTriggerContent({ icon, children, direction = 'down' }: {
  icon?: ReactNode
  children: ReactNode
  direction?: 'down' | 'next'
}) {
  const Chevron = direction === 'next' ? ChevronRight : ChevronDown
  const arrowMotion = direction === 'down' ? ' opacity-80 transition-transform group-data-open:rotate-180 motion-reduce:transition-none' : ''

  return (
    <>
      {icon}
      {typeof children === 'string' ? <span className="min-w-0 truncate">{children}</span> : children}
      <Chevron size={16} className={`ms-auto shrink-0${arrowMotion}`} aria-hidden="true" />
    </>
  )
}
