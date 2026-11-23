import {
  ArrowDownLeft, ArrowDownToLine, ArrowLeftRight, Banknote, Bike, CarFront, Coffee, Fuel, Gamepad2, Gift,
  GraduationCap, HeartPulse, House, Landmark, Laptop, Package, PartyPopper, PawPrint, Percent, PiggyBank,
  Plane, Receipt, Shirt, ShoppingBag, ShoppingBasket, Store, Utensils, Wifi, Wrench,
} from 'lucide-react'
import { useCategoryCatalog } from '../categories/categoryContext'
import { categoryDefinition, type Category, type CategoryAppearance, type CategoryIconId } from '../categories/catalog'

const icons = {
  groceries: ShoppingBasket, dining: Coffee, shopping: ShoppingBag, transport: Bike,
  home: House, health: HeartPulse, other: Package, income: ArrowDownLeft, transfer: ArrowLeftRight,
  clothes: Shirt, gifts: Gift, subscriptions: Wifi, savings: PiggyBank, social: PartyPopper, fees: Receipt,
  salary: Banknote, cashback: Percent, interest: Landmark, sale: Store, withdrawal: ArrowDownToLine,
  utensils: Utensils, car: CarFront, fuel: Fuel, plane: Plane, study: GraduationCap, tools: Wrench,
  pets: PawPrint, games: Gamepad2, electronics: Laptop,
} satisfies Record<CategoryIconId, typeof Package>

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const { icon, tone } = categoryDefinition(useCategoryCatalog(), category)
  return <CategoryGlyph icon={icon} tone={tone} className={className} />
}

export function CategoryGlyph({ icon, tone, className }: CategoryAppearance & { className?: string }) {
  const Icon = icons[icon]
  return (
    <span className={`category-icon category-accent${className ? ` ${className}` : ''}`} data-category={tone} aria-hidden="true">
      <Icon size={16} />
    </span>
  )
}
