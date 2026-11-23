import { cn } from 'cn'
import { Clock } from 'lucide-react'

export function PendingStatus({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 align-middle text-xs font-semibold whitespace-nowrap text-warning', className)} title="В обработке">
      <Clock size={12} className="shrink-0" aria-hidden="true" />
      <span className="sr-only">В обработке</span>
    </span>
  )
}
