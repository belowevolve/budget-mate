import { createSwipeActions, definePrimitive, live, type SwipeDraft, type SwipeOpen } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/react/primitive'
import { cn } from 'cn'
import type { ComponentProps } from 'react'

type JournalSwipeOptions = {
  onFullSwipe?: (key: string) => boolean
}

const initialState: (options: JournalSwipeOptions) => { open: SwipeOpen | null; swiping: SwipeDraft | null } =
  () => ({ open: null, swiping: null })

const journalSwipe = definePrimitive({
  name: 'journal-swipe',
  options: { onFullSwipe: 'callback' },
  state: initialState,
  live: ['swiping'],
  api: (context) => ({
    swipe: createSwipeActions(context, {
      key: 'open', draft: 'swiping',
      onFullSwipe: (key, side) => side === 'end' && Boolean(context.options().onFullSwipe?.(key)),
    }),
  }),
  slots: (slot) => ({
    root: slot({}),
    row: slot<{ value: string }>({
      props: { value: 'string' },
      on: {
        pointerdown: (event, { api, el, key }) => {
          if (event.pointerType === 'touch' && el && !(event.target instanceof Element && event.target.closest('[data-side]'))) {
            api.swipe.pointerdown(event, key, el)
          }
        },
        keydown: (event, { api, key }) => { api.swipe.keydown(event, key) },
      },
      bind: (el, { api, key }) => api.swipe.bindRow(el, key),
    }),
    content: slot<{ value: string }>({
      props: { value: 'string' },
      live: live((state, { api, key }) => api.swipe.contentAttrs(state, key)),
    }),
    actions: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, { api, key }) => api.swipe.actionsAttrs(state, key, 'end'),
      bind: (el, { api, key }) => api.swipe.bindActions(el, key, 'end'),
    }),
    action: slot<{ value: string; rowId: string; onAction: () => void }>({
      props: { value: 'string', rowId: 'string', onAction: 'callback' },
      role: 'button',
      focus: 'native',
      attrs: () => ({ type: 'button' }),
      press: ({ api, props }) => {
        if (api.swipe.open()?.key !== props.rowId) return
        props.onAction()
        api.swipe.close()
      },
    }),
  }),
  agent: { actions: [] },
})

const {
  Root: SwipeRoot, Row: SwipeRow, Content: SwipeContent,
  Actions: SwipeActions, Action: SwipeAction,
} = createParts(journalSwipe, { row: 'div', content: 'div', actions: 'div', action: 'button' })

export function JournalSwipe(props: ComponentProps<typeof SwipeRoot>) {
  return <SwipeRoot {...props} />
}

export function JournalSwipeRow({ flush, ...props }: ComponentProps<typeof SwipeRow> & { flush?: boolean }) {
  return <SwipeRow {...props} className={cn(
    'relative isolate min-w-0 overflow-hidden [touch-action:pan-y_pinch-zoom] data-refund-full:bg-primary data-category-full:bg-selected',
    !flush && 'rounded-lg',
  )} />
}

export function JournalSwipeContent(props: ComponentProps<typeof SwipeContent>) {
  return <SwipeContent {...props} className="relative bg-paper transform-[translateX(var(--swipe-x,0px))] transition-transform duration-150 data-swiping:transition-none motion-reduce:transition-none" />
}

export function JournalSwipeActions(props: ComponentProps<typeof SwipeActions>) {
  return <SwipeActions {...props} className="absolute inset-y-0 inset-e-0 grid w-max auto-cols-21 grid-flow-col sm:auto-cols-24" />
}

const actionTone = {
  refund: 'bg-primary text-on-primary hover:bg-primary-hover',
  transfer: 'bg-transfer-soft text-transfer hover:bg-selected',
  category: 'bg-selected text-primary hover:bg-subtle',
}

export function JournalSwipeAction({ tone, rowId, ...props }: Omit<ComponentProps<typeof SwipeAction>, 'value'> & { tone: keyof typeof actionTone }) {
  return <SwipeAction {...props} rowId={rowId} value={`${rowId}:${tone}`} className={cn(
    'flex h-full min-h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-none border-0 p-1 text-center text-xs leading-tight font-bold whitespace-normal shadow-none [&>svg]:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0',
    actionTone[tone],
  )} />
}
