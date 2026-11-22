import { action, atom, computed, withAsync, wrap } from '@reatom/core'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import { billTotals, newBill, ownerId, parseBillPrice, saveBill, type Bill, type BillItem } from './bill'

const emptyItem = { name: '', price: '', quantity: '1' }

export function reatomBillEditor() {
  const draft = atom(newBill(), 'bill.draft')
  const totals = computed(() => billTotals(draft()), 'bill.totals')
  const changed = atom(false, 'bill.changed')
  const targets = atom([ownerId], 'bill.targets')
  const itemForm = atom(emptyItem, 'bill.itemForm')
  const editing = atom<string | null>(null, 'bill.editingItem')
  const error = atom('', 'bill.error')

  function change(next: Bill) {
    draft.set(next)
    changed.set(true)
    error.set('')
  }

  const openBill = action((bill = newBill()) => {
    draft.set(bill)
    changed.set(false)
    targets.set([ownerId])
    itemForm.set(emptyItem)
    editing.set(null)
    error.set('')
  }, 'bill.open')

  const addPerson = action((input: string) => {
    const current = draft()
    const name = input.trim()
    if (!name || current.people.some((person) => person.name.toLowerCase() === name.toLowerCase())) return false
    const person = { id: crypto.randomUUID(), name }
    change({ ...current, people: [...current.people, person] })
    if (!editing()) targets.set([person.id])
    return true
  }, 'bill.addPerson')

  const removePerson = action((personId: string) => {
    if (personId === ownerId) return
    const current = draft()
    if (current.items.some((item) => item.personId === personId)) return
    change({ ...current, people: current.people.filter((person) => person.id !== personId) })
    targets.set((ids) => ids.filter((id) => id !== personId))
  }, 'bill.removePerson')

  const editItem = action((item?: BillItem) => {
    editing.set(item?.id ?? null)
    error.set('')
    itemForm.set(item ? { name: item.name, price: String(item.priceMinor / 100).replace('.', ','), quantity: String(item.quantity) } : emptyItem)
  }, 'bill.editItem')

  const addItem = action(() => {
    const current = draft()
    const { name, price, quantity } = itemForm()
    const priceMinor = parseBillPrice(price)
    const count = Number(quantity)
    if (!priceMinor || !/^\d{1,3}$/.test(quantity) || count < 1) {
      error.set('Укажи цену и количество от 1 до 999.')
      return false
    }
    const active = editing()
    const selected = current.people.filter((person) => targets().includes(person.id))
    if (!active && !selected.length) {
      error.set('Выбери, кому добавить позицию.')
      return false
    }
    const fields = { name: name.trim() || 'Позиция', priceMinor, quantity: count }
    const items = active
      ? current.items.map((item) => item.id === active ? { ...item, ...fields } : item)
      : [...current.items, ...selected.map(({ id }) => ({ ...fields, id: crypto.randomUUID(), personId: id }))]
    const next = { ...current, items }
    if (!Number.isSafeInteger(billTotals(next).total)) {
      error.set('Итог слишком большой.')
      return false
    }
    change(next)
    editItem()
    return true
  }, 'bill.addItem')

  const removeItem = action((id: string) => {
    const current = draft()
    change({ ...current, items: current.items.filter((item) => item.id !== id) })
    if (editing() === id) editItem()
  }, 'bill.removeItem')

  const save = action(async (write: VaultWrite, notify: (message: string) => void) => {
    const bill = draft()
    try {
      const stored = await wrap(write((current) => {
        const ledger = saveBill(current, bill)
        return { ledger, result: ledger.bills?.[0] ?? bill }
      }))
      if (draft() === bill) {
        draft.set(stored)
        changed.set(false)
      }
      error.set('')
      notify('Счёт сохранён')
    } catch (cause) {
      error.set(messageFor(cause, 'Не удалось сохранить счёт.'))
    }
  }, 'bill.save').extend(withAsync())

  return {
    draft, totals, changed, targets, itemForm, editing, error, openBill, addPerson, removePerson, editItem, addItem, removeItem, save,
    setTitle: action((title: string) => change({ ...draft(), title }), 'bill.setTitle'),
    setTargets: action((ids: string[]) => targets.set(ids), 'bill.setTargets'),
    setItemField: action((name: keyof typeof emptyItem, value: string) => {
      itemForm.set((values) => ({ ...values, [name]: value }))
      error.set('')
    }, 'bill.setItemField'),
  }
}
