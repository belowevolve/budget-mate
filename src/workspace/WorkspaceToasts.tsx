import { bindDrag, dragThreshold } from '@ui-sdk/core'
import { Toast, ToastAction, ToastClose, ToastRegion, ToastTitle, type ToastData } from '@ui-sdk/react/toast'
import { cn } from 'cn'
import { X } from 'lucide-react'
import { useEffect, useRef, type PointerEvent } from 'react'
import { noticeIcons, type NotificationKind } from '../shared/ui/feedback'
import type { WorkspaceStore } from './workspaceState'

const interactive = 'button, a'

function WorkspaceToast({ item, toaster }: { item: ToastData<React.ReactNode>; toaster: WorkspaceStore['toaster'] }) {
  const stopDrag = useRef<(() => void) | undefined>(undefined)
  const Icon = noticeIcons[item.type as NotificationKind] ?? noticeIcons.info

  useEffect(() => () => stopDrag.current?.(), [])

  function startDrag(event: PointerEvent<HTMLLIElement>) {
    if (!event.isPrimary || event.button !== 0 || item.dismissible === false ||
        (event.target as Element).closest(interactive)) return

    // The SDK's anchored swipe only supports the trailing horizontal direction.
    event.stopPropagation()
    const element = event.currentTarget
    const { clientX, clientY } = event
    const distance = Math.max(48, element.offsetWidth * 0.21)
    let axis: 'x' | 'y'
    let offset = 0

    stopDrag.current?.()
    stopDrag.current = bindDrag(element, event.nativeEvent, {
      threshold: dragThreshold,
      cancelOnEscape: true,
      onStart(move) {
        const x = move.clientX - clientX
        const y = move.clientY - clientY
        axis = Math.abs(x) >= Math.abs(y) ? 'x' : 'y'
        if (axis === 'y' && y < 0) return false
        element.dataset.dragging = ''
      },
      onMove({ x, y }) {
        offset = axis === 'x' ? x - clientX : Math.max(0, y - clientY)
        element.style.setProperty(`--workspace-toast-drag-${axis}`, `${offset}px`)
      },
      onEnd(_, canceled) {
        delete element.dataset.dragging
        if (!canceled && Math.abs(offset) >= (axis === 'x' ? distance : 48)) {
          element.dataset.dragDismiss = axis === 'y' ? 'down' : offset < 0 ? 'left' : 'right'
          toaster.dismiss(item.id)
        } else if (axis) {
          element.style.removeProperty(`--workspace-toast-drag-${axis}`)
        }
      },
    })
  }

  return (
    <Toast className={cn(
      'absolute inset-x-0 bottom-0 grid min-h-14 touch-none grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-xl border-0 bg-inverse py-2 ps-3 pe-4 text-on-inverse shadow-popup select-none',
      'transition-[translate,scale,height,opacity] duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 data-dragging:transition-none data-[type=error]:bg-danger-strong motion-reduce:transition-none',
      item.action && 'grid-cols-[1rem_minmax(0,1fr)_auto]',
    )} onPointerDownCapture={startDrag}
      onClick={(event) => {
        if (!(event.target as Element).closest(interactive)) event.currentTarget.focus({ preventScroll: true })
      }}
      render={(props, state) => (
        <li {...props} inert={state.leaving || (!state.expanded && !state.front) || undefined} />
      )}>
      <Icon size={16} aria-hidden="true" />
      <ToastTitle className="min-w-0 text-sm leading-tight font-semibold wrap-anywhere text-on-inverse" />
      {item.action && (
        <ToastAction className="h-8 justify-center rounded-md border-0 bg-on-inverse px-2 text-xs font-bold whitespace-nowrap text-inverse shadow-none hover:bg-on-inverse-muted focus-visible:outline-on-inverse">
          {(state) => state.pending ? 'Выполняем…' : state.error ? 'Повторить' : item.action?.label}
        </ToastAction>
      )}
      <ToastClose aria-label="Закрыть уведомление"
        className="absolute -inset-e-1 -top-2 z-10 grid size-6 place-items-center rounded-full border border-line bg-paper p-0 text-muted shadow-sm hover:bg-subtle hover:text-ink focus-visible:outline-primary">
        <X size={12} strokeWidth={2} aria-hidden="true" />
      </ToastClose>
    </Toast>
  )
}

export default function WorkspaceToasts({ toaster, fullScreen }: { toaster: WorkspaceStore['toaster']; fullScreen: boolean }) {
  return (
    <ToastRegion toaster={toaster} side="bottom" align="end" aria-label="Уведомления" data-workspace=""
      className={cn(
        'inset-e-3 m-0 w-[min(23rem,calc(100vw-1.5rem))] max-w-none md:inset-e-5 md:bottom-5',
        fullScreen ? 'bottom-[calc(.75rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(3.875rem+env(safe-area-inset-bottom))]',
      )} pendingAnnouncement="Выполняется действие">
      {(item) => <WorkspaceToast item={item} toaster={toaster} />}
    </ToastRegion>
  )
}
