const es = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
const es1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function money(n: number | null | undefined, compact = true): string {
  if (n === null || n === undefined) return '—'
  const sign = n < 0 ? '−' : ''
  const a = Math.abs(n)
  if (compact && a >= 1_000_000) return `${sign}${es1.format(a / 1_000_000)} M €`
  if (compact && a >= 100_000) return `${sign}${es.format(Math.round(a / 1000))} k €`
  return `${sign}${es.format(a)} €`
}
export function pts(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${es1.format(Math.abs(n))} pts`
}
export function pct(n: number | null | undefined): string { return n === null || n === undefined ? '—' : `${es.format(n)} %` }
export function dateEs(s: string | null | undefined): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return d ? `${d}/${m}/${y}` : `${m}/${y}`
}
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function monthEs(s: string): string { return `${MES[+s.slice(5, 7) - 1]} ${s.slice(2, 4)}` }
export function companyName(id: string): string { return id.replace(/^COMP_/, 'Filial ') }
