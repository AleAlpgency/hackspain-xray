import { Link, useNavigate, useParams } from 'react-router-dom'
import { getCompany } from '../data'
import { companyName, dateEs, money } from '../format'
import { Card, Empty, H, Pill } from '../components/ui'
import { PlanCardView } from '../components/PlanCard'

export default function Plan() {
  const { gid = '', id = '', goalId = '' } = useParams()
  const nav = useNavigate()
  const { data: c } = getCompany(id)
  if (!c) return <Empty text="Empresa no disponible" />
  const g = c.goals.find(x => x.goal_id === goalId) ?? c.goals[0]
  if (!g || !c.cash_path) return <Empty text="Sin objetivos del modelo" />
  const base = c.cash_path
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3"><Link to={`/g/${gid}/c/${id}/caja`} className="text-ink-3 hover:text-ink text-[13px]">← {companyName(id)}</Link><span className="text-[18px] font-semibold">Objetivo y planes</span>
        {c.goals.length > 1 && <select className="ml-auto border border-line rounded px-2 py-1 text-[13px]" value={g.goal_id} onChange={e => nav(`/g/${gid}/c/${id}/plan/${e.target.value}`)}>{c.goals.map(x => <option key={x.goal_id} value={x.goal_id}>{x.label_es}</option>)}</select>}</div>
      <Card className="p-4 border-l-4 border-l-accent"><H sub={`Hasta el ${dateEs(g.deadline)}`}>Objetivo: {g.label_es}</H>
        <div className="flex gap-2 flex-wrap">{g.constraints.map(k => <Pill key={k.metric} tone="accent">{k.label_es}</Pill>)}<Pill>Caja ≥ {money(g.target)} todo el periodo</Pill></div></Card>
      <div className="grid grid-cols-4 gap-3 items-stretch">
        <Card className="p-4 bg-bg/60 flex flex-col gap-3"><div className="font-semibold text-[14px]">Base <span className="text-ink-3 font-normal">sin cambios</span></div>
          <div className="text-[12px]"><div className="text-[11px] uppercase tracking-wider text-ink-3">Caja mínima</div><div className={`num font-semibold ${base.min_cash.cash < 0 ? 'text-bad' : ''}`}>{money(base.min_cash.cash)}</div><div className="text-ink-3">el {dateEs(base.min_cash.date)}</div></div>
          <div className="text-[12px]"><div className="text-[11px] uppercase tracking-wider text-ink-3">Primer déficit</div><div className={base.first_shortfall ? 'text-bad' : 'text-good'}>{base.first_shortfall ? dateEs(base.first_shortfall.date) : 'Ninguno'}</div></div>
          <div className="text-[12px] mt-auto text-ink-3">Punto de comparación de los tres planes.</div></Card>
        {g.plans.map(p => <PlanCardView key={p.plan_id} p={p} />)}
      </div>
      {g.remaining_gap
        ? <div className="bg-warn-soft border-l-4 border-warn rounded p-4 text-[13px]"><span className="font-semibold">Ningún plan probado cumple.</span> Hueco restante: <span className="num font-semibold">{money(g.remaining_gap.amount)}</span> el {dateEs(g.remaining_gap.date)}. Combinar dos planes o revisar el objetivo.</div>
        : <div className="bg-good-soft border-l-4 border-good rounded p-4 text-[13px]">Al menos un plan cumple el objetivo respetando todas las restricciones.</div>}
      <div className="text-[12px] text-ink-3">Los planes son combinaciones acotadas calculadas fuera de línea. El planificador compara, no busca. Los cambios son supuestos condicionales, no efectos garantizados.</div>
    </div>
  )
}
