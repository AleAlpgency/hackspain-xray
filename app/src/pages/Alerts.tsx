import { Link, useParams } from 'react-router-dom'
import { getGroup } from '../data'
import { companyName, monthEs, pct } from '../format'
import { Card, Empty, H, Pill } from '../components/ui'
import type { LeadStats } from '../types'

const TYPE: Record<string, { tone: 'bad' | 'warn' | 'good' | 'accent'; label: string }> = {
  deterioro: { tone: 'bad', label: 'Deterioro persistente' }, recuperacion: { tone: 'good', label: 'Recuperación' },
  caja_real_negativa: { tone: 'warn', label: 'Caja Real negativa' }, deficit_30d: { tone: 'warn', label: 'Déficit previsto a 30 días' },
}
export default function Alerts() {
  const { gid = '' } = useParams()
  const { data: g } = getGroup(gid)
  if (!g) return <Empty text="Grupo no disponible" />
  const order = { P0: 0, P1: 1, info: 2 }
  const alerts = [...g.alerts].sort((a, b) => order[a.severity] - order[b.severity] || b.raised_month.localeCompare(a.raised_month))
  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4"><H sub="Evento = 2 de 3 condiciones durante 2 meses consecutivos frente a la media propia. Un mes malo nunca dispara. Medido sobre las 1.286 empresas.">Anticipación medida</H>
        <table className="w-full text-[13px]"><thead className="text-[11px] uppercase tracking-wider text-ink-3"><tr><th className="text-left py-1 font-medium">Detector</th><th className="text-right font-medium">Adelanto mediano</th><th className="text-right font-medium">≥ 1 mes</th><th className="text-right font-medium">≥ 3 meses</th><th className="text-right font-medium">No vistas</th><th className="text-right font-medium">Falsas alarmas</th></tr></thead>
          <tbody><LeadRow name="Solo saldo bancario" s={g.anticipation.reference} muted /><LeadRow name="Caja Real score" s={g.anticipation.ours} /></tbody></table>
        <div className="text-[12px] text-ink-3 mt-2">Cualquiera con un extracto bancario tiene la primera fila. La segunda es la que hay que defender.</div></Card>
      <Card className="overflow-hidden"><div className="px-4 pt-4"><H sub={alerts.length ? `${alerts.length} avisos · última evaluación ${monthEs(g.assessment_date.slice(0, 7))}` : ''}>Bandeja</H></div>
        {alerts.length === 0 ? <div className="px-4 pb-4 text-ink-3 text-[13px]">Sin alertas nuevas. Última evaluación {monthEs(g.assessment_date.slice(0, 7))}.</div> : (
          <table className="w-full text-[13px]"><tbody>{alerts.map(a => { const t = TYPE[a.type]; return (
            <tr key={a.alert_id} className="border-t border-line hover:bg-accent-soft/40">
              <td className="px-4 py-2 w-3"><span className={`inline-block w-2 h-2 rounded-full ${a.severity === 'P0' ? 'bg-bad' : a.severity === 'P1' ? 'bg-warn' : 'bg-good'}`} /></td>
              <td className="py-2 font-medium"><Link to={`/g/${gid}/c/${a.company_id}`} className="hover:text-accent">{companyName(a.company_id)}</Link></td>
              <td className="py-2"><Pill tone={t.tone}>{t.label}</Pill></td>
              <td className="py-2 text-ink-2">{a.persistence_months} {a.persistence_months === 1 ? 'mes' : 'meses consecutivos'}</td>
              <td className="py-2 num text-ink-2">{a.score_from !== null && a.score_to !== null ? `${Math.round(a.score_from)} → ${Math.round(a.score_to)}` : ''}</td>
              <td className="py-2 num text-ink-3">{monthEs(a.raised_month)}</td>
              <td className="px-4 py-2 num text-right">{a.lead_months !== null ? <span className={a.lead_months > 0 ? 'text-good' : 'text-ink-3'}>{a.lead_months > 0 ? `${a.lead_months} ${a.lead_months === 1 ? 'mes antes' : 'meses antes'}` : 'a la vez'}</span> : ''}</td>
            </tr>) })}</tbody></table>)}
      </Card>
    </div>
  )
}
function LeadRow({ name, s, muted }: { name: string; s: LeadStats | null; muted?: boolean }) {
  const cls = `text-right num py-1.5 ${muted ? 'text-ink-3' : 'font-medium'}`
  if (!s) return <tr className="border-t border-line"><td className="py-1.5">{name}</td><td colSpan={5} className="text-right text-ink-3 py-1.5">pendiente del modelo</td></tr>
  return <tr className="border-t border-line"><td className={`py-1.5 ${muted ? 'text-ink-3' : 'font-medium'}`}>{name}</td><td className={cls}>{s.median_lead_months === null ? '—' : `${s.median_lead_months.toLocaleString('es-ES')} meses`}</td><td className={cls}>{pct(s.caught_1m_pct)}</td><td className={cls}>{pct(s.caught_3m_pct)}</td><td className={cls}>{pct(s.missed_pct)}</td><td className={cls}>{s.false_alarms} / {s.n_clean}</td></tr>
}
