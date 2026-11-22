import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button } from '@ui-sdk/react/button'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@ui-sdk/react/menu'
import { CreditCard, Ellipsis, FileUp, Fingerprint, LayoutDashboard, List, LockKeyhole, Phone, ReceiptText } from 'lucide-react'
import Brand from './Brand'
import type { Page, SettingsDialog } from './workspaceState'
import './workspaceShell.css'

const destinations = {
  overview: { label: 'Обзор', icon: LayoutDashboard },
  transactions: { label: 'Операции', icon: List },
  credits: { label: 'Кредитки', icon: CreditCard },
  import: { label: 'Импорт', icon: FileUp },
  bills: { label: 'Расчёт', icon: ReceiptText, title: 'Расчёт счёта' },
} as const
const pages = Object.keys(destinations) as Page[]

function WorkspaceMenu({ onOpenSettings, onLock }: {
  onOpenSettings: (view: SettingsDialog) => void
  onLock: () => void
}) {
  const nextDialog = useRef<SettingsDialog>(null)

  return (
    <Menu
      onAction={(value) => {
        if (value === 'lock') onLock()
        if (value === 'phone' || value === 'access') nextDialog.current = value
      }}
      onOpenChangeComplete={(open) => {
        if (open || !nextDialog.current) return
        const dialog = nextDialog.current
        nextDialog.current = null
        onOpenSettings(dialog)
      }}
    >
      <MenuTrigger id="workspace-actions" aria-label="Ещё действия и настройки" className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border-0 bg-transparent px-2 text-sm font-bold text-primary shadow-none hover:bg-subtle data-open:bg-selected sm:px-3">
        <Ellipsis size={20} aria-hidden="true" />
        <span>Ещё</span>
      </MenuTrigger>
      <MenuContent align="end" sideOffset={6} collisionPadding={10} className="z-20 max-h-(--available-height) w-[min(15rem,calc(100vw-20px))] overflow-y-auto rounded-2xl border border-line bg-paper p-1 text-ink shadow-popup motion-safe:transition-[opacity,scale] motion-safe:duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0">
        <MenuItem className="workspace-menu-item" value="phone"><Phone size={18} className="shrink-0 text-primary" aria-hidden="true" /> Номер для СБП</MenuItem>
        <MenuItem className="workspace-menu-item" value="access"><Fingerprint size={18} className="shrink-0 text-primary" aria-hidden="true" /> Способы входа</MenuItem>
        <MenuSeparator className="my-1 border-0 border-t border-line" />
        <MenuItem className="workspace-menu-item" value="lock"><LockKeyhole size={18} className="shrink-0 text-primary" aria-hidden="true" /> Заблокировать</MenuItem>
      </MenuContent>
    </Menu>
  )
}

export default function WorkspaceShell({ page, children, onNavigate, onOpenSettings, onLock }: {
  page: Page
  children: ReactNode
  onNavigate: (page: Page) => void
  onOpenSettings: (view: SettingsDialog) => void
  onLock: () => void
}) {
  const scrollArea = useRef<HTMLElement>(null)
  const header = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    scrollArea.current?.scrollTo({ top: 0 })
    header.current?.removeAttribute('data-scrolled')
  }, [page])

  return (
    <div className="mx-auto flex h-dvh min-w-0 max-w-[1760px] flex-col overflow-hidden md:grid md:grid-cols-[176px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="order-last shrink-0 border-t border-line bg-paper px-1 pt-1 pb-[calc(.25rem+env(safe-area-inset-bottom))] md:order-none md:min-h-0 md:overflow-y-auto md:border-t-0 md:border-r md:bg-surface md:p-3">
        <div className="hidden md:mb-6 md:block md:px-2 md:pt-2"><Brand /></div>
        <nav aria-label="Разделы" className="grid grid-cols-5 gap-0.5 md:grid-cols-1 md:gap-1">
          {pages.map((id) => {
            const { label, icon: Icon } = destinations[id]
            return (
              <Button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}
                className="group flex h-auto min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border-0 bg-transparent px-0.5 py-0.5 text-center text-[11px] leading-tight font-semibold text-muted shadow-none hover:bg-subtle aria-[current=page]:font-extrabold aria-[current=page]:text-primary md:flex-row md:justify-start md:gap-2.5 md:px-2 md:text-sm md:aria-[current=page]:bg-selected">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg group-aria-[current=page]:bg-primary group-aria-[current=page]:text-on-primary motion-safe:transition-[background-color,color,scale] motion-safe:duration-150 motion-safe:group-active:scale-90">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="max-w-full wrap-anywhere">{label}</span>
              </Button>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header ref={header} className="relative z-10 shrink-0 border-b border-line bg-paper pt-[env(safe-area-inset-top)] motion-safe:transition-shadow motion-safe:duration-150 data-scrolled:shadow-top-bar md:pt-0">
          <div className="mx-auto flex min-h-13 min-w-0 max-w-[1260px] items-center justify-between gap-2 px-3 sm:px-5 md:min-h-15 md:px-6">
            <h1 key={page} className="min-w-0 truncate text-xl leading-tight md:text-2xl motion-safe:animate-[workspace-title-in_160ms_ease-out_both]">{page === 'bills' ? destinations.bills.title : destinations[page].label}</h1>
            <WorkspaceMenu onOpenSettings={onOpenSettings} onLock={onLock} />
          </div>
        </header>

        <main ref={scrollArea} onScroll={(event) => header.current?.toggleAttribute('data-scrolled', event.currentTarget.scrollTop > 4)}
          className="scroll-fade scroll-fade-3 min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain">
          <div className="mx-auto w-full min-w-0 max-w-[1260px] px-3 py-3 sm:px-5 md:px-6 md:py-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
