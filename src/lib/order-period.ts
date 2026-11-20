import { brasiliaDay,civilDayShift } from '@/lib/brasilia'
/** Calendar dates in Brasília, independent of the merchant device. */
export function orderPeriodRange(period: 'hoje' | 'ontem', now = new Date()) {
  const day = civilDayShift(brasiliaDay(now),period==='ontem'?-1:0)

  return { from: day, to: day }
}
