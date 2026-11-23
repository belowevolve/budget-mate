import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Button as ButtonPrimitive } from '@ui-sdk/react/button'
import { ArrowLeft, CreditCard, FileUp, LayoutDashboard, List, ReceiptText, Settings } from 'lucide-react'
import { Button } from '../shared/ui/Button'
import Brand from './Brand'
import type { Page, SettingsView } from './workspaceState'
import './workspaceShell.css'

const destinations = {
  overview: { label: 'Обзор', icon: LayoutDashboard },
  transactions: { label: 'Операции', icon: List },
  credits: { label: 'Кредитки', icon: CreditCard },
  import: { label: 'Импорт', icon: FileUp },
  bills: { label: 'Расчёт', icon: ReceiptText, title: 'Расчёт счёта' },
} as const
const pages = Object.keys(destinations) as Page[]

const settingsTitles = {
  menu: 'Настройки',
  access: 'Способы входа',
  categories: 'Категории',
  places: 'Места',
} satisfies Record<NonNullable<SettingsView>, string>

const scrollableMain = 'min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto overscroll-y-contain scroll-edges-y'

export default function WorkspaceShell({ page, children, onNavigate, onOpenSettings, settings }: {
  page: Page
  children: ReactNode
  onNavigate: (page: Page) => void
  onOpenSettings: () => void
  settings?: { view: NonNullable<SettingsView>; onBack: () => void; content: ReactNode }
}) {
  const shell = useRef<HTMLDivElement>(null)
  const scrollArea = useRef<HTMLElement>(null)
  const settingsArea = useRef<HTMLElement>(null)
  const settingsHeading = useRef<HTMLHeadingElement>(null)
  const settingsTrigger = useRef<HTMLButtonElement>(null)
  const pageHeading = useRef<HTMLHeadingElement>(null)
  const previousSettings = useRef<SettingsView>(null)
  const pageScroll = useRef(0)
  const settingsMenuScroll = useRef(0)
  const header = useRef<HTMLElement>(null)
  const section = settings?.view ?? null

  useLayoutEffect(() => {
    pageScroll.current = 0
    scrollArea.current?.scrollTo({ top: 0 })
    header.current?.removeAttribute('data-scrolled')
    pageHeading.current?.classList.add('motion-safe:animate-[workspace-title-in_160ms_ease-out_both]')
  }, [page])
  useLayoutEffect(() => {
    const previous = previousSettings.current
    previousSettings.current = section
    if (previous === section) return
    if (section) {
      const area = settingsArea.current
      area?.scrollTo({ top: section === 'menu' ? settingsMenuScroll.current : 0 })
      header.current?.toggleAttribute('data-scrolled', (area?.scrollTop ?? 0) > 4)
      const restoreTrigger = section === 'menu' && previous && previous !== 'menu'
        ? document.getElementById(`settings-${previous}`) : null
      const focusTarget = restoreTrigger ?? settingsHeading.current
      focusTarget?.focus({ preventScroll: true })
    } else {
      scrollArea.current?.scrollTo({ top: pageScroll.current })
      header.current?.toggleAttribute('data-scrolled', pageScroll.current > 4)
      settingsTrigger.current?.focus({ preventScroll: true })
    }
  }, [section])
  useLayoutEffect(() => {
    const viewport = window.visualViewport
    const layout = shell.current
    if (!viewport || !layout) return
    const fit = () => {
      // Android Chrome may shrink only the visual viewport for the keyboard.
      if (viewport.scale === 1) layout.style.setProperty('--workspace-viewport-height', `${viewport.height}px`)
      else layout.style.removeProperty('--workspace-viewport-height')
    }
    fit()
    viewport.addEventListener('resize', fit)
    return () => {
      viewport.removeEventListener('resize', fit)
      layout.style.removeProperty('--workspace-viewport-height')
    }
  }, [])

  return (
    <div ref={shell} className={`workspace-shell mx-auto flex h-(--workspace-viewport-height,100dvh) min-w-0 max-w-[1760px] flex-col overflow-hidden ${settings ? '' : 'md:grid md:grid-cols-[176px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)]'}`}>
      <aside hidden={Boolean(settings)} className="order-last shrink-0 touch-pinch-zoom border-t border-line bg-paper px-1 pt-1 pb-[calc(.25rem+env(safe-area-inset-bottom))] md:order-0 md:min-h-0 md:touch-auto md:overflow-y-auto md:scroll-edges-y md:border-t-0 md:border-r md:bg-surface md:p-3">
        <div className="hidden md:mb-6 md:block md:px-2 md:pt-2"><Brand /></div>
        <nav aria-label="Разделы" className="grid grid-cols-5 gap-0.5 md:grid-cols-1 md:gap-1">
          {pages.map((id) => {
            const { label, icon: Icon } = destinations[id]
            return (
              <ButtonPrimitive key={id} aria-current={page === id ? 'page' : undefined} onClick={() => onNavigate(id)}
                className="group flex h-auto min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border-0 bg-transparent px-0.5 py-0.5 text-center text-[11px] leading-tight font-semibold text-muted shadow-none hover:bg-subtle aria-[current=page]:font-extrabold aria-[current=page]:text-primary md:flex-row md:justify-start md:gap-2.5 md:px-2 md:text-sm md:aria-[current=page]:bg-selected">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg group-aria-[current=page]:bg-primary group-aria-[current=page]:text-on-primary motion-safe:transition-[background-color,color,scale] motion-safe:duration-150 motion-safe:group-active:scale-90">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="max-w-full wrap-anywhere">{label}</span>
              </ButtonPrimitive>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header ref={header} className="relative z-10 shrink-0 border-b border-line bg-paper pt-[env(safe-area-inset-top)] motion-safe:transition-shadow motion-safe:duration-150 data-scrolled:shadow-top-bar md:pt-0">
          <div className={`mx-auto flex min-h-13 min-w-0 items-center gap-2 px-3 sm:px-5 md:min-h-15 md:px-6 ${settings ? 'max-w-2xl' : 'max-w-315 justify-between'}`}>
            {settings ? (
              <>
                <Button variant="icon" size="compact" icon={ArrowLeft} className="bg-transparent"
                  aria-label={settings.view === 'menu' ? 'Назад' : 'Назад к настройкам'} onClick={settings.onBack} />
                <h1 key={settings.view} ref={settingsHeading} tabIndex={-1} className="min-w-0 text-xl leading-tight wrap-anywhere outline-none md:text-2xl">
                  {settingsTitles[settings.view]}
                </h1>
              </>
            ) : (
              <>
                <h1 key={page} ref={pageHeading} className="min-w-0 truncate text-xl leading-tight md:text-2xl">{page === 'bills' ? destinations.bills.title : destinations[page].label}</h1>
                <Button ref={settingsTrigger} id="workspace-actions" variant="icon" size="compact" icon={Settings}
                  className="bg-transparent" aria-label="Настройки" onClick={() => {
                  settingsMenuScroll.current = 0
                  onOpenSettings()
                }} />
              </>
            )}
          </div>
        </header>

        {settings && (
          <main ref={settingsArea} className="settings-main" onScroll={(event) => {
            const top = event.currentTarget.scrollTop
            if (section === 'menu') settingsMenuScroll.current = top
            header.current?.toggleAttribute('data-scrolled', top > 4)
          }}>
            <div className="settings-page mx-auto w-full min-w-0 max-w-2xl px-3 pt-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-5 md:px-6 md:pt-4">
              {settings.content}
            </div>
          </main>
        )}
        <main ref={scrollArea} hidden={Boolean(settings)} onScroll={(event) => {
          if (settings) return
          pageScroll.current = event.currentTarget.scrollTop
          header.current?.toggleAttribute('data-scrolled', pageScroll.current > 4)
        }} className={page === 'bills' ? 'min-h-0 min-w-0 flex-1 overflow-hidden' : scrollableMain}>
          <div className={page === 'bills' ? 'h-full min-w-0'
            : `mx-auto w-full min-w-0 max-w-315 py-3 sm:px-5 md:px-6 md:py-4 ${page === 'transactions' ? '' : 'px-3'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
