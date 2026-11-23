import { action, atom, reatomForm, wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Button as ButtonPrimitive } from '@ui-sdk/react/button'
import { Radio, RadioGroup } from '@ui-sdk/react/radio'
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control'
import { Archive, ArchiveRestore, Check, ChevronRight, Plus } from 'lucide-react'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { CategoryAccent, CategoryGlyph, CategoryIcon } from '../components/CategoryIcon'
import { Button } from '../shared/ui/Button'
import { Panel } from '../shared/ui/Panel'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import { useCategoryCatalog } from './categoryContext'
import {
  canArchiveCategory, CategoryError, categoryIconLabels, categoryLabelLimit, categoryPalette, editCategory, fallbackCategory,
  type Category, type CategoryAppearance, type CategoryIconId, type CategoryKind, type CategoryTone,
} from './catalog'
import { FieldInput } from '../shared/ui/FieldInput'

type EditableId = Exclude<Category, 'transfer'>
type Draft = CategoryAppearance & { id: EditableId; label: string; isNew?: boolean }
const iconOptions = (Object.entries(categoryIconLabels) as [CategoryIconId, string][]).filter(([icon]) => icon !== 'transfer')
const colorOptions = Object.entries(categoryPalette) as [Exclude<CategoryTone, 'income'>, string][]

function CategoryOption({ className, ...props }: Omit<ComponentProps<typeof Radio>, 'className'> & { className?: string }) {
  return <Radio {...props} className={cn(
    'grid min-h-11 w-full min-w-0 place-items-center rounded-xl border border-transparent bg-transparent p-0 text-muted shadow-none hover:bg-subtle focus-visible:-outline-offset-2 data-checked:border-primary data-checked:bg-selected data-checked:text-primary',
    className,
  )} />
}

export default reatomFactoryComponent<{ write: VaultWrite }>(() => {
  const kind = atom<CategoryKind>('expense', 'categories.kind')
  const draft = atom<Draft | null>(null, 'categories.draft')
  const form = reatomForm({ label: '', icon: 'other' as CategoryIconId, tone: 'other' as CategoryTone }, {
    name: 'categories.form',
    onSubmit: async ({ label, icon, tone }, write: VaultWrite, archived?: boolean) => {
      const current = draft()
      if (!current) return
      const selectedKind = kind()
      await wrap(write((ledger) => ({
        ledger: { ...ledger, categoryOverrides: editCategory(ledger.categoryOverrides, current.id, selectedKind, label, archived, { icon, tone }) },
        result: undefined,
      })))
      if (draft() === current) draft.set(null)
    },
  })

  const edit = action((value: Draft | null) => {
    form.reset({ label: value?.label ?? '', icon: value?.icon ?? 'other', tone: value?.tone ?? 'other' })
    draft.set(value)
  }, 'categories.edit')

  const chooseKind = action((value: string | null) => {
    if (value !== 'expense' && value !== 'income') return
    kind.set(value)
    edit(null)
  }, 'categories.chooseKind')

  return function CategoryEditor({ write }) {
    const catalog = useCategoryCatalog()
    const selected = kind()
    const current = draft()
    const name = form.fields.label()
    const icon = form.fields.icon()
    const tone = form.fields.tone()
    const selectedColor = tone === 'income' ? 'groceries' : tone
    const error = form.submit.error()
    const failure = error instanceof CategoryError ? error.message : error && messageFor(error, 'Не удалось сохранить категорию.')
    const disabled = !form.submit.ready()
    const submit = wrap((archived?: boolean) => form.submit(write, archived).catch(() => undefined))
    const list = [...catalog].filter(([, definition]) => definition.kind === selected)
      .sort(([, left], [, right]) => Number(Boolean(left.archived)) - Number(Boolean(right.archived)))
    const definition = current && catalog.get(current.id)

    return (
      <div className="flex min-w-0 flex-col gap-2">
        <SegmentedControl aria-label="Тип категорий" value={selected} onValueChange={wrap(chooseKind)}
          className="relative isolate grid w-full min-w-0 shrink-0 grid-cols-2 gap-0.5 rounded-xl border-0 bg-subtle p-0.5">
          <SegmentedControlIndicator className="rounded-lg border-0 bg-selected shadow-none" />
          <SegmentedControlItem value="expense" disabled={disabled}
            className="min-w-0 rounded-lg border-0 bg-transparent text-sm font-bold text-muted shadow-none data-checked:text-primary">Расходы</SegmentedControlItem>
          <SegmentedControlItem value="income" disabled={disabled}
            className="min-w-0 rounded-lg border-0 bg-transparent text-sm font-bold text-muted shadow-none data-checked:text-primary">Доходы</SegmentedControlItem>
        </SegmentedControl>
        {current ? (
          <form className="grid min-w-0 shrink-0 gap-3" autoComplete="off" onSubmit={(event) => {
            event.preventDefault()
            if (!disabled && name.trim()) return submit()
          }}>
            <div className="grid min-w-0 gap-1">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <label htmlFor="category-name" className="text-sm font-bold">
                  {current.isNew ? 'Новая категория' : 'Название категории'}
                </label>
                {definition && canArchiveCategory(current.id) && (
                  <Button variant="text" size="compact"
                    className="shrink-0" disabled={disabled || !name.trim()}
                    onClick={() => submit(!definition.archived)}>
                    {definition.archived ? <ArchiveRestore aria-hidden="true" data-icon="inline-start" /> : <Archive aria-hidden="true" data-icon="inline-start" />}
                    <span>{definition.archived ? 'Восстановить' : 'Архивировать'}</span>
                  </Button>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <CategoryGlyph icon={icon} tone={tone} className="size-11" />
                <FieldInput key={current.id} id="category-name" autoComplete="off" autoFocus
                  maxLength={categoryLabelLimit} disabled={disabled} value={name} onValueChange={wrap(form.fields.label.change)} />
              </div>
            </div>
            <div className="grid min-w-0 gap-1">
              <span className="text-xs font-bold text-muted" id="category-color-label">Цвет</span>
              <RadioGroup className="grid grid-cols-8 gap-1" aria-labelledby="category-color-label" value={selectedColor} disabled={disabled}
                onValueChange={wrap((value) => { if (value) form.fields.tone.change(value) })}>
                {colorOptions.map(([color, label]) => (
                  <CategoryOption key={color} value={color} aria-label={label} title={label}>
                    <CategoryAccent tone={color} className="grid size-5 place-items-center rounded-full bg-(--category-accent)" aria-hidden="true">
                      {selectedColor === color && <Check size={13} strokeWidth={2.8} className="rounded-full bg-paper p-0.5 text-ink" />}
                    </CategoryAccent>
                  </CategoryOption>
                ))}
              </RadioGroup>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-bold text-muted" id="category-icon-label">Значок</span>
                <span className="text-right text-muted">{categoryIconLabels[icon]}</span>
              </div>
              <RadioGroup className="grid grid-cols-7 gap-1" aria-labelledby="category-icon-label" value={icon} disabled={disabled}
                onValueChange={wrap((value) => { if (value) form.fields.icon.change(value) })}>
                {iconOptions.map(([option, label]) => (
                  <CategoryOption key={option} value={option} aria-label={label} title={label} className="border-line">
                    <CategoryGlyph icon={option} tone={tone} className="size-6 bg-transparent text-inherit [&>svg]:size-4.5" />
                  </CategoryOption>
                ))}
              </RadioGroup>
            </div>
            {failure && <p role="alert" className="text-sm wrap-anywhere text-danger">{failure}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={disabled} onClick={wrap(() => edit(null))}>Назад</Button>
              <Button type="submit" disabled={disabled || !name.trim()}>Сохранить</Button>
            </div>
          </form>
        ) : (
          <>
            <Button variant="secondary" className="shrink-0 self-start" onClick={wrap(() => edit({
              id: `user:${crypto.randomUUID()}`, label: '', isNew: true, icon: fallbackCategory(selected), tone: fallbackCategory(selected),
            }))}>
              <Plus aria-hidden="true" />
              <span>Добавить</span>
            </Button>
            <Panel as="ul" className="shrink-0 divide-y divide-line overflow-hidden">
              {list.map(([id, item]) => id !== 'transfer' && (
                <li key={id} className="min-w-0">
                  <ButtonPrimitive className="grid min-h-11 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-none border-0 bg-transparent px-2 py-1.5 text-left text-sm text-ink shadow-none hover:bg-subtle focus-visible:-outline-offset-2"
                    onClick={wrap(() => edit({ id, label: item.label, icon: item.icon, tone: item.tone }))}>
                    <CategoryIcon category={id} className="size-7 rounded-lg" />
                    <span className="min-w-0 truncate">{item.label}{item.archived && <small className="ml-1 text-muted">· Архив</small>}</span>
                    <ChevronRight size={15} className="text-muted" aria-hidden="true" />
                  </ButtonPrimitive>
                </li>
              ))}
            </Panel>
          </>
        )}
      </div>
    )
  }
}, 'CategoryEditor')
