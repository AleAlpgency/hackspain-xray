import { Link, useParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getCompany } from '../data'
import { companyName, dateEs, money } from '../format'
import { Card, Empty, H, Pill, StatTile } from '../components/ui'

export default function CashPath() {
  const { gid = '', id = '' } = useParams()
  const { data: c } = getCompany(id)
  if (!c) return <Empty text="Empresa no disponible" />
  const p = c.cash_path
  if (!p) return <div className="flex flex-col gap-4"><Head gid={gid} id={id} name={companyName(id)} /><Empty text="Sin camino de caja del modelo" /></div>
  const sw = p.points.findIndex(x => x.kind === 'behavioural')
  const rows = p.points.map((x, i) => ({ d: dateEs(x.date).slice(0, 5), c: i <= sw || sw < 0 ? x.cash : null, b: i >= sw && sw >= 0 ? x.cash : null }))
  const minY = Math.min(0, ...p.points.map(x => x.cash))
  return (
    <div className="flex flex-col gap-5">
      <Head gid={gid} id={id} name={companyName(id)} goal={c.goals[0]?.goal_id} />
      <div className="grid grid-cols-4 gap-3">
        <StatTile label="Caja hoy" value={money(p.points[0].cash)} caption={`a ${dateEs(c.assessment_date)}`} />
        <StatTile label="Mínimo previsto" value={money(p.min_cash.cash)} tone={p.min_cash.cash < 0 ? 'bad' : p.min_cash.cash < p.buffer ? 'warn' : 'good'} caption={`el ${dateEs(p.min_cash.date)}`} />
        <StatTile label="Primer déficit" value={p.first_shortfall ? dateEs(p.first_shortfall.date) : 'Ninguno'} tone={p.first_shortfall ? 'bad' : 'good'} caption={p.first_shortfall ? `${money(p.first_shortfall.amount)} por debajo de cero` : 'en 90 días'} />
        <StatTile label="Necesidad de financiación" value={p.funding_gap ? money(p.funding_gap.amount) : '0 €'} tone={p.funding_gap ? 'warn' : 'good'} caption={`sobre un colchón de ${money(p.buffer)}`} />
      </div>
      <div className="grid grid-cols-[3fr_1fr] gap-5">
        <div className="flex flex-col gap-4">
          <Card className="p-4"><H sub="Línea continua: compromisos con fecha (facturas, nóminas, impuestos, cuotas). Discontinua: cobros al plazo histórico.">Camino de caja, 90 días</H>
            <div className="h-64"><ResponsiveContainer><LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="d" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={v => money(v)} width={72} domain={[minY, 'auto']} />
              <Tooltip formatter={v => [money(Number(v), false), 'Caja']} />
              <ReferenceArea y1={minY} y2={0} fill="var(--color-bad)" fillOpacity={0.06} />
              <ReferenceLine y={0} stroke="var(--color-ink)" />
              <ReferenceLine y={p.buffer} stroke="var(--color-accent)" strokeDasharray="2 4" label={{ value: 'Colchón', position: 'insideTopLeft', fontSize: 11, fill: 'var(--color-accent)' }} />
              {p.first_shortfall && <ReferenceLine x={dateEs(p.first_shortfall.date).slice(0, 5)} stroke="var(--color-bad)" strokeDasharray="3 3" label={{ value: 'Primer déficit', position: 'insideTopRight', fontSize: 11, fill: 'var(--color-bad)' }} />}
              <Line type="monotone" dataKey="c" stroke="var(--color-ink)" strokeWidth={2.5} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="b" stroke="var(--color-ink)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />
            </LineChart></ResponsiveContainer></div>
          </Card>
          <div className="grid grid-cols-3 gap-3">{p.checkpoints.map(k => (
            <Card key={k.day} className="px-4 py-3"><div className="text-[11px] uppercase tracking-wider text-ink-3">{k.day} días</div>
              <div className={`text-[20px] font-semibold num ${k.cash < 0 ? 'text-bad' : k.cash < p.buffer ? 'text-warn' : 'text-good'}`}>{money(k.cash)}</div>
              <div className="text-[12px] text-ink-2 num">{money(k.committed_due)} comprometidos hasta entonces</div></Card>))}</div>
        </div>
        <Card className="p-4"><H sub="Cada supuesto con su origen">Supuestos</H>
          <div className="flex flex-col gap-3">{p.assumptions.map(a => (
            <div key={a.key}><div className="text-[12px] text-ink-2">{a.label_es} <span className="text-ink-3">· {a.period}</span></div>
              <div className="flex items-center gap-2 mt-0.5"><input readOnly value={`${a.value.toLocaleString('es-ES')} ${a.unit}`} className="num text-[13px] border border-line rounded px-2 py-1 w-full bg-bg/50" /><Pill tone={a.source === 'historical' ? 'accent' : 'warn'}>{a.source === 'historical' ? 'histórico' : 'introducido'}</Pill></div></div>))}</div>
          {!c.coverage.erp.ok && <div className="mt-4 text-[12px] text-warn bg-warn-soft rounded p-2">Sin facturas: compromisos de proveedores no visibles. Solo nóminas, impuestos y deuda.</div>}
        </Card>
      </div>
    </div>
  )
}
function Head({ gid, id, name, goal }: { gid: string; id: string; name: string; goal?: string }) {
  return <div className="flex items-center gap-3"><Link to={`/g/${gid}/c/${id}`} className="text-ink-3 hover:text-ink text-[13px]">← {name}</Link><span className="text-[18px] font-semibold">Camino de caja</span>
    {goal && <Link to={`/g/${gid}/c/${id}/plan/${goal}`} className="ml-auto bg-accent text-white text-[13px] font-medium px-3 py-1.5 rounded">Fijar objetivo →</Link>}</div>
}
