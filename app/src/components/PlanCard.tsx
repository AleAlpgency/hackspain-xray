import type { PlanCard as P } from '../types'
import { dateEs, money, pct } from '../format'
import { Link } from 'react-router-dom'
import { Card, Pill } from './ui'
import { companyName } from '../format'

export function PlanCardView({ p, gid }: { p: P; gid: string }) {
  const border = p.qualifies ? 'border-good' : 'border-warn'
  return (
    <Card className={`p-4 flex flex-col gap-3 border-2 ${border}`}>
      <div className="flex justify-between items-start gap-2"><div className="font-semibold text-[14px]">{p.title_es}</div><Pill tone={p.qualifies ? 'good' : 'warn'}>{p.qualifies ? 'Cumple' : 'No alcanza'}</Pill></div>
      <ul className="text-[12px] text-ink-2 space-y-0.5">{p.changes.map(c => <li key={c.driver}>{c.label_es}: <span className="num">{c.from.toLocaleString('es-ES')} → {c.to.toLocaleString('es-ES')} {c.unit}</span></li>)}</ul>
      {p.source_company_id && <div className="text-[12px]"><span className="text-ink-3">Origen: </span><Link to={`/g/${gid}/c/${p.source_company_id}`} className="text-accent hover:underline">{companyName(p.source_company_id)}</Link></div>}
      <div>
        <div className="flex justify-between text-[11px] uppercase tracking-wider text-ink-3"><span>Alcance del objetivo</span><span className="num">{pct(p.attainment.pct)}</span></div>
        <div className="h-1.5 bg-bg rounded mt-1 overflow-hidden"><div className={`h-full ${p.attainment.met ? 'bg-good' : 'bg-warn'}`} style={{ width: `${Math.min(100, p.attainment.pct)}%` }} /></div>
      </div>
      <div className="text-[12px]">
        <div className="text-[11px] uppercase tracking-wider text-ink-3">Caja mínima</div>
        <div className="num"><span className={`font-semibold ${p.cash_impact.min_cash < 0 ? 'text-bad' : ''}`}>{money(p.cash_impact.min_cash)}</span> <span className="text-ink-3">el {dateEs(p.cash_impact.min_cash_date)}</span> · <span className={p.cash_impact.delta_vs_base >= 0 ? 'text-good' : 'text-bad'}>{p.cash_impact.delta_vs_base >= 0 ? '+' : ''}{money(p.cash_impact.delta_vs_base)} vs base</span></div>
      </div>
      {p.trade_offs.length > 0 && <div className="text-[12px]"><div className="text-[11px] uppercase tracking-wider text-ink-3">Contrapartidas</div><ul className="text-ink-2">{p.trade_offs.map(t => <li key={t.metric}>{t.label_es}: <span className="num">+{t.delta.toLocaleString('es-ES')} {t.unit}</span></li>)}</ul></div>}
      <div className="text-[12px] mt-auto">
        <div className="text-[11px] uppercase tracking-wider text-ink-3">Restricciones incumplidas</div>
        {p.unmet_constraints.length === 0 ? <div className="text-ink-3">Ninguna</div>
          : <ul className="text-bad space-y-0.5">{p.unmet_constraints.map((u, i) => <li key={i}>{u.constraint_label_es} <span className="text-ink-3">· incumplida el {dateEs(u.breach_date)}</span></li>)}</ul>}
      </div>
      {p.nota_es && <div className="text-[11px] text-ink-3 border-t border-line pt-2">{p.nota_es}</div>}
    </Card>
  )
}
