import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'
import { categoryOptions } from '../categories/catalog'
import { useCategoryCatalog } from '../categories/categoryContext'
import { CategoryIcon } from '../components/CategoryIcon'
import { Choice } from '../shared/ui/Choice'
import { SearchSelect } from '../shared/ui/SearchSelect'
import { useDesktopPicker } from '../shared/ui/useDesktopPicker'
import { placeNameLimit, type Place } from './model'

export type PlaceDraft = Pick<Place, 'name' | 'category'>

export function PlaceFields({ value, onChange, disabled, autoFocus }: {
  value: PlaceDraft
  onChange: (value: PlaceDraft) => void
  disabled: boolean
  autoFocus?: boolean
}) {
  const catalog = useCategoryCatalog()
  const desktop = useDesktopPicker()
  const options = categoryOptions(catalog, 'expense', value.category).map((option) => ({
    ...option,
    icon: <CategoryIcon category={option.value} className="size-7 rounded-lg" />,
  }))

  function choose(category: string | null) {
    const option = options.find(({ value }) => value === category)
    if (!disabled && option) onChange({ ...value, category: option.value })
  }

  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-3">
      <Field name="place-name" className="grid min-w-0 gap-1">
        <FieldLabel className="text-sm font-bold">Название места</FieldLabel>
        <Input className="field-input min-w-0 text-base" placeholder="Например, Пятёрочка" value={value.name}
          onValueChange={(name) => onChange({ ...value, name })} required disabled={disabled} autoComplete="off"
          maxLength={placeNameLimit} autoFocus={autoFocus} />
      </Field>
      <div className="grid min-w-0 gap-1">
        <span className="text-sm font-bold">Категория по умолчанию</span>
        {desktop ? (
          <SearchSelect label="Категория по умолчанию" searchLabel="Поиск категорий" noResults="Категории не найдены"
            value={value.category} options={options} disabled={disabled} onValueChange={choose} />
        ) : (
          <Choice label="Категория по умолчанию" value={value.category} options={options} presentation="auto"
            className="w-full min-w-0" onChange={choose} />
        )}
      </div>
    </fieldset>
  )
}
