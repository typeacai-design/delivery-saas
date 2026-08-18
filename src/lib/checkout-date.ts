export function formatBirthdayInput(value: string) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function birthdayParts(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3])
  const civil = new Date(Date.UTC(year, month - 1, day))
  if (civil.getUTCFullYear() !== year || civil.getUTCMonth() !== month - 1 || civil.getUTCDate() !== day) return null
  return { day, month, year, iso: `${match[3]}-${match[2]}-${match[1]}`, sortable: year * 10000 + month * 100 + day }
}

function fortalezaToday(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value)
  return get('year') * 10000 + get('month') * 100 + get('day')
}

export function isValidBirthday(value: string, now = new Date()) {
  const birthday = birthdayParts(value)
  return birthday !== null && birthday.sortable <= fortalezaToday(now)
}

export function birthdayToIso(value: string, now = new Date()) {
  const birthday = birthdayParts(value)
  return birthday && birthday.sortable <= fortalezaToday(now) ? birthday.iso : null
}
