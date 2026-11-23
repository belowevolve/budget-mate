import { createContext, useContext } from 'react'
import { defaultCategoryCatalog } from './catalog'

export const CatalogContext = createContext(defaultCategoryCatalog)

export function useCategoryCatalog() {
  return useContext(CatalogContext)
}
