import { action, atom, onEvent, withAsync, withConnectHook, wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { browserNotificationPermission, showNotificationTest } from '../notifications/browser'
import { Button } from '../shared/ui/Button'
import type { Notify } from '../shared/ui/feedback'

export default reatomFactoryComponent<{ onPermission: () => void; notify: Notify }>(() => {
  const permission = atom(browserNotificationPermission(), 'credit.notificationPermission').extend(withConnectHook((target) => {
    const refresh = () => target.set(browserNotificationPermission())
    onEvent(window, 'focus', refresh)
    onEvent(document, 'visibilitychange', refresh)
  }))

  const enable = action(async (onPermission: () => void, notify: Notify) => {
    try {
      const granted = await wrap(Notification.requestPermission())
      permission.set(granted)
      if (granted === 'granted') onPermission()
    } catch {
      notify('Не удалось запросить разрешение браузера.', 'error')
    }
  }, 'credit.enableBrowserNotifications').extend(withAsync())

  const sendTest = action(async (notify: Notify) => {
    try {
      if (await wrap(showNotificationTest())) notify('Проверочное уведомление передано браузеру.', 'success')
      else notify('Браузер ещё запускает уведомления. Попробуй снова.', 'info')
    } catch {
      permission.set(browserNotificationPermission())
      notify('Браузер не показал уведомление. Проверь разрешение для сайта.', 'error')
    }
  }, 'credit.testBrowserNotification').extend(withAsync())

  return ({ onPermission, notify }) => {
    const status = permission()
    const explanation = {
      default: 'Системное уведомление за день до платежа, пока страница открыта.',
      denied: 'Включи уведомления в настройках сайта в браузере.',
      granted: 'Напоминания срабатывают, пока вкладка работает.',
      unsupported: 'Для уведомлений нужен совместимый браузер и HTTPS или localhost.',
    }[status]
    const title = {
      default: 'Требуется разрешение',
      denied: 'Разрешение отключено',
      granted: 'Разрешены',
      unsupported: 'Уведомления недоступны',
    }[status]
    return (
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div role="status" className="min-w-0">
          <p className={status === 'denied' ? 'text-sm font-bold text-warning' : 'text-sm font-bold'}>{title}</p>
          <p className="mt-0.5 text-sm leading-snug text-muted">{explanation}</p>
        </div>
        {status === 'default' && (
          <Button variant="secondary" className="shrink-0" disabled={!enable.ready()} onClick={wrap(() => enable(onPermission, notify))}>Разрешить</Button>
        )}
        {status === 'granted' && (
          <Button variant="secondary" className="shrink-0" disabled={!sendTest.ready()} onClick={wrap(() => sendTest(notify))}>Проверить</Button>
        )}
      </div>
    )
  }
}, 'BrowserReminderSettings')
