import { Link, useParams } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getCompany } from '../data'
import { companyName, dateEs, money, monthEs, pts } from '../format'
import { Card, Empty, H, Pill, ScoreChip, bandLabel } from '../components/ui'
import { DriverList } from '../components/Drivers'

const ALL = Array.from({ length: 24 }, (_, i) => { const m = 9 + i; return `${2024 + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12) + 1).padStart(2, '0')}` })

export default function Company() {
  const { gid = '', id = '' } = useParams()
  const { data: c } = getCompany(id)
  if (!c) return <Empty text="Empresa no disponible" />
  const byM = Object.fromEntries(c.score_series.map(s => [s.month, s]))
  const cajaBy = Object.fromEntries(c.caja_real_series.map(s => [s.month, s]))
  const rows = ALL.map(m => ({ m, label: monthEs(m), score: byM[m]?.score ?? null, ...(cajaBy[m] ? { bank: cajaBy[m].bank_cash, committed: -cajaBy[m].committed, pledged: -cajaBy[m].pledged, caja: cajaBy[m].caja_real } : {}) }))
  const censored = c.last_data_month < ALL[ALL.length - 1]
  const cross = c.caja_real_series.find((s, i) => s.caja_real < 0 && (i === 0 || c.caja_real_series[i - 1].caja_real >= 0))
  const base = c.score.baseline_12m
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <ScoreChip value={c.score.value} band={c.score.band} size="lg" hollow={!c.coverage.erp.ok} />
        <div>
          <div className="text-[18px] font-semibold">{companyName(c.company_id)} <span className="text-ink-3 font-normal text-[13px]">{bandLabel[c.score.band]}</span></div>
          <div className="text-[13px] text-ink-2"><span className={`num font-medium ${c.score.delta_3m < 0 ? 'text-bad' : 'text-good'}`}>{pts(c.score.delta_3m)}</span> en 3 meses · media propia {Math.round(base)} <span className="text-ink-3">(12 m)</span></div>
        </div>
        <div className="ml-auto flex gap-2 items-center">
          <Pill tone={c.coverage.bank.ok ? 'accent' : 'neutral'}>Banco</Pill><Pill tone={c.coverage.erp.ok ? 'accent' : 'neutral'}>ERP</Pill><Pill tone={c.coverage.debt.ok ? 'accent' : 'neutral'}>Deuda</Pill>
          <Link to={`/g/${gid}/c/${id}/caja`} className="ml-2 bg-accent text-white text-[13px] font-medium px-3 py-1.5 rounded">Ver camino de caja →</Link>
        </div>
      </div>
      <div className="grid grid-cols-[3fr_2fr] gap-5">
        <div className="flex flex-col gap-4">
          <Card className="p-4"><H sub={censored ? `Sin datos desde ${monthEs(c.last_data_month)}. Se dibuja como ausencia, no como caída.` : 'Frente a su propia media de 12 meses'}>Trayectoria del score</H>
            <div className="h-52"><ResponsiveContainer><LineChart data={rows} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="label" interval={2} tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number) => [Math.round(v), 'Score']} />
              <ReferenceArea y1={base - 5} y2={base + 5} fill="var(--color-accent)" fillOpacity={0.07} />
              {c.event && <ReferenceLine x={monthEs(c.event.onset_month)} stroke="var(--color-bad)" strokeDasharray="3 3" label={{ value: 'Estrés observado', position: 'insideTopRight', fontSize: 11, fill: 'var(--color-bad)' }} />}
              <Line type="monotone" dataKey="score" stroke="var(--color-ink)" strokeWidth={2} dot={false} connectNulls={false} />
            </LineChart></ResponsiveContainer></div>
          </Card>
          <Card className="p-4"><H sub={cross ? `Cruza a negativo en ${monthEs(cross.month)} mientras el saldo bancario sigue positivo` : 'Saldo bancario menos compromisos y pignorado'}>Caja Real mensual</H>
            <div className="h-56"><ResponsiveContainer><ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} stackOffset="sign">
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="label" interval={2} tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={v => money(v)} width={72} />
              <Tooltip formatter={(v: number, n: string) => [money(v, false), ({ bank: 'Saldo banco', committed: 'Comprometido', pledged: 'Pignorado', caja: 'Caja Real' } as Record<string, string>)[n] ?? n]} />
              <ReferenceLine y={0} stroke="var(--color-ink)" />
              {cross && <ReferenceLine x={monthEs(cross.month)} stroke="var(--color-bad)" strokeDasharray="3 3" />}
              <Bar dataKey="committed" stackId="s" fill="var(--color-warn)" fillOpacity={0.7} />
              <Bar dataKey="pledged" stackId="s" fill="#6b4fa0" fillOpacity={0.7} />
              <Line type="monotone" dataKey="bank" stroke="var(--color-ink-3)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="caja" stroke="var(--color-ink)" strokeWidth={2.5} dot={false} />
            </ComposedChart></ResponsiveContainer></div>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card className="p-4"><H sub="Cada causa frente a la media propia, no frente a otras empresas">Por qué este número</H>
            <DriverList drivers={c.drivers} baseline={base} score={c.score.value} />
          </Card>
          <Card className="p-4"><H>Cobertura de evidencia</H>
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              <Cov ok={c.coverage.bank.ok} title="Banco" lines={[`${c.coverage.bank.n_accounts} cuentas`, `hasta ${c.coverage.bank.last_date ? monthEs(c.coverage.bank.last_date) : '—'}`]} />
              <Cov ok={c.coverage.erp.ok} title="ERP" lines={[`${c.coverage.erp.n_invoices} facturas`, c.coverage.erp.last_date ? `hasta ${monthEs(c.coverage.erp.last_date)}` : 'sin conexión']} />
              <Cov ok={c.coverage.debt.ok} title="Deuda" lines={[`${c.coverage.debt.n_products} productos`, c.coverage.debt.next_instalment_date ? `cuota ${dateEs(c.coverage.debt.next_instalment_date)}` : 'sin calendario']} />
            </div>
            {!c.coverage.erp.ok && <div className="text-[12px] text-ink-2 mt-2">ERP no conectado, cobertura parcial. No penaliza el score.</div>}
          </Card>
        </div>
      </div>
    </div>
  )
}
function Cov({ ok, title, lines }: { ok: boolean; title: string; lines: string[] }) {
  return <div className={`rounded border p-2 ${ok ? 'border-line' : 'border-dashed border-line bg-bg/60'}`}><div className="flex justify-between"><span className="font-medium">{title}</span><span className={`w-2 h-2 rounded-full mt-1.5 ${ok ? 'bg-accent' : 'bg-line'}`} /></div>{lines.map(l => <div key={l} className="text-ink-3">{l}</div>)}</div>
}
