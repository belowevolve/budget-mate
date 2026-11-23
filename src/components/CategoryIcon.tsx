import {
  ArrowDownLeft, ArrowDownToLine, ArrowLeftRight, Banknote, Bike, CarFront, Coffee, Fuel, Gamepad2, Gift,
  GraduationCap, HeartPulse, House, Landmark, Laptop, Package, PartyPopper, PawPrint, Percent, PiggyBank,
  Plane, Receipt, Shirt, ShoppingBag, ShoppingBasket, Store, Utensils, Wifi, Wrench,
} from 'lucide-react'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { useCategoryCatalog } from '../categories/categoryContext'
import { categoryDefinition, type Category, type CategoryAppearance, type CategoryIconId, type CategoryTone } from '../categories/catalog'

const icons = {
  groceries: ShoppingBasket, dining: Coffee, shopping: ShoppingBag, transport: Bike,
  home: House, health: HeartPulse, other: Package, income: ArrowDownLeft, transfer: ArrowLeftRight,
  clothes: Shirt, gifts: Gift, subscriptions: Wifi, savings: PiggyBank, social: PartyPopper, fees: Receipt,
  salary: Banknote, cashback: Percent, interest: Landmark, sale: Store, withdrawal: ArrowDownToLine,
  utensils: Utensils, car: CarFront, fuel: Fuel, plane: Plane, study: GraduationCap, tools: Wrench,
  pets: PawPrint, games: Gamepad2, electronics: Laptop,
} satisfies Record<CategoryIconId, typeof Package>

const accent = {
  groceries: '[--category-accent:var(--color-category-groceries)]',
  dining: '[--category-accent:var(--color-category-dining)]',
  shopping: '[--category-accent:var(--color-category-shopping)]',
  transport: '[--category-accent:var(--color-category-transport)]',
  home: '[--category-accent:var(--color-category-home)]',
  health: '[--category-accent:var(--color-category-health)]',
  other: '[--category-accent:var(--color-category-other)]',
  income: '[--category-accent:var(--color-category-income)]',
  transfer: '[--category-accent:var(--color-category-transfer)]',
} satisfies Record<CategoryTone, string>

export function CategoryAccent({ tone, className, ...props }: ComponentProps<'span'> & { tone: CategoryTone }) {
  return <span {...props} className={cn(accent[tone], className)} />
}

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const { icon, tone } = categoryDefinition(useCategoryCatalog(), category)
  return <CategoryGlyph icon={icon} tone={tone} className={className} />
}

export function CategoryGlyph({ icon, tone, className }: CategoryAppearance & { className?: string }) {
  const Icon = icons[icon]
  return (
    <CategoryAccent tone={tone} className={cn(
      'inline-grid size-8 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--category-accent)_16%,var(--color-paper))] text-primary',
      className,
    )} aria-hidden="true">
      <Icon size={16} />
    </CategoryAccent>
  )
}
