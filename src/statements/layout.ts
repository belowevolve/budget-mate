export interface TextCell {
  text: string
  x: number
  y: number
  width: number
}

export type TextRow = TextCell[]
export type StatementPage = TextRow[]

interface PdfTextItem {
  str: string
  transform: number[]
  width: number
}

export function makeRows(items: PdfTextItem[]): StatementPage {
  const cells = items.flatMap(({ str, transform, width }) => {
    const text = str.replace(/[\u00a0\u202f]/g, ' ').trim()
    if (!text) return []
    const [, , , , x, y] = transform
    return [{ text, x, y, width }]
  })

  cells.sort((a, b) => b.y - a.y)
  const rows: StatementPage = []
  for (const cell of cells) {
    const row = rows.at(-1)
    if (row && Math.abs(row[0].y - cell.y) < 2) {
      row.push(cell)
    } else {
      rows.push([cell])
    }
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x)
  return rows
}

export function rowText(row: TextRow): string {
  return row.map((cell) => cell.text).join(' ')
}

export function textIn(row: TextRow, minX: number, maxX: number): string {
  return rowText(row.filter((cell) => cell.x >= minX && cell.x < maxX))
}
