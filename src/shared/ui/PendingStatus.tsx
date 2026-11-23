import { Clock } from 'lucide-react'

export function PendingStatus({ className }: { className?: string }) {
  return (
    <span className={className ? `pending-status ${className}` : 'pending-status'} title="В обработке">
      <Clock aria-hidden="true" />
      <span className="sr-only">В обработке</span>
    </span>
  )
}
