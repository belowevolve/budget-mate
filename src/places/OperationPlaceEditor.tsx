import { action, withAsync, wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Dialog, DialogTrigger } from '@ui-sdk/react/dialog'
import { MapPin, Plus, Unlink } from 'lucide-react'
import { useRef, useState } from 'react'
import { categoryDefinition } from '../categories/catalog'
import { useCategoryCatalog } from '../categories/categoryContext'
import { CategoryIcon } from '../components/CategoryIcon'
import type { Transaction } from '../finance'
import { DialogBody, DialogSurface } from '../shared/ui/DialogSurface'
import { Button } from '../shared/ui/Button'
import { ChoiceTriggerButton } from '../shared/ui/ChoiceParts'
import { ChoiceTriggerContent } from '../shared/ui/ChoiceTriggerContent'
import { DialogActions } from '../shared/ui/DialogActions'
import { DialogHeader } from '../shared/ui/DialogHeader'
import { SearchSelect } from '../shared/ui/SearchSelect'
import { useDialogBackRecovery } from '../shared/ui/popupBack'
import { useDesktopPicker } from '../shared/ui/useDesktopPicker'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import { assignPlace, filterPlaces, indexPlaces, isIndividualPlaceAlias, merchantAlias, placeAliasLabel, PlaceError, savePlace, unassignPlace, type Place } from './model'
import { PlaceFields, type PlaceDraft } from './PlaceFields'
import { PlaceOptions, PlaceSearchToolbar } from './PlaceSettings'
import { ErrorText } from '../shared/ui/Text'

type Props = {
  row: Transaction
  places?: readonly Place[]
  write: VaultWrite
  disabled?: boolean
}

type PlacePickerMode = 'choose' | 'create' | 'first'
type PlaceUpdate = (places: readonly Place[] | undefined) => Place[]

export default reatomFactoryComponent<Props>(() => {
  const save = action(async (write: VaultWrite, update: PlaceUpdate, onSaved: () => void) => {
    await wrap(write((ledger) => ({ ledger: { ...ledger, places: update(ledger.places) }, result: undefined })))
    onSaved()
  }, 'operationPlace.save').extend(withAsync())

  return function OperationPlaceEditor({ row, places = [], write, disabled }) {
    const catalog = useCategoryCatalog()
    const back = useDialogBackRecovery()
    const desktop = useDesktopPicker()
    const trigger = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [nextLayer, setNextLayer] = useState<'create' | 'picker' | null>(null)
    const [mode, setMode] = useState<PlacePickerMode>('choose')
    const [chosenId, setChosenId] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const [draft, setDraft] = useState<PlaceDraft>({ name: '', category: 'other' })
    const placesByAlias = indexPlaces(places)
    const alias = merchantAlias(row, placesByAlias)
    if (!alias) return null
    const current = placesByAlias.get(alias)
    const ordered = [...places].sort((left, right) => left.name.localeCompare(right.name, 'ru'))
    const visiblePlaces = filterPlaces(ordered, query)
    const visibleChoiceId = visiblePlaces.some(({ id }) => id === chosenId) ? chosenId : null
    const isNew = mode !== 'choose'
    const hasSecondaryAction = mode === 'create' || (!isNew && Boolean(current))
    const initialCategory = catalog.get(row.category)
    const pending = save.pending() > 0
    const failure = save.error()
    const error = failure instanceof PlaceError ? failure.message : failure && messageFor(failure, 'Не удалось обновить место.')
    const hasToolbar = !isNew || Boolean(error)
    const canSave = isNew ? Boolean(draft.name.trim()) : Boolean(visibleChoiceId && visibleChoiceId !== current?.id)
    const canBind = Boolean(chosenId && chosenId !== current?.id)

    function showMode(next: PlacePickerMode) {
      save.error.set(undefined)
      setMode(next)
      setDraft({ name: '', category: initialCategory?.kind === 'expense' && !initialCategory.archived ? row.category : 'other' })
    }
    const createPlace = wrap(() => showMode('create'))

    function submit(update: PlaceUpdate, onSaved = () => setOpen(false)) {
      if (save.pending() > 0) return
      save.error.set(undefined)
      void save(write, update, onSaved).catch(() => undefined)
    }

    function backToPlaces() {
      if (desktop) {
        setNextLayer('picker')
        setOpen(false)
      } else showMode('choose')
    }

    const placeLabel = current?.name ?? 'Привязать место'
    const placeIcon = <MapPin size={17} className="size-7 shrink-0 rounded-lg bg-subtle p-1.5" aria-hidden="true" />
    const closePicker = () => setPickerOpen(false)

    return (
      <Dialog presentation="auto" open={open} onOpenChange={wrap((next, details) => {
        if (save.pending() > 0) {
          details.cancel()
          back.onCanceledClose(details.reason)
          return
        }
        if (next) {
          showMode(ordered.length ? 'choose' : 'first')
          setChosenId(current?.id ?? null)
          setQuery('')
        }
        setOpen(next)
      })} onOpenChangeComplete={wrap((shown) => {
        if (!shown && nextLayer === 'picker') {
          showMode('choose')
          setChosenId(current?.id ?? null)
          setNextLayer(null)
          setPickerOpen(true)
        }
      })}>
        {desktop && ordered.length > 0 ? (
          <SearchSelect label="Место расхода" searchLabel="Поиск мест" noResults="Места не найдены" placeholder="Привязать место"
            triggerIcon={placeIcon} triggerRef={trigger} disabled={disabled} open={pickerOpen}
            value={pickerOpen ? chosenId : current?.id ?? null}
            options={ordered.map(({ id, name, category }) => ({
              value: id, label: name, detail: categoryDefinition(catalog, category).label,
              icon: <CategoryIcon category={category} className="size-7 rounded-lg" />,
            }))}
            onValueChange={setChosenId}
            onOpenChange={wrap((next, details) => {
              if (save.pending() > 0 || details.reason === 'item-press') {
                details.cancel()
                return
              }
              if (next) {
                showMode('choose')
                setChosenId(current?.id ?? null)
              }
              setPickerOpen(next)
            })}
            onOpenChangeComplete={wrap((shown) => {
              if (!shown && nextLayer === 'create') {
                setNextLayer(null)
                setOpen(true)
              }
            })}
            searchAction={
              <Button variant="secondary" size="icon-sm" className="rounded-lg" aria-label="Создать место" disabled={pending} onClick={wrap(() => {
                showMode('create')
                setNextLayer('create')
                closePicker()
              })}>
                <Plus aria-hidden="true" />
              </Button>
            }
            footer={
              <>
                {error && <ErrorText role="alert">{error}</ErrorText>}
                <DialogActions>
                  {current && (
                    <Button variant="secondary" size="small" disabled={pending}
                      onClick={wrap(() => submit((items) => unassignPlace(items, alias), closePicker))}>
                      <Unlink aria-hidden="true" />
                      <span>Отвязать</span>
                    </Button>
                  )}
                  <Button size="small" disabled={pending || !canBind} onClick={wrap(() => {
                    if (chosenId && canBind) submit((items) => assignPlace(items, chosenId, alias), closePicker)
                  })}>
                    {current ? 'Сменить место' : 'Привязать'}
                  </Button>
                </DialogActions>
              </>
            } />
        ) : (
          <DialogTrigger ref={trigger} render={<ChoiceTriggerButton />} className="w-full min-w-0 text-start" disabled={disabled}>
            <ChoiceTriggerContent icon={placeIcon} direction="next">{placeLabel}</ChoiceTriggerContent>
          </DialogTrigger>
        )}
        <DialogSurface key={back.contentKey} initialFocus="content"
          finalFocus={desktop ? () => trigger.current : undefined}
          className={`grid-rows-[auto_minmax(0,1fr)] ${isNew ? '' : 'h-dvh'}`}>
          <DialogHeader title={isNew ? 'Новое место' : 'Место расхода'} closeDisabled={pending} description={(
            <span className="grid gap-0.5">
              <span>{placeAliasLabel(alias)}</span>
              {isIndividualPlaceAlias(alias) && <span>Для этой операции</span>}
            </span>
          )} />
          <form autoComplete="off"
            className={`grid min-h-0 min-w-0 gap-2 ${hasToolbar ? 'grid-rows-[auto_minmax(0,1fr)_auto]' : 'grid-rows-[minmax(0,1fr)_auto]'}`}
            onSubmit={wrap((event) => {
              event.preventDefault()
              if (!canSave) return
              if (isNew) submit((currentPlaces) => savePlace(currentPlaces, catalog, { ...draft, alias }))
              else if (visibleChoiceId) submit((currentPlaces) => assignPlace(currentPlaces, visibleChoiceId, alias))
            })}>
            {hasToolbar && (
              <div className="grid min-w-0 gap-2">
                {!isNew && (
                  <PlaceSearchToolbar value={query} onChange={setQuery} onCreate={createPlace} disabled={pending} />
                )}
                {error && <ErrorText role="alert">{error}</ErrorText>}
              </div>
            )}
            {isNew ? (
              <DialogBody>
                <PlaceFields value={draft} onChange={setDraft} disabled={pending} autoFocus={mode === 'create'} />
              </DialogBody>
            ) : (
              <PlaceOptions key={query} places={visiblePlaces} value={visibleChoiceId}
                onChange={setChosenId} disabled={pending} label="Места" onCreate={createPlace} />
            )}
            <div className={`grid min-w-0 gap-2 ${hasSecondaryAction ? 'grid-cols-[auto_minmax(0,1fr)]' : ''}`}>
              {mode === 'create' && (
                <Button variant="secondary" disabled={pending} onClick={wrap(backToPlaces)}>К списку</Button>
              )}
              {!isNew && current && (
                <Button variant="secondary" disabled={pending}
                  onClick={wrap(() => submit((currentPlaces) => unassignPlace(currentPlaces, alias)))}>
                  <Unlink aria-hidden="true" />
                  <span>Отвязать</span>
                </Button>
              )}
              <Button type="submit" disabled={pending || !canSave}>
                {isNew ? 'Создать и привязать' : current ? 'Сменить место' : 'Привязать'}
              </Button>
            </div>
          </form>
        </DialogSurface>
      </Dialog>
    )
  }
}, 'OperationPlaceEditor')
