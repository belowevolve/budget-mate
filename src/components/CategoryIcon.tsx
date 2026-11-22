import {
  ArrowDownLeft, ArrowLeftRight, Bike, Coffee, HeartPulse, House, Package, ShoppingBag, ShoppingBasket,
} from 'lucide-react'
import type { Category } from '../finance'

const icons = {
  groceries: ShoppingBasket, dining: Coffee, shopping: ShoppingBag, transport: Bike,
  home: House, health: HeartPulse, other: Package, income: ArrowDownLeft, transfer: ArrowLeftRight,
} satisfies Record<Category, typeof Package>

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = icons[category]
  return (
    <span className={`category-icon category-accent${className ? ` ${className}` : ''}`} data-category={category} aria-hidden="true">
      <Icon size={16} />
    </span>
  )
}
