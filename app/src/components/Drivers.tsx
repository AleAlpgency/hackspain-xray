import { useState } from 'react'
import type { Driver } from '../types'
import { monthEs, pts } from '../format'
import { Card, Pill } from './ui'

const UNIT: Record<Driver['unit'], (v: number) => string> = {
  days: v => `${Math.round(v)} días`, eur: v => `${Math.round(v).toLocaleString('es-ES')} €`,
  ratio: v => `${(v * 100).toFixed(1)} %`, months: v => `${v.toFixed(1)} meses`,
}
function describe(d: Driver) {
  if (d.value === null || d.baseline === null) return 'Sin evidencia. No penaliza el score.'
  const f = UNIT[d.unit]
  return `Ahora ${f(d.value)}, su media ${f(d.baseline)}`
}

export function DriverList({ drivers, baseline, score }: { drivers: Driver[]; baseline: number; score: number }) {
  const [open, setOpen] = useState<Driver | null>(null)
  const max = Math.max(1, ...drivers.map(d => Math.abs(d.contribution_pts)))
  const sum = drivers.reduce((a, d) => a + d.contribution_pts, 0)
  return (
    <div className="flex flex-col gap-2">
      {drivers.map(d => {
        const neg = d.contribution_pts < 0, w = (Math.abs(d.contribution_pts) / max) * 100
        return (
          <button key={d.key} onClick={() => setOpen(d)} className="text-left group">
            <div className="flex justify-between text-[13px]"><span className="font-medium group-hover:text-accent">{d.label_es}</span><span className={`num ${neg ? 'text-bad' : 'text-good'}`}>{pts(d.contribution_pts)}</span></div>
            <div className="h-1.5 bg-bg rounded mt-1 relative overflow-hidden">
              <div className={`absolute top-0 h-full ${neg ? 'right-1/2 bg-bad' : 'left-1/2 bg-good'}`} style={{ width: `${w / 2}%` }} />
            </div>
            <div className="text-[12px] text-ink-3 mt-0.5">{describe(d)}</div>
          </button>
        )
      })}
      <div className="text-[12px] text-ink-3 border-t border-line pt-2 num">Suma de causas: {pts(sum)} · resto: {pts(score - baseline - sum)}</div>
      {open && <Drawer d={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Drawer({ d, onClose }: { d: Driver; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/20" />
      <Card className="relative w-[420px] h-full rounded-none overflow-y-auto p-5" >
        <div onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-start"><div><div className="text-[11px] uppercase tracking-wider text-ink-3">Causa</div><div className="font-semibold">{d.label_es}</div></div><button onClick={onClose} className="text-ink-3 hover:text-ink">✕</button></div>
          <div className="mt-3 text-[13px]">{describe(d)} <span className={`num font-medium ${d.contribution_pts < 0 ? 'text-bad' : 'text-good'}`}>({pts(d.contribution_pts)})</span></div>
          <div className="mt-4 text-[11px] uppercase tracking-wider text-ink-3">Meses que lo movieron</div>
          <div className="flex gap-1 mt-1 flex-wrap">{d.months.map(m => <Pill key={m} tone="accent">{monthEs(m)}</Pill>)}</div>
          <div className="mt-4 text-[11px] uppercase tracking-wider text-ink-3">Registros de origen</div>
          {d.evidence.every(e => e.ids.length === 0)
            ? <div className="text-[12px] text-ink-3 mt-1">Sin registros individuales para esta causa.</div>
            : d.evidence.map(e => e.ids.length > 0 && (
              <div key={e.source} className="mt-1">
                <div className="text-[12px] text-ink-2">{e.source === 'invoices' ? 'Facturas' : e.source === 'transactions' ? 'Movimientos bancarios' : 'Productos de deuda'}</div>
                <ul className="font-mono text-[11px] text-ink-2 mt-1 space-y-0.5">{e.ids.map(id => <li key={id} className="truncate">{id}</li>)}</ul>
              </div>))}
          <div className="mt-4 text-[11px] text-ink-3">Solo lectura. Los registros de origen no se modifican.</div>
        </div>
      </Card>
    </div>
  )
}
