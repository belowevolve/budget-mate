import { bindDrag, dragThreshold } from '@ui-sdk/core'
import { Toast, ToastAction, ToastClose, ToastRegion, ToastTitle, type ToastData } from '@ui-sdk/react/toast'
import { X } from 'lucide-react'
import { useEffect, useRef, type PointerEvent } from 'react'
import { noticeIcons, type NotificationKind } from '../notifications/presentation'
import type { WorkspaceStore } from './workspaceState'
import './workspaceToasts.css'

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
    <Toast className="workspace-toast" onPointerDownCapture={startDrag}
      onClick={(event) => {
        if (!(event.target as Element).closest(interactive)) event.currentTarget.focus({ preventScroll: true })
      }}
      render={(props, state) => (
        <li {...props} inert={state.leaving || (!state.expanded && !state.front) || undefined} />
      )}>
      <Icon size={16} aria-hidden="true" />
      <ToastTitle className="workspace-toast-title" />
      {item.action && (
        <ToastAction className="workspace-toast-action">
          {(state) => state.pending ? 'Выполняем…' : state.error ? 'Повторить' : item.action?.label}
        </ToastAction>
      )}
      <ToastClose aria-label="Закрыть уведомление" className="workspace-toast-close">
        <X size={12} strokeWidth={2} aria-hidden="true" />
      </ToastClose>
    </Toast>
  )
}

export default function WorkspaceToasts({ toaster, fullScreen }: { toaster: WorkspaceStore['toaster']; fullScreen: boolean }) {
  return (
    <ToastRegion toaster={toaster} side="bottom" align="end" aria-label="Уведомления" data-full-screen={fullScreen || undefined}
      pendingAnnouncement="Выполняется действие" className="workspace-toast-region">
      {(item) => <WorkspaceToast item={item} toaster={toaster} />}
    </ToastRegion>
  )
}
