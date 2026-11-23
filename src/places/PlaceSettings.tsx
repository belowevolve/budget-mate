import { action, withAsync, wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Listbox, ListboxItem, ListboxItemIndicator } from '@ui-sdk/react/listbox'
import { Check, ChevronRight, Link2, Plus, SearchX } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { categoryDefinition } from '../categories/catalog'
import { useCategoryCatalog } from '../categories/categoryContext'
import { CategoryIcon } from '../components/CategoryIcon'
import SearchField from '../shared/ui/SearchField'
import type { Transaction } from '../finance'
import { pluralRu } from '../shared/format'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import { filterPlaces, indexPlaces, isIndividualPlaceAlias, merchantAlias, placeAliasLabel, PlaceError, savePlace, type Place } from './model'
import { PlaceFields, type PlaceDraft } from './PlaceFields'

type PlacePanel = { kind: 'create' } | { kind: 'edit'; placeId: string; focusBindings?: boolean } | { kind: 'bindings'; placeId: string }

function PlaceListItem({ value, label, children }: { value: string; label: string; children: ReactNode }) {
  return (
    <ListboxItem value={value} label={label} className="settings-row">
      {children}
      <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
        <ListboxItemIndicator><Check size={16} /></ListboxItemIndicator>
      </span>
    </ListboxItem>
  )
}

function PlaceRowLabel({ title, detail, icon }: { title: string; detail: string; icon?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {icon}
      <span className="grid min-w-0 gap-0.5 leading-snug">
        <span className="wrap-anywhere">{title}</span>
        <span className="text-xs font-medium wrap-anywhere text-muted">{detail}</span>
      </span>
    </span>
  )
}

export function PlaceSearchToolbar({ value, onChange, onCreate, disabled }: {
  value: string
  onChange: (value: string) => void
  onCreate: () => void
  disabled?: boolean
}) {
  return (
    <div className="search-toolbar shrink-0">
      <SearchField label="Поиск мест" value={value} onChange={onChange} />
      <Button type="button" className="btn-icon search-action" aria-label="Создать место" disabled={disabled} onClick={onCreate}>
        <Plus size={18} aria-hidden="true" />
      </Button>
    </div>
  )
}

function EmptyPlaceSearch({ onCreate, disabled }: { onCreate?: () => void; disabled?: boolean }) {
  return (
    <div className="surface-panel list-panel flex-1">
      <div className="place-search-empty">
        <div className="empty-card min-h-full">
          <span className="empty-icon" aria-hidden="true"><SearchX size={20} /></span>
          <p role="status" className="section-heading">Места не найдены</p>
          {onCreate && (
            <Button type="button" className="btn-primary" disabled={disabled} onClick={onCreate}>
              <Plus size={17} aria-hidden="true" /> Добавить место
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function PlaceOptions({ places, value, onChange, disabled, label, onCreate }: {
  places: readonly Place[]
  value: string | null
  onChange: (id: string | null) => void
  disabled: boolean
  label: string
  onCreate?: () => void
}) {
  const catalog = useCategoryCatalog()
  if (!places.length) return <EmptyPlaceSearch onCreate={onCreate} disabled={disabled} />

  return (
    <div className="surface-panel list-panel">
      <Listbox value={value} activation="manual" aria-label={label} disabled={disabled} onValueChange={onChange}>
        {places.map(({ id, name, category }) => (
          <PlaceListItem key={id} value={id} label={name}>
            <PlaceRowLabel title={name} detail={categoryDefinition(catalog, category).label}
              icon={<CategoryIcon category={category} className="size-7 rounded-lg" />} />
          </PlaceListItem>
        ))}
      </Listbox>
    </div>
  )
}

function PlaceBindings({ place, places, transactions, pending, error, onBack, onEdit }: {
  place: Place
  places: readonly Place[]
  transactions: readonly Transaction[]
  pending: boolean
  error?: string
  onBack: () => void
  onEdit: (aliases: string[], toId: string | null, onSaved: () => void) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [choosingTarget, setChoosingTarget] = useState(false)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [targetQuery, setTargetQuery] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const targets = places.filter(({ id }) => id !== place.id)
  const visibleTargets = filterPlaces(targets, targetQuery)
  const target = visibleTargets.find(({ id }) => id === targetId)
  const selectedAliases = selected.filter((alias) => place.aliases.includes(alias))
  const allSelected = selectedAliases.length === place.aliases.length
  const counts = useMemo(() => {
    const result = new Map<string, number>()
    const placesByAlias = indexPlaces(places)
    for (const row of transactions) {
      const alias = merchantAlias(row, placesByAlias)
      if (alias && placesByAlias.get(alias)?.id === place.id) result.set(alias, (result.get(alias) ?? 0) + 1)
    }
    return result
  }, [place.id, places, transactions])

  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }) }, [choosingTarget])

  function apply(toId: string | null) {
    onEdit(selectedAliases, toId, () => {
      setSelected([])
      setTargetId(null)
      setTargetQuery('')
      setChoosingTarget(false)
    })
  }

  return (
    <section data-settings-fill aria-label="Привязки места" className="flex min-h-0 min-w-0 flex-col gap-3">
      <div className="grid min-w-0 shrink-0 gap-0.5">
        <h2 ref={heading} tabIndex={-1} className="section-heading outline-none">
          {choosingTarget ? 'Куда перенести' : 'Привязки'}
        </h2>
        <p className="text-sm font-semibold wrap-anywhere text-muted">{place.name}</p>
      </div>
      {choosingTarget ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <SearchField label="Поиск мест" value={targetQuery} onChange={setTargetQuery} />
          <PlaceOptions key={targetQuery} places={visibleTargets} value={target?.id ?? null} onChange={setTargetId} disabled={pending} label="Место назначения" />
        </div>
      ) : place.aliases.length > 0 ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="surface-panel list-panel">
            {place.aliases.length > 1 && (
              <Button className="settings-row shrink-0 border-b border-line text-primary" disabled={pending}
                onClick={() => setSelected(allSelected ? [] : place.aliases)}>
                {allSelected ? 'Снять выбор' : 'Выбрать все'}
              </Button>
            )}
            <Listbox multiple activation="manual" aria-label="Привязки из выписки" value={selectedAliases} disabled={pending}
              onValueChange={setSelected}>
              {place.aliases.map((alias) => {
                const count = counts.get(alias) ?? 0
                const label = placeAliasLabel(alias)
                const kind = isIndividualPlaceAlias(alias) ? 'Отдельная операция' : 'Правило из выписки'
                return (
                  <PlaceListItem key={alias} value={alias} label={label}>
                    <PlaceRowLabel title={label} detail={`${kind} · ${count} ${pluralRu(count, 'операция', 'операции', 'операций')}`} />
                  </PlaceListItem>
                )
              })}
            </Listbox>
          </div>
        </div>
      ) : <p className="body-text flex-1">Привязки можно добавить в карточке операции.</p>}
      {error && <p role="alert" className="error-text shrink-0">{error}</p>}
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">
        <Button className="btn-text" disabled={pending} onClick={choosingTarget ? () => {
          setTargetId(null)
          setTargetQuery('')
          setChoosingTarget(false)
        } : onBack}>Назад</Button>
        {!choosingTarget && place.aliases.length > 0 && (
          <Button className="btn-secondary flex-1 text-danger" disabled={pending || !selectedAliases.length}
            onClick={() => apply(null)}>Отвязать</Button>
        )}
        {targets.length > 0 && place.aliases.length > 0 && (
          <Button className="btn-primary flex-1" disabled={pending || !selectedAliases.length || (choosingTarget && !target)}
            onClick={() => { if (choosingTarget && target) apply(target.id); else setChoosingTarget(true) }}>Перенести</Button>
        )}
      </div>
    </section>
  )
}

export default reatomFactoryComponent<{
  places: readonly Place[]
  transactions: readonly Transaction[]
  write: VaultWrite
  onEditBindings: (fromId: string, aliases: string[], toId: string | null) => Promise<void>
}>(() => {
  const save = action(async (commit: () => Promise<unknown>, onSaved: () => void) => {
    await wrap(commit())
    onSaved()
  }, 'placeSettings.save').extend(withAsync())

  return function PlaceSettings({ places, transactions, write, onEditBindings }) {
    const catalog = useCategoryCatalog()
    const [panel, setPanel] = useState<PlacePanel | null>(null)
    const [draft, setDraft] = useState<PlaceDraft>({ name: '', category: 'other' })
    const [query, setQuery] = useState('')
    const editHeading = useRef<HTMLHeadingElement>(null)
    const list = [...places].sort((left, right) => left.name.localeCompare(right.name, 'ru'))
    const visiblePlaces = filterPlaces(list, query)
    const pending = save.pending() > 0
    const failure = save.error()
    const error = failure instanceof PlaceError ? failure.message : failure && messageFor(failure, 'Не удалось сохранить место.')
    const current = panel && panel.kind !== 'create' ? places.find(({ id }) => id === panel.placeId) : undefined

    useLayoutEffect(() => {
      if (panel?.kind === 'edit' && !panel.focusBindings) editHeading.current?.focus({ preventScroll: true })
    }, [panel])

    function showPanel(next: PlacePanel | null) {
      save.error.set(undefined)
      setPanel(next)
    }

    function submit(commit: () => Promise<unknown>, onSaved: () => void) {
      if (save.pending() > 0) return
      save.error.set(undefined)
      void save(commit, onSaved).catch(() => undefined)
    }

    if (!panel || (panel.kind !== 'create' && !current)) {
      const createPlace = wrap(() => {
        setDraft({ name: '', category: 'other' })
        showPanel({ kind: 'create' })
      })

      return (
        <section data-settings-fill aria-label="Список мест" className="flex min-h-0 min-w-0 flex-col gap-2">
          {list.length > 0 ? <PlaceSearchToolbar value={query} onChange={setQuery} onCreate={createPlace} disabled={pending} /> : (
            <Button className="btn-secondary shrink-0 self-start" onClick={createPlace} disabled={pending}>
              <Plus size={17} aria-hidden="true" /> Добавить место
            </Button>
          )}
          {visiblePlaces.length > 0 ? (
            <div className="surface-panel list-panel">
              <ul key={query}>
                {visiblePlaces.map((place) => (
                  <li key={place.id}>
                    <Button className="settings-row" onClick={wrap(() => {
                      setDraft({ name: place.name, category: place.category })
                      showPanel({ kind: 'edit', placeId: place.id })
                    })}>
                      <PlaceRowLabel title={place.name} detail={categoryDefinition(catalog, place.category).label}
                        icon={<CategoryIcon category={place.category} className="size-7 rounded-lg" />} />
                      <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : list.length > 0
            ? <EmptyPlaceSearch onCreate={createPlace} disabled={pending} />
            : <p className="text-sm text-muted">Привяжи расход к месту, чтобы оно применялось и к похожим записям из выписок.</p>}
        </section>
      )
    }

    if (panel.kind === 'bindings' && current) {
      return (
        <PlaceBindings place={current} places={list} transactions={transactions} pending={pending} error={error || undefined}
          onBack={wrap(() => showPanel({ kind: 'edit', placeId: current.id, focusBindings: true }))}
          onEdit={wrap((aliases, toId, onSaved) => submit(() => onEditBindings(current.id, aliases, toId), onSaved))} />
      )
    }

    return (
      <>
        <form className="surface-panel card-padding grid min-w-0 gap-3" autoComplete="off" onSubmit={wrap((event) => {
          event.preventDefault()
          if (!draft.name.trim()) return
          submit(() => write((ledger) => ({
            ledger: { ...ledger, places: savePlace(ledger.places, catalog, { ...draft, id: current?.id }) },
            result: undefined,
          })), () => showPanel(null))
        })}>
          <h2 ref={editHeading} tabIndex={-1} className="section-heading outline-none">
            {current ? 'Редактировать место' : 'Новое место'}
          </h2>
          <PlaceFields key={current?.id ?? 'new'} value={draft} onChange={setDraft} disabled={pending}
            autoFocus={panel.kind === 'create'} />
          {error && <p role="alert" className="error-text">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" className="btn-secondary" disabled={pending} onClick={wrap(() => showPanel(null))}>Отмена</Button>
            <Button type="submit" className="btn-primary" disabled={pending || !draft.name.trim()}>Сохранить</Button>
          </div>
        </form>
        {current && (
          <div className="surface-panel overflow-hidden">
            <Button className="settings-row" disabled={pending} autoFocus={panel.kind === 'edit' && panel.focusBindings}
              onClick={wrap(() => showPanel({ kind: 'bindings', placeId: current.id }))}>
              <Link2 size={17} className="shrink-0 text-primary" aria-hidden="true" />
              <span>Привязки</span>
              <span className="text-xs text-muted">{current.aliases.length}</span>
              <ChevronRight size={15} className="shrink-0 text-muted" aria-hidden="true" />
            </Button>
          </div>
        )}
      </>
    )
  }
}, 'PlaceSettings')
