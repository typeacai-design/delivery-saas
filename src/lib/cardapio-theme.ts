export const CARDAPIO_THEMES = {
  'verde-classica': { background: '#FFFFFF', surface: '#F0FDF4', primary: '#16A34A', secondary: '#15803D', text: '#0A0A0A', muted: '#64748B' },
  'quente-laranja': { background: '#FFFBEB', surface: '#FED7AA', primary: '#EA580C', secondary: '#C2410C', text: '#7C2D12', muted: '#9A3412' },
  'azul-marinho': { background: '#FFFFFF', surface: '#DBEAFE', primary: '#1E40AF', secondary: '#1E3A8A', text: '#0F172A', muted: '#475569' },
} as const
export type CardapioTheme = { background: string; surface: string; primary: string; secondary: string; accent: string; text: string; muted: string; button: string }
export type CustomCardapioColors = Partial<Record<'primary' | 'secondary' | 'accent', string>>
const HEX = /^#[0-9A-F]{6}$/i
function luminance(hex: string) {
  const rgb = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]
}
export function getCardapioTheme(id: string, custom?: CustomCardapioColors): CardapioTheme {
  const legacy = CARDAPIO_THEMES[id as keyof typeof CARDAPIO_THEMES] || CARDAPIO_THEMES['verde-classica']
  const valid = (key: keyof CustomCardapioColors, fallback: string) => HEX.test(custom?.[key] || '') ? custom![key]! : fallback
  const primary = valid('primary', legacy.primary).toUpperCase()
  const secondary = valid('secondary', legacy.secondary).toUpperCase()
  const accent = valid('accent', legacy.primary).toUpperCase()
  const darkPrimary = luminance(primary) < .46
  return { primary, secondary, accent, background: darkPrimary ? '#FFFFFF' : '#F8FAFC', surface: darkPrimary ? '#F8FAFC' : '#FFFFFF', text: '#111827', muted: '#64748B', button: luminance(primary) < .72 ? primary : secondary }
}
