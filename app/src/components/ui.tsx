import type { ReactNode } from 'react'
import type { Band } from '../types'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface border border-line rounded-md ${className}`}>{children}</div>
}
export function H({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return <div className="mb-3"><h2 className="text-[15px] font-semibold">{children}</h2>{sub && <div className="text-[12px] text-ink-3">{sub}</div>}</div>
}
export function Empty({ text = 'Sin datos del modelo' }: { text?: string }) {
  return <div className="h-full min-h-24 flex items-center justify-center text-ink-3 text-[13px] bg-bg/60 border border-dashed border-line rounded-md">{text}</div>
}

type Tone = 'neutral' | 'good' | 'bad' | 'warn'
const toneCls: Record<Tone, string> = { neutral: 'text-ink', good: 'text-good', bad: 'text-bad', warn: 'text-warn' }
export function StatTile({ label, value, tone = 'neutral', caption }: { label: string; value: ReactNode; tone?: Tone; caption?: ReactNode }) {
  return (
    <Card className="px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-ink-3">{label}</div>
      <div className={`text-[24px] font-semibold num leading-tight mt-1 ${toneCls[tone]}`}>{value}</div>
      {caption && <div className="text-[12px] text-ink-2 mt-1">{caption}</div>}
    </Card>
  )
}

const bandCls: Record<Band, string> = { sana: 'bg-good-soft text-good', vigilar: 'bg-warn-soft text-warn', riesgo: 'bg-bad-soft text-bad', critica: 'bg-bad text-white' }
export const bandLabel: Record<Band, string> = { sana: 'Sana', vigilar: 'Vigilar', riesgo: 'Riesgo', critica: 'Crítica' }
export function ScoreChip({ value, band, size = 'sm', hollow = false }: { value: number; band: Band; size?: 'sm' | 'lg'; hollow?: boolean }) {
  const s = size === 'lg' ? 'text-[32px] px-4 py-1.5 rounded-lg' : 'text-[13px] px-2 py-0.5 rounded'
  return <span className={`inline-block font-semibold num ${s} ${bandCls[band]} ${hollow ? 'ring-2 ring-offset-1 ring-line' : ''}`} title={bandLabel[band]}>{Math.round(value)}</span>
}

export function Sparkline({ points, w = 72, h = 20 }: { points: number[]; w?: number; h?: number }) {
  if (points.length < 2) return <span className="text-ink-3">—</span>
  const lo = Math.min(...points), hi = Math.max(...points), span = hi - lo || 1
  const d = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - lo) / span) * (h - 2) - 1}`).join(' ')
  const up = points[points.length - 1] >= points[0]
  return <svg width={w} height={h} className="block"><polyline points={d} fill="none" stroke={up ? 'var(--color-good)' : 'var(--color-bad)'} strokeWidth="1.5" /></svg>
}

export function CoverageDots({ c }: { c: { bank: boolean; erp: boolean; debt: boolean } }) {
  const dot = (ok: boolean, t: string) => <span title={ok ? t : `${t}: sin datos`} className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-accent' : 'bg-line'}`} />
  return <span className="inline-flex gap-1 items-center">{dot(c.bank, 'Banco')}{dot(c.erp, 'ERP')}{dot(c.debt, 'Deuda')}</span>
}
export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone | 'accent' }) {
  const m: Record<string, string> = { neutral: 'bg-bg text-ink-2 border-line', good: 'bg-good-soft text-good border-good/20', bad: 'bg-bad-soft text-bad border-bad/20', warn: 'bg-warn-soft text-warn border-warn/20', accent: 'bg-accent-soft text-accent border-accent/20' }
  return <span className={`inline-block text-[11px] px-2 py-0.5 rounded border ${m[tone]}`}>{children}</span>
}
