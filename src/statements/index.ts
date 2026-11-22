import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { StatementError } from './errors'
import { makeRows, type StatementPage } from './layout'
import { parseStatementText } from './parsers'
import type { ParsedStatement } from './types'

export type { BankId, CreditSnapshot, ParsedStatement, StatementTransaction } from './types'
export { StatementError } from './errors'
export { parseStatementText } from './parsers'

const MAX_FILE_BYTES = 32 * 1024 * 1024
const MAX_PAGES = 500

GlobalWorkerOptions.workerSrc = workerUrl

export async function parseStatement(file: File, sbpKey?: string, signal?: AbortSignal): Promise<ParsedStatement> {
  signal?.throwIfAborted()
  if (file.size === 0) throw new StatementError('PDF-файл пуст.')
  if (file.size > MAX_FILE_BYTES) throw new StatementError('PDF больше 32 МБ. Выгрузите выписку за более короткий период.')

  const data = new Uint8Array(await file.arrayBuffer())
  signal?.throwIfAborted()
  const task = getDocument({
    data,
    useSystemFonts: false,
    useWorkerFetch: false,
    useWasm: false,
    verbosity: 0,
  })

  async function readPages() {
    const pages: StatementPage[] = []
    const pdf = await task.promise
    if (pdf.numPages > MAX_PAGES) throw new StatementError('В PDF больше 500 страниц.')
    for (let index = 1; index <= pdf.numPages; index++) {
      signal?.throwIfAborted()
      const page = await pdf.getPage(index)
      signal?.throwIfAborted()
      const content = await page.getTextContent()
      signal?.throwIfAborted()
      pages.push(makeRows(content.items.filter((item) => 'str' in item)))
      page.cleanup()
    }
    signal?.throwIfAborted()
    const statement = await parseStatementText(pages, sbpKey)
    signal?.throwIfAborted()
    return statement
  }

  let removeAbort: (() => void) | undefined
  const cancelled = new Promise<never>((_, reject) => {
    if (!signal) return
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    removeAbort = () => signal.removeEventListener('abort', abort)
  })
  try {
    return await Promise.race([readPages(), cancelled])
  } finally {
    removeAbort?.()
    await task.destroy()
  }
}
