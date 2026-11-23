import { Button as ButtonPrimitive } from '@ui-sdk/react/button'
import { cn } from 'cn'
import { defineConfig, type VariantProps } from 'cva/config'
import type { ComponentProps } from 'react'

const { cva } = defineConfig({ cx: cn })

// eslint-disable-next-line react-refresh/only-export-components
export const buttonVariants = cva({
  base: 'inline-flex min-w-0 max-w-full items-center justify-center gap-2 rounded-full border-0 text-center font-bold whitespace-normal shadow-none disabled:opacity-60 [&>svg]:pointer-events-none [&>svg]:shrink-0',
  variants: {
    variant: {
      primary: 'bg-primary text-on-primary hover:bg-primary-hover',
      secondary: 'bg-subtle text-primary hover:bg-selected',
      text: 'bg-transparent text-primary hover:bg-subtle has-data-[icon=inline-start]:pe-4',
      danger: 'bg-danger text-on-primary hover:bg-danger-strong',
      outline: 'border border-field-line bg-paper text-primary hover:bg-subtle focus-visible:border-primary focus-visible:-outline-offset-2 data-active:border-primary data-active:bg-selected',
    },
    size: {
      default: 'h-auto min-h-11 px-4 py-2 text-sm [&>svg:not([class*="size-"])]:size-4.5',
      compact: 'h-auto min-h-11 px-3 py-2 text-xs [&>svg:not([class*="size-"])]:size-4.5',
      small: 'h-auto min-h-9 px-3 py-1.5 text-xs [&>svg:not([class*="size-"])]:size-4.5',
      icon: 'size-10 shrink-0 p-0 [&>svg:not([class*="size-"])]:size-5',
      'icon-sm': 'size-9 shrink-0 p-0 [&>svg:not([class*="size-"])]:size-4.5',
      'icon-lg': 'size-11 shrink-0 p-0 [&>svg:not([class*="size-"])]:size-5',
    },
  },
  compoundVariants: [
    { variant: 'text', size: 'default', className: 'px-3' },
  ],
  defaultVariants: { variant: 'primary', size: 'default' },
})

type ButtonProps = Omit<ComponentProps<typeof ButtonPrimitive>, 'className'> &
  VariantProps<typeof buttonVariants> & { className?: string }

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <ButtonPrimitive {...props} className={buttonVariants({ variant, size, className })} />
}
