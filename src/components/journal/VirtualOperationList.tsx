import { defaultRangeExtractor, measureElement, useVirtualizer, type Range } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { formatDate } from '../../finance'
import type { JournalEntry, JournalGroups } from './model'
import './operationList.css'

const dayFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
})

type ListItem =
  | { key: string; date: string; entry?: never }
  | { key: string; entry: JournalEntry; groupStart: boolean; groupEnd: boolean }

export function VirtualOperationList({ groups, renderEntry, ariaLabel, resetKey, scrollRef }: {
  groups: JournalGroups
  renderEntry: (entry: JournalEntry) => ReactNode
  ariaLabel: string
  resetKey: string
  scrollRef?: RefObject<HTMLElement | null>
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const [focusedKey, setFocusedKey] = useState<string>()
  const items = useMemo(() => {
    const result: ListItem[] = []
    for (const [date, entries] of groups) {
      result.push({ key: `date:${date}`, date })
      entries.forEach((entry, index) => result.push({
        key: `operation:${entry.row.id}`, entry, groupStart: index === 0, groupEnd: index === entries.length - 1,
      }))
    }
    return result
  }, [groups])
  const getScrollElement = useCallback(
    () => scrollRef?.current ?? listRef.current?.closest<HTMLElement>('[data-slot="scroll"], main') ?? null,
    [scrollRef],
  )
  const getItemKey = useCallback((index: number) => items[index].key, [items])
  const estimateSize = useCallback((index: number) => items[index].entry ? 54 : 28, [items])
  const focusedIndex = useMemo(() => focusedKey ? items.findIndex(({ key }) => key === focusedKey) : -1, [focusedKey, items])
  const rangeExtractor = useCallback((range: Range) => {
    const indexes = defaultRangeExtractor(range)
    if (focusedIndex < 0 || indexes.includes(focusedIndex)) return indexes
    return [...indexes, focusedIndex].sort((a, b) => a - b)
  }, [focusedIndex])

  // The workspace scroll also contains its period controls and the journal filters.
  useLayoutEffect(() => {
    const list = listRef.current
    const scroll = getScrollElement()
    if (!list || !scroll) return
    const updateMargin = () => {
      const margin = list.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - scroll.clientTop
      setScrollMargin(Math.max(0, Math.round(margin)))
    }
    const observer = new ResizeObserver(updateMargin)
    observer.observe(scroll)
    for (let parent = list.parentElement; parent && parent !== scroll; parent = parent.parentElement) observer.observe(parent)
    updateMargin()
    return () => observer.disconnect()
  }, [getScrollElement])

  useLayoutEffect(() => {
    getScrollElement()?.scrollTo({ top: 0 })
  }, [getScrollElement, resetKey])

  // The mutable virtualizer stays in this component and is read on every render.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer<HTMLElement, HTMLLIElement>({
    count: items.length,
    getScrollElement,
    getItemKey,
    estimateSize,
    // A sheet initially measures while hidden. Zero heights would expand the virtual range.
    measureElement: (element, entry, instance) =>
      measureElement(element, entry, instance) || estimateSize(Number(element.dataset.index)),
    rangeExtractor,
    scrollMargin,
    overscan: 8,
    useFlushSync: false,
  })
  const year = String(new Date().getFullYear())

  return (
    <ul ref={listRef} className="operation-list" aria-label={ariaLabel} style={{ height: virtualizer.getTotalSize() }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusedKey(undefined) }}>
      {virtualizer.getVirtualItems().map(({ index, key, start }) => {
        const item = items[index]
        const style = { top: start - scrollMargin }
        if (!item.entry) {
          return (
            <li key={key} ref={virtualizer.measureElement} data-index={index} className="operation-list-heading" style={style}
              aria-setsize={items.length} aria-posinset={index + 1}>
              <h2 className="first-letter:uppercase">
                <time dateTime={item.date} title={formatDate(item.date)}>
                  {dayFormatter.format(new Date(`${item.date}T00:00:00Z`))}{item.date.slice(0, 4) !== year ? ` ${item.date.slice(0, 4)}` : ''}
                </time>
              </h2>
            </li>
          )
        }
        return (
          <li key={key} ref={virtualizer.measureElement} data-index={index} className="operation-list-row" style={style}
            data-group-start={item.groupStart ? '' : undefined} data-group-end={item.groupEnd ? '' : undefined}
            aria-setsize={items.length} aria-posinset={index + 1} onFocus={() => setFocusedKey(item.key)}>
            {renderEntry(item.entry)}
          </li>
        )
      })}
    </ul>
  )
}
