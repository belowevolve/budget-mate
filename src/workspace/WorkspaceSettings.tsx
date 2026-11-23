import { useState, type ReactNode } from 'react'
import { useAtom } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog'
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control'
import { Archive, Bell, ChevronRight, Fingerprint, LockKeyhole, MapPin, Phone, SunMoon, Tags, X, type LucideIcon } from 'lucide-react'
import CategoryEditor from '../categories/CategoryEditor'
import { SheetGrip } from '../components/SheetGrip'
import BrowserReminderSettings from '../credits/BrowserReminderSettings'
import type { Ledger } from '../finance'
import type { Notify } from '../notifications/presentation'
import type { Place } from '../places/model'
import PlaceSettings from '../places/PlaceSettings'
import { currentThemePreference, isThemePreference, saveThemePreference, themeLabels } from '../theme'
import type { VaultUnlockMethods } from '../vault'
import { AccessSettings } from '../vault-ui/AccessSettings'
import BackupSettings from '../vault-ui/BackupSettings'
import type { VaultAccess } from '../vault-ui/useVaultSession'
import TransferSettings from './TransferSettings'
import type { SettingsView } from './workspaceState'

const links = [
  { view: 'categories', label: 'Категории', icon: Tags },
  { view: 'places', label: 'Места', icon: MapPin },
  { view: 'access', label: 'Способы входа', icon: Fingerprint },
] as const

function SettingsCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="surface-panel card-padding grid gap-2.5" aria-label={title}>
      <h2 className="section-heading flex items-center gap-2.5">
        <span className="dialog-icon"><Icon size={17} aria-hidden="true" /></span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function WorkspaceSettings({ view, onView, ledger, places, vault, methods, canReplaceKey, savePhone, notify, onEditPlaceBindings, onNotificationPermission }: {
  view: SettingsView
  onView: (view: SettingsView) => void
  ledger: Ledger
  places: Place[]
  vault: VaultAccess
  methods: VaultUnlockMethods
  canReplaceKey: boolean
  savePhone: (phone: string | null) => Promise<void>
  notify: Notify
  onEditPlaceBindings: (fromId: string, aliases: string[], toId: string | null) => Promise<void>
  onNotificationPermission: () => void
}) {
  const [theme, setTheme] = useState(currentThemePreference)
  const [restorePending] = useAtom(vault.replaceFromBackup.pending)
  if (!view) return null

  return (
    <div className="settings-content mx-auto grid w-full max-w-2xl min-w-0 content-start gap-3">
      {view === 'menu' && (
        <>
          <SettingsCard title="Тема" icon={SunMoon}>
            <SegmentedControl aria-label="Цветовая тема" value={theme} onValueChange={(next) => {
              if (!isThemePreference(next)) return
              saveThemePreference(next)
              setTheme(next)
            }} className="segmented-control">
              <SegmentedControlIndicator />
              {Object.entries(themeLabels).map(([value, label]) => (
                <SegmentedControlItem key={value} value={value}>
                  {label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </SettingsCard>
          <SettingsCard title="Уведомления браузера" icon={Bell}>
            <BrowserReminderSettings notify={notify} onPermission={onNotificationPermission} />
          </SettingsCard>
          <SettingsCard title="Номер для СБП" icon={Phone}>
            <TransferSettings maskedPhone={ledger.sbp?.ownPhone?.label} onChange={savePhone} />
          </SettingsCard>
          <nav aria-label="Другие настройки" className="surface-panel overflow-hidden">
            <ul className="list-none divide-y divide-line">
              {links.map(({ view, label, icon: Icon }) => (
                <li key={view}>
                  <Button id={`settings-${view}`} className="settings-row" onClick={() => onView(view)}>
                    <Icon size={18} className="shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 wrap-anywhere">{label}</span>
                    <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden="true" />
                  </Button>
                </li>
              ))}
              <li>
                <Dialog presentation="auto" dismissible={!restorePending}>
                  <DialogTrigger className="settings-row" id="settings-backup">
                    <Archive size={18} className="shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 wrap-anywhere">Резервная копия</span>
                    <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden="true" />
                  </DialogTrigger>
                  <DialogContent initialFocus="content" className="compact-dialog grid-rows-[auto_minmax(0,1fr)]">
                    <div className="dialog-header">
                      <SheetGrip />
                      <DialogTitle className="min-w-0 text-lg leading-tight">Резервная копия</DialogTitle>
                      <DialogClose className="dialog-close" aria-label="Закрыть резервную копию" disabled={restorePending > 0}>
                        <X size={17} aria-hidden="true" />
                      </DialogClose>
                    </div>
                    <BackupSettings vault={vault} />
                  </DialogContent>
                </Dialog>
              </li>
              <li>
                <Button className="settings-row" onClick={vault.lock}>
                  <LockKeyhole size={18} className="shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 wrap-anywhere">Заблокировать</span>
                </Button>
              </li>
            </ul>
          </nav>
        </>
      )}
      {view === 'categories' && <CategoryEditor write={vault.write} />}
      {view === 'places' && <PlaceSettings places={places} write={vault.write} transactions={ledger.transactions} onEditBindings={onEditPlaceBindings} />}
      {view === 'access' && <div className="surface-panel card-padding"><AccessSettings vault={vault} methods={methods} canReplaceKey={canReplaceKey} /></div>}
    </div>
  )
}
