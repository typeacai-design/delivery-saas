type DayRange = { from: string; to: string };
/** Business calendar follows the same Brazil timezone as the merchant dashboard. */
export function currentMonthRange(now = new Date()): DayRange {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = Number(parts.find(p => p.type === 'year')!.value), month = Number(parts.find(p => p.type === 'month')!.value);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate(), prefix = `${year}-${String(month).padStart(2,'0')}`;
  return { from: `${prefix}-01`, to: `${prefix}-${last}` };
}
export function financePeriodKey(storeId: string, range: DayRange) { return `finance:${storeId}:summary:${range.from}:${range.to}`; }
