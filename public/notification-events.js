self.addEventListener('notificationclick', (event) => {
  if (event.notification.data?.open !== 'credit-reminders') return
  event.waitUntil((async () => {
    const home = new URL(self.registration.scope)
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const client = windows.find(({ url }) => new URL(url).pathname === home.pathname)
    if (client) {
      client.postMessage('budgetmates:open-credit-reminders')
      await client.focus()
      return
    }
    home.hash = 'credit-reminders'
    await self.clients.openWindow(home.href)
  })())
})
