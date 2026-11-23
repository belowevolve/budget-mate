import type { ReactNode } from 'react'
import { Button } from '@ui-sdk/react/button'
import { cn } from 'cn'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { noticeIcons, type NotificationKind } from './feedback'

export default function Notice({ title, children, action, open, tone = 'info', icon }: {
  title: string
  children?: ReactNode
  tone?: NotificationKind
  icon?: LucideIcon
} & ({ action?: ReactNode; open?: never } | { action?: never; open: { label: string; onClick: () => void } })) {
  const Icon = icon ?? noticeIcons[tone]
  const Root = open ? Button : 'div'

  return (
    <Root data-tone={tone} className={cn(
      'grid min-w-0 items-center gap-x-2 gap-y-1.5 rounded-xl bg-subtle px-3 text-ink',
      'data-[tone=error]:bg-danger-soft data-[tone=error]:text-danger data-[tone=success]:bg-income-soft data-[tone=success]:text-income data-[tone=warning]:bg-warning-soft data-[tone=warning]:text-warning',
      open
        ? 'group h-auto min-h-11 w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] border-0 py-2.5 text-start font-normal whitespace-normal shadow-none'
        : 'grid-cols-[auto_minmax(0,1fr)] py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]',
    )} onClick={open?.onClick}>
      <Icon size={17} className="mt-0.5 self-start" aria-hidden="true" />
      <span className="min-w-0 text-sm leading-snug wrap-anywhere">
        <strong className="block font-bold">{title}</strong>
        {children && <span className="mt-0.5 block text-xs">{children}</span>}
      </span>
      {open && (
        <span className="inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap group-hover:underline">
          {open.label}<ChevronRight size={16} aria-hidden="true" />
        </span>
      )}
      {action && <span className="col-start-2 min-w-0 sm:col-start-auto">{action}</span>}
    </Root>
  )
}
