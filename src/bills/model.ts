import { action, atom, computed, withAsync, wrap } from '@reatom/core'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import { billItemGroup, billTotals, newBill, ownerId, parseBillPrice, saveBill, type Bill, type BillItem, type BillItemChanges, type BillPerson } from './bill'

const emptyItem = { name: '', price: '' }

export type BillItemForm = typeof emptyItem

interface BillPersonRemoval {
  billId: string
  person: BillPerson
  index: number
  items: BillItem[]
  targetsBefore: string[]
  targetsAfter: string[]
}

export function reatomBillEditor() {
  const draft = atom(newBill(), 'bill.draft')
  const totals = computed(() => billTotals(draft()), 'bill.totals')
  const changed = atom(false, 'bill.changed')
  const targets = atom([ownerId], 'bill.targets')
  const itemForm = atom(emptyItem, 'bill.itemForm')
  const error = atom('', 'bill.error')
  const itemPeople = computed(() => {
    const people = new Map<string, Set<string>>()
    for (const item of draft().items) {
      const group = billItemGroup(item)
      const assigned = people.get(group) ?? new Set<string>()
      assigned.add(item.personId)
      people.set(group, assigned)
    }
    return people
  }, 'bill.itemPeople')

  function change(next: Bill) {
    if (!Number.isSafeInteger(billTotals(next).total)) {
      error.set('Итог слишком большой.')
      return false
    }
    draft.set(next)
    changed.set(true)
    error.set('')
    return true
  }

  const moveItem = action((id: string, personId: string, index: number) => {
    const current = draft()
    const item = current.items.find((row) => row.id === id)
    if (!item || !current.people.some((person) => person.id === personId)) return false

    const items = current.items.filter((row) => row.id !== id)
    const destination = items.filter((row) => row.personId === personId)
    if (!Number.isInteger(index) || index < 0 || index > destination.length
      || destination.some((row) => billItemGroup(row) === billItemGroup(item))) return false
    if (item.personId === personId && current.items.filter((row) => row.personId === personId)[index]?.id === id) return true

    const next = destination[index]
    const last = destination.at(-1)
    const at = next ? items.indexOf(next) : last ? items.indexOf(last) + 1 : items.length
    items.splice(at, 0, { ...item, personId })
    return change({ ...current, items })
  }, 'bill.moveItem')

  const openBill = action((bill = newBill()) => {
    draft.set(bill)
    changed.set(false)
    targets.set([ownerId])
    itemForm.set(emptyItem)
    error.set('')
  }, 'bill.open')

  const addPerson = action((input: string) => {
    const current = draft()
    const name = input.trim()
    if (!name || current.people.some((person) => person.name.toLowerCase() === name.toLowerCase())) return false
    const person = { id: crypto.randomUUID(), name }
    change({ ...current, people: [...current.people, person] })
    targets.set([person.id])
    return true
  }, 'bill.addPerson')

  const removePerson = action((personId: string): BillPersonRemoval | undefined => {
    const current = draft()
    const index = current.people.findIndex((person) => person.id === personId)
    if (personId === ownerId || index === -1) return
    const person = current.people[index]
    const items = current.items.filter((item) => item.personId === personId)
    const targetsBefore = targets()
    const remaining = targetsBefore.filter((id) => id !== personId)
    const targetsAfter = remaining.length ? remaining : [ownerId]
    if (!change({
      ...current,
      people: current.people.filter((person) => person.id !== personId),
      items: current.items.filter((item) => item.personId !== personId),
    })) return
    targets.set(targetsAfter)
    return { billId: current.id, person, index, items, targetsBefore, targetsAfter }
  }, 'bill.removePerson')

  const restorePerson = action((removal: BillPersonRemoval) => {
    const current = draft()
    if (current.id !== removal.billId || current.people.some((person) =>
      person.id === removal.person.id || person.name.toLowerCase() === removal.person.name.toLowerCase())) return false
    const people = current.people.toSpliced(removal.index, 0, removal.person)
    const linked = new Map(current.items.map((item) => [billItemGroup(item), item]))
    const restored = removal.items.map((item) => {
      const currentLink = linked.get(billItemGroup(item))
      return currentLink ? { ...item, name: currentLink.name, priceMinor: currentLink.priceMinor } : item
    })
    if (!change({ ...current, people, items: [...current.items, ...restored] })) return false
    if (targets() === removal.targetsAfter) {
      targets.set(removal.targetsBefore.filter((id) => people.some((person) => person.id === id)))
    }
    return true
  }, 'bill.restorePerson')

  const addItem = action(() => {
    const current = draft()
    const { name, price } = itemForm()
    const priceMinor = parseBillPrice(price)
    if (!priceMinor) {
      error.set('Укажи цену за штуку.')
      return false
    }
    const selected = current.people.filter((person) => targets().includes(person.id))
    if (!selected.length) {
      error.set('Выбери, кому добавить позицию.')
      return false
    }
    const fields = { name: name.trim() || 'Позиция', priceMinor, quantity: 1, groupId: crypto.randomUUID() }
    const items = [...current.items, ...selected.map(({ id }) => ({ ...fields, id: crypto.randomUUID(), personId: id }))]
    if (!change({ ...current, items })) return false
    itemForm.set(emptyItem)
    return true
  }, 'bill.addItem')

  const setItemPeople = action((id: string, personIds: string[]) => {
    const current = draft()
    const item = current.items.find((item) => item.id === id)
    if (!item) return false
    const groupId = billItemGroup(item)
    const assigned = itemPeople().get(groupId)
    const selected = new Set(personIds)
    const recipients = current.people.filter((person) => selected.has(person.id))
    if (!recipients.length || recipients.length !== selected.size) return false
    const added = recipients.filter(({ id }) => !assigned?.has(id))
    const destination = selected.has(item.personId) ? undefined : added.shift()
    const items = current.items
      .filter((row) => (row.id === id && destination) || billItemGroup(row) !== groupId || selected.has(row.personId))
      .map((row) => row.id === id && destination ? { ...row, personId: destination.id } : row)
    const copies = added
      .map(({ id: personId }) => ({ ...item, id: crypto.randomUUID(), groupId, personId, quantity: 1 }))
    if (!destination && !copies.length && items.length === current.items.length) return true
    return change({ ...current, items: [...items, ...copies] })
  }, 'bill.setItemPeople')

  const updateItem = action((id: string, updates: BillItemChanges) => {
    const current = draft()
    const item = current.items.find((row) => row.id === id)
    if (!item) return false
    const { quantity, ...shared } = updates
    const groupId = billItemGroup(item)
    return change({
      ...current,
      items: current.items.map((row) => {
        if (row.id === id) return { ...row, ...shared, quantity: quantity ?? row.quantity }
        return billItemGroup(row) === groupId ? { ...row, ...shared } : row
      }),
    })
  }, 'bill.updateItem')

  const removeItem = action((id: string) => {
    const current = draft()
    change({ ...current, items: current.items.filter((item) => item.id !== id) })
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
    draft, totals, changed, targets, itemForm, error, openBill, addPerson, removePerson, restorePerson, addItem, setItemPeople, moveItem, updateItem, removeItem, itemPeople, save,
    setTitle: action((title: string) => change({ ...draft(), title }), 'bill.setTitle'),
    setTargets: action((ids: string[]) => targets.set(ids), 'bill.setTargets'),
    setItemField: action((name: keyof BillItemForm, value: string) => {
      itemForm.set((values) => ({ ...values, [name]: value }))
      error.set('')
    }, 'bill.setItemField'),
  }
}
