import { useMemo, type ReactNode } from 'react'
import { categoryCatalog, type CategoryOverride } from './catalog'
import { CatalogContext } from './categoryContext'

export function CategoryCatalogProvider({ overrides, children }: { overrides?: CategoryOverride[]; children: ReactNode }) {
  const catalog = useMemo(() => categoryCatalog(overrides), [overrides])
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>
}
