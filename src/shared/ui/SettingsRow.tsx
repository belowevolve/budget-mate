import { Button } from '@ui-sdk/react/button'
import { DialogTrigger } from '@ui-sdk/react/dialog'
import { ListboxItem } from '@ui-sdk/react/listbox'
import { cn } from 'cn'
import type { ComponentProps } from 'react'

const rowStyles = 'flex h-auto min-h-11 w-full min-w-0 justify-start gap-2.5 rounded-none border-0 bg-transparent px-3 py-1.5 text-start text-sm font-semibold text-ink shadow-none hover:bg-subtle focus-visible:-outline-offset-3 [&>span:first-of-type]:flex-1'

export function SettingsRow({ className, ...props }: Omit<ComponentProps<typeof Button>, 'className'> & { className?: string }) {
  return <Button {...props} className={cn(rowStyles, className)} />
}

export function SettingsDialogTrigger({ className, ...props }: Omit<ComponentProps<typeof DialogTrigger>, 'className'> & { className?: string }) {
  return <DialogTrigger {...props} className={cn(rowStyles, className)} />
}

export function SettingsListItem<Value = string>({ className, ...props }: Omit<ComponentProps<typeof ListboxItem<Value>>, 'className'> & { className?: string }) {
  return <ListboxItem {...props} className={cn(
    rowStyles,
    'shrink-0 cursor-pointer data-highlighted:bg-subtle data-selected:bg-selected data-selected:text-primary',
    className,
  )} />
}
