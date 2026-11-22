import { Toast, ToastAction, ToastClose, ToastRegion, ToastTitle } from '@ui-sdk/react/toast'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import type { WorkspaceStore } from './workspaceState'

export default function WorkspaceToasts({ toaster }: { toaster: WorkspaceStore['toaster'] }) {
  return (
    <ToastRegion toaster={toaster} side="bottom" align="end" maxVisible={1} aria-label="Уведомления"
      pendingAnnouncement="Отмена изменения"
      className="right-3 bottom-[calc(3.875rem+env(safe-area-inset-bottom))] m-0 w-[min(23rem,calc(100vw-1.5rem))] max-w-none md:right-5 md:bottom-5">
      {(item) => {
        const Icon = item.type === 'error' ? CircleAlert : item.type === 'success' ? CircleCheck : Info
        return (
          <Toast className="grid min-h-12 select-none grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border-0 bg-inverse py-1 pr-1 pl-3 text-on-inverse shadow-popup [translate:var(--toast-swipe-x,0px)_var(--toast-swipe-y,0px)] transition-[translate,opacity] duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:transition-none data-[type=error]:bg-danger-strong motion-reduce:transition-none">
            <Icon size={16} aria-hidden="true" />
            <ToastTitle className="min-w-0 text-sm leading-tight font-semibold text-on-inverse wrap-anywhere" />
            {item.action ? (
              <ToastAction className="min-h-11 min-w-24 justify-center rounded-lg border-0 bg-transparent px-2.5 text-xs font-extrabold whitespace-nowrap text-on-inverse shadow-none hover:bg-on-inverse/15 focus-visible:outline-on-inverse">
                {(state) => state.pending ? 'Отменяем…' : state.error ? 'Повторить' : 'Отменить'}
              </ToastAction>
            ) : (
              <ToastClose aria-label="Закрыть уведомление" className="grid size-10 place-items-center rounded-lg border-0 bg-transparent p-0 text-on-inverse shadow-none hover:bg-on-inverse/15 focus-visible:outline-on-inverse"><X size={16} aria-hidden="true" /></ToastClose>
            )}
          </Toast>
        )
      }}
    </ToastRegion>
  )
}
