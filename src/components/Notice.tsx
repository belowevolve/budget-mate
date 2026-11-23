import type { ReactNode } from 'react'
import { Button } from '@ui-sdk/react/button'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { noticeIcons, type NotificationKind } from '../notifications/presentation'

export default function Notice({ title, children, action, open, tone = 'info', icon }: {
  title: string
  children?: ReactNode
  tone?: NotificationKind
  icon?: LucideIcon
} & ({ action?: ReactNode; open?: never } | { action?: never; open: { label: string; onClick: () => void } })) {
  const Icon = icon ?? noticeIcons[tone]
  const Root = open ? Button : 'div'

  return (
    <Root data-tone={tone} className={open ? 'notice notice-link' : 'notice'} onClick={open?.onClick}>
      <Icon size={17} className="mt-0.5 self-start" aria-hidden="true" />
      <span className="min-w-0 text-sm leading-snug wrap-anywhere">
        <strong className="block font-bold">{title}</strong>
        {children && <span className="mt-0.5 block text-xs">{children}</span>}
      </span>
      {open && <span className="notice-link-label">{open.label}<ChevronRight size={16} aria-hidden="true" /></span>}
      {action && <span className="col-start-2 min-w-0 sm:col-start-auto">{action}</span>}
    </Root>
  )
}
