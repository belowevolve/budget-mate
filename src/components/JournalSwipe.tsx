import { createSwipeActions, definePrimitive, live, type SwipeDraft, type SwipeOpen } from '@ui-sdk/core'
import { createParts } from '@ui-sdk/react/primitive'

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
    action: slot<{ value: string; onAction: () => void }>({
      props: { value: 'string', onAction: 'callback' },
      role: 'button',
      focus: 'native',
      attrs: () => ({ type: 'button' }),
      press: ({ api, key, props }) => {
        if (api.swipe.open()?.key !== key) return
        props.onAction()
        api.swipe.close()
      },
    }),
  }),
  agent: { actions: [] },
})

export const {
  Root: JournalSwipe, Row: JournalSwipeRow, Content: JournalSwipeContent,
  Actions: JournalSwipeActions, Action: JournalSwipeAction,
} = createParts(journalSwipe, { row: 'div', content: 'div', actions: 'div', action: 'button' })
