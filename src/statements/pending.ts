import type { Transaction } from '../finance'
import type { ParsedStatement, StatementTransaction } from './types'

export interface PendingCoverage {
  accountKey: string
  periodStart: string
  periodEnd: string
  observedOn: string
}

function countRows(rows: StatementTransaction[], keyOf: (row: StatementTransaction) => string, pending: boolean) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if ((row.status === 'pending') !== pending) continue
    const key = keyOf(row)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function collectCoverage(current: PendingCoverage[], next: PendingCoverage) {
  const overlaps = (outer: PendingCoverage, inner: PendingCoverage) =>
    outer.accountKey === inner.accountKey && outer.observedOn >= inner.observedOn
    && outer.periodStart <= inner.periodStart && outer.periodEnd >= inner.periodEnd

  if (current.some((range) => overlaps(range, next))) return current
  return [...current.filter((range) => !overlaps(next, range)), next]
}

export function mergePending(
  current: Transaction[],
  coverage: PendingCoverage[],
  statement: ParsedStatement,
  keyOf: (row: StatementTransaction) => string,
  create: (row: StatementTransaction) => Transaction,
  bookedCount: (key: string) => number,
) {
  const { accountKey, periodStart, periodEnd, pendingSnapshot } = statement
  if (!pendingSnapshot) return { transactions: current, coverage, added: 0 }

  const { observedOn, complete } = pendingSnapshot
  const reported = countRows(statement.transactions, keyOf, true)
  const bookedInStatement = countRows(statement.transactions, keyOf, false)
  const settled = new Map(bookedInStatement)
  const remaining = new Map(reported)
  const preserved = new Map<string, number>()
  const covered = (date: string) => !!(complete && periodStart && periodEnd && periodStart <= date && periodEnd >= date)
  const transactions: Transaction[] = []
  for (const row of current) {
    if (row.accountKey !== accountKey || (row.pendingObservedOn ?? '') > observedOn) {
      transactions.push(row)
      continue
    }
    const key = keyOf(row)
    const stillReported = remaining.get(key) ?? 0
    if (stillReported === 0) {
      const knownSettlements = settled.get(key) ?? 0
      // Alfa only prints a generation day. A missing same-day item is not enough to clear it.
      if (covered(row.date) && (row.pendingObservedOn ?? '') < observedOn) continue
      if (knownSettlements > 0) {
        settled.set(key, knownSettlements - 1)
        continue
      }
      transactions.push(row)
      continue
    }

    remaining.set(key, stillReported - 1)
    const updated = row.pendingObservedOn === observedOn ? row : { ...row, pendingObservedOn: observedOn }
    preserved.set(key, (preserved.get(key) ?? 0) + 1)
    transactions.push(updated)
  }

  const unseenBookings = new Map<string, number>()
  let added = 0
  for (const row of statement.transactions) {
    if (row.status !== 'pending') continue
    const key = keyOf(row)
    const knownHolds = preserved.get(key) ?? 0
    if (knownHolds > 0) {
      preserved.set(key, knownHolds - 1)
      continue
    }
    if (transactions.some((entry) => entry.accountKey === accountKey && (entry.pendingObservedOn ?? '') > observedOn
      && keyOf(entry) === key)) continue
    if (coverage.some((range) => range.accountKey === accountKey && range.observedOn > observedOn
      && range.periodStart <= row.date && range.periodEnd >= row.date)) continue
    const unmatchedBookings = unseenBookings.get(key) ?? bookedCount(key) - (bookedInStatement.get(key) ?? 0)
    if (covered(row.date) && unmatchedBookings > 0) {
      unseenBookings.set(key, unmatchedBookings - 1)
      continue
    }
    transactions.push({ ...create(row), pendingObservedOn: observedOn })
    added++
  }

  return {
    transactions,
    coverage: complete && periodStart && periodEnd
      ? collectCoverage(coverage, { accountKey, periodStart, periodEnd, observedOn })
      : coverage,
    added,
  }
}
