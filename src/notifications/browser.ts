import { calendarDayOffset, creditReminderPlan, isCreditReminderDue } from '../credits/creditAccounts'
import { localDate, type Ledger } from '../finance'

const creditTag = 'budgetmates:credit-deadline'
const testTag = 'budgetmates:notification-test'
const notificationTitle = 'budgetmate'
const notificationIcon = 'icons/budgetmate-192.png'
export const creditReminderHash = '#credit-reminders'
const creditReminderClick = 'budgetmates:open-credit-reminders'

export function browserNotificationPermission(): NotificationPermission | 'unsupported' {
  return window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator
    ? Notification.permission
    : 'unsupported'
}

async function browserRegistration() {
  const registration = await navigator.serviceWorker.getRegistration()
  return registration?.active?.state === 'activated' ? registration : undefined
}

export async function showNotificationTest() {
  const registration = await browserRegistration()
  if (!registration) return false
  await registration.showNotification(notificationTitle, {
    body: 'Браузерные уведомления работают.',
    icon: new URL(notificationIcon, registration.scope).href,
    tag: testTag,
  })
  return true
}

export function openCreditRemindersFromNotification() {
  if (!('serviceWorker' in navigator)) return
  function openReminders(event: MessageEvent) {
    if (event.data === creditReminderClick) window.location.hash = creditReminderHash
  }
  navigator.serviceWorker.addEventListener('message', openReminders)
  return () => navigator.serviceWorker.removeEventListener('message', openReminders)
}

export function createBrowserReminderScheduler() {
  let plan: ReturnType<typeof creditReminderPlan> | null = null
  let planKey: string | undefined
  let reconciled: string | undefined
  let channel: BroadcastChannel | undefined
  let processing = false
  let again = false
  let enabled = false

  async function reconcile() {
    if (!enabled || plan === null || browserNotificationPermission() !== 'granted') {
      reconciled = undefined
      return
    }
    const today = localDate()
    const tomorrow = calendarDayOffset(today, 1)
    const due = plan.filter((item) => isCreditReminderDue(item, today, tomorrow))
    const next = JSON.stringify(due)
    if (next === reconciled) return
    const snapshot = plan
    async function syncNotification() {
      const registration = await browserRegistration()
      if (!registration) return
      const existing = await registration.getNotifications({ tag: creditTag })
      if (!enabled || plan !== snapshot) return
      if (!due.length) {
        existing.forEach((notification) => notification.close())
      } else {
        const accounts = [...new Set(due.map((item) => item.accountLabel))]
        const title = accounts.length === 1 ? 'Платёж по кредитке' : 'Платежи по кредиткам'
        const body = accounts.join('\n')
        if (!existing.some((notification) => notification.title === title && notification.body === body)) {
          await registration.showNotification(title, {
            body,
            icon: new URL(notificationIcon, registration.scope).href,
            tag: creditTag,
            requireInteraction: true,
            data: { open: 'credit-reminders' },
          })
        }
      }
      if (plan === snapshot) reconciled = next
    }
    if ('locks' in navigator) await navigator.locks.request(creditTag, syncNotification)
    else await syncNotification()
  }

  function refresh() {
    if (!enabled) return
    if (processing) {
      again = true
      return
    }
    processing = true
    void reconcile().catch(() => {
      reconciled = undefined
    }).finally(() => {
      processing = false
      if (again) {
        again = false
        refresh()
      }
    })
  }

  return {
    update(ledger: Ledger) {
      const next = creditReminderPlan(ledger)
      const key = JSON.stringify(next)
      if (plan !== null && key === planKey) return
      if (key !== planKey) channel?.postMessage('changed')
      plan = next
      planKey = key
      refresh()
    },
    mount() {
      if (browserNotificationPermission() === 'unsupported') return
      enabled = true
      if (typeof BroadcastChannel === 'function') {
        channel = new BroadcastChannel('budgetmates:credit-reminders')
        channel.onmessage = (event) => {
          if (event.data !== 'changed') return
          plan = null
          reconciled = undefined
        }
      }
      document.addEventListener('visibilitychange', refresh)
      window.addEventListener('focus', refresh)
      navigator.serviceWorker.addEventListener('controllerchange', refresh)
      const interval = window.setInterval(refresh, 60_000)
      refresh()
      return () => {
        enabled = false
        channel?.close()
        channel = undefined
        document.removeEventListener('visibilitychange', refresh)
        window.removeEventListener('focus', refresh)
        navigator.serviceWorker.removeEventListener('controllerchange', refresh)
        window.clearInterval(interval)
        plan = null
        planKey = undefined
        reconciled = undefined
      }
    },
    refresh,
  }
}
