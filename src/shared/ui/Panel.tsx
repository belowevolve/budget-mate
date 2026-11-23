import type { ComponentProps } from 'react'

export function Panel({ padded, className, ...props }: ComponentProps<'section'> & { padded?: boolean }) {
  const classes = ['surface-panel', padded && 'card-padding', className].filter(Boolean).join(' ')
  return <section {...props} className={classes} />
}
