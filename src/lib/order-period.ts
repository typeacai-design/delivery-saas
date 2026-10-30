/** Calendar dates in the merchant device's local timezone, without subtracting fixed hours. */
export function orderPeriodRange(period: 'hoje' | 'ontem', now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (period === 'ontem' ? 1 : 0))
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return { from: day, to: day }
}
