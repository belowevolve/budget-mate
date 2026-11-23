import { action, withAsync, wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import { Button } from '@ui-sdk/react/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog'
import { ChevronRight, MapPin, Unlink, X } from 'lucide-react'
import { useState } from 'react'
import { useCategoryCatalog } from '../categories/categoryContext'
import { SheetGrip } from '../components/SheetGrip'
import { useDialogBack } from '../components/useDialogBack'
import type { Transaction } from '../finance'
import { messageFor, type VaultWrite } from '../vault-ui/vaultModel'
import { assignPlace, filterPlaces, indexPlaces, isIndividualPlaceAlias, merchantAlias, placeAliasLabel, PlaceError, savePlace, unassignPlace, type Place } from './model'
import { PlaceFields, PlaceOptions, PlaceSearchToolbar } from './PlaceSettings'

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
    const back = useDialogBack()
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState<PlacePickerMode>('choose')
    const [chosenId, setChosenId] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const [draft, setDraft] = useState<Pick<Place, 'name' | 'category'>>({ name: '', category: 'other' })
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

    function showMode(next: PlacePickerMode) {
      save.error.set(undefined)
      setMode(next)
      setDraft({ name: '', category: initialCategory?.kind === 'expense' && !initialCategory.archived ? row.category : 'other' })
    }
    const createPlace = wrap(() => showMode('create'))

    function submit(update: PlaceUpdate) {
      if (save.pending() > 0) return
      void save(write, update, () => setOpen(false)).catch(() => undefined)
    }

    return (
      <Dialog presentation="auto" open={open} onOpenChange={wrap((next, details) => {
        if (save.pending() > 0) {
          details.cancel()
          if (details.reason === 'back') back.rearm()
          return
        }
        if (next) {
          showMode(ordered.length ? 'choose' : 'first')
          setChosenId(current?.id ?? null)
          setQuery('')
        }
        setOpen(next)
      })}>
        <DialogTrigger className="choice-trigger w-full min-w-0 text-left" disabled={disabled}>
          <MapPin size={17} className="size-7 shrink-0 rounded-lg bg-subtle p-1.5" aria-hidden="true" />
          <span className="min-w-0 truncate">{current?.name ?? 'Привязать место'}</span>
          <ChevronRight size={16} className="ml-auto shrink-0" aria-hidden="true" />
        </DialogTrigger>
        <DialogContent key={back.contentKey} initialFocus="content"
          className={`compact-dialog grid-rows-[auto_minmax(0,1fr)] ${isNew ? '' : 'h-dvh'}`}>
          <div className="dialog-header">
            <SheetGrip />
            <div className="min-w-0">
              <DialogTitle className="min-w-0 text-lg leading-tight">{isNew ? 'Новое место' : 'Место расхода'}</DialogTitle>
              <DialogDescription className="mt-1 grid gap-0.5 text-xs leading-snug wrap-anywhere text-muted">
                <span>{placeAliasLabel(alias)}</span>
                {isIndividualPlaceAlias(alias) && <span>Для этой операции</span>}
              </DialogDescription>
            </div>
            <DialogClose className="dialog-close" aria-label="Закрыть" disabled={pending}><X size={16} aria-hidden="true" /></DialogClose>
          </div>
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
                {error && <p role="alert" className="error-text">{error}</p>}
              </div>
            )}
            {isNew ? (
              <div data-slot="scroll" className="dialog-body">
                <PlaceFields value={draft} onChange={setDraft} disabled={pending} autoFocus={mode === 'create'} />
              </div>
            ) : (
              <PlaceOptions key={query} places={visiblePlaces} value={visibleChoiceId}
                onChange={setChosenId} disabled={pending} label="Места" onCreate={createPlace} />
            )}
            <div className={`grid min-w-0 gap-2 ${hasSecondaryAction ? 'grid-cols-[auto_minmax(0,1fr)]' : ''}`}>
              {mode === 'create' && (
                <Button type="button" className="btn-secondary" disabled={pending} onClick={wrap(() => showMode('choose'))}>К списку</Button>
              )}
              {!isNew && current && (
                <Button type="button" className="btn-secondary" disabled={pending}
                  onClick={wrap(() => submit((currentPlaces) => unassignPlace(currentPlaces, alias)))}>
                  <Unlink size={16} aria-hidden="true" /> Отвязать
                </Button>
              )}
              <Button type="submit" className="btn-primary min-w-0 whitespace-normal" disabled={pending || !canSave}>
                {isNew ? 'Создать и привязать' : current ? 'Сменить место' : 'Привязать'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }
}, 'OperationPlaceEditor')
