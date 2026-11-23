import { cn } from 'cn'
import { banks } from '../finance'
import type { BankId } from '../statements/types'

const marks: Record<BankId, string> = { alfa: 'А', vtb: 'В', ozon: 'O' }

export function BankIcon({ bank, className, decorative = false }: {
  bank: BankId
  className?: string
  decorative?: boolean
}) {
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : banks[bank]}
      aria-hidden={decorative || undefined}
      data-bank={bank}
      className={cn(
        'inline-grid size-4 shrink-0 place-items-center rounded-sm text-xs leading-none font-extrabold text-on-bank',
        'data-[bank=alfa]:bg-bank-alfa data-[bank=vtb]:bg-bank-vtb data-[bank=ozon]:bg-bank-ozon',
        className,
      )}
    >
      {marks[bank]}
    </span>
  )
}
