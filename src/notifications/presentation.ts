import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'

export const noticeIcons = {
  error: CircleAlert,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
}

export type NotificationKind = keyof typeof noticeIcons
export type Notify = (message: string, kind?: NotificationKind) => void
