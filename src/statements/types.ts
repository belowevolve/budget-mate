export type BankId = 'alfa' | 'vtb' | 'ozon'

export interface StatementTransaction {
  date: string
  description: string
  amountMinor: number
  currency: string
  status?: 'pending'
  reference?: string
  kind?: 'transfer'
  transferBank?: BankId | 'other'
  sbpCounterparty?: 'blank' | 'phone' | 'other'
  sbpPhoneToken?: string
  merchantCategoryCode?: string
  brokerageFunding?: true
  brokerageDestination?: string
  vtbCreditFormat?: 'card' | 'account'
  vtbAccountPreviousDescription?: string
}

export interface CreditSnapshot {
  currency: string
  asOf?: string
  gracePeriodStart?: string
  gracePeriodEnd?: string
  gracePaymentAmountMinor?: number
  minimumPaymentAmountMinor?: number
  minimumPaymentDate?: string
  totalOutstandingAmountMinor?: number
  totalOutstandingAsOf?: string
}

export interface ParsedStatement {
  bank: BankId
  accountKey: string
  accountLabel: string
  periodStart?: string
  periodEnd?: string
  transactions: StatementTransaction[]
  pendingSnapshot?: { observedOn: string; complete: boolean }
  credit?: CreditSnapshot
  warnings: string[]
}
