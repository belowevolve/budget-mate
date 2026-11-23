'use client'

import { createTransfer, definePrimitive, keepFocus, live, type TransferDraft, type TransferLists, type TransferMessage } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/react/primitive'
import { billItemGroup, type Bill } from './bill'

type BillDragOptions = {
  bill: Pick<Bill, 'people' | 'items'>
  disabled?: boolean
  onMove: (id: string, personId: string, index: number) => boolean
}

function billDragState({ bill, disabled }: BillDragOptions) {
  const lists: TransferLists = Object.fromEntries(bill.people.map(({ id }) => [id, []]))
  for (const item of bill.items) lists[item.personId]?.push(item.id)
  return { bill, disabled: Boolean(disabled), lists }
}

function moveAnnouncement({ type, label, list, position, total }: TransferMessage) {
  if (type === 'grab') return `Выбрана позиция «${label}».`
  if (type === 'cancel') return 'Перенос отменён.'
  if (type === 'drop') return `Позиция «${label}» перенесена к участнику «${list}».`
  return `${list}. Позиция ${position} из ${total}.`
}

const billDrag = definePrimitive({
  name: 'bill-drag',
  options: { bill: 'value', disabled: 'boolean', onMove: 'action' },
  state: (options: BillDragOptions) => ({ ...billDragState(options), moving: null as TransferDraft | null }),
  sync: (options) => billDragState(options),
  live: ['moving'],
  api: (context) => {
    const transfer = createTransfer(context, {
      key: 'lists',
      draft: 'moving',
      disabled: () => context.store.get().disabled,
      accepts: (key, personId) => {
        const { items } = context.store.get().bill
        const item = items.find((row) => row.id === key)
        if (!item) return false
        return !items.some((row) => row.id !== key && row.personId === personId && billItemGroup(row) === billItemGroup(item))
      },
      label: (key) => context.store.get().bill.items.find(({ id }) => id === key)?.name,
      listLabel: (id) => context.store.get().bill.people.find((person) => person.id === id)?.name,
      message: moveAnnouncement,
      set: (lists, { key, to, index, reason, event }) => {
        if (reason === 'drag' && event instanceof PointerEvent) {
          const target = context.element('list', to)
          if (!target?.contains(target.ownerDocument.elementFromPoint(event.clientX, event.clientY))) return false
        }
        if (!context.options().onMove(key, to, index)) return false
        context.store.set({ lists })
        if (reason === 'move-key') keepFocus(() => context.element('item', key))
        return true
      },
    })
    return { transfer, move: transfer.move }
  },
  slots: (slot) => ({
    root: slot({}),
    list: slot<{ value: string }>({
      props: { value: 'string' },
      bind: (el, { api, key }) => api.transfer.bindList(el, key),
      live: live((state, { key }) => {
        const moving = state.moving
        const items = moving?.lists[key]
        const active = Boolean(moving && items?.includes(moving.key))
        return {
          'data-drop-target': active ? '' : undefined,
          'data-drop-at-end': active && items?.at(-1) === moving?.key ? '' : undefined,
        }
      }),
    }),
    item: slot<{ value: string; personId: string }>({
      props: { value: 'string', personId: 'string' },
      bind: (el, { api, key }) => api.transfer.bindItem(el, key),
      live: live((state, { api, key, props }) => {
        const moving = state.moving
        const items = moving?.lists[props.personId]
        const index = items?.indexOf(key) ?? -1
        return {
          'data-moving': api.transfer.moving(state, key) ? '' : undefined,
          'data-drop-before': moving && items && index > 0 && items[index - 1] === moving.key ? '' : undefined,
        }
      }),
      on: {
        keydown: (event, { api, el, key }) => {
          if (el && event.target === el && el.tabIndex >= 0 && !event.defaultPrevented) api.transfer.keydown(event, key)
        },
      },
    }),
    surface: slot<{ value: string }>({
      props: { value: 'string' },
      on: {
        pointerdown: (event, { api, key }) => api.transfer.pointerdown(event, key),
      },
    }),
  }),
  agent: { actions: ['move'] },
})

export const { Root: BillDrag, List: BillDragList, Item: BillDragItem, Surface: BillDragSurface } =
  createParts(billDrag, { root: 'div', list: 'section', item: 'li', surface: 'span' })
