import { Link, useParams } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getCompany } from '../data'
import { companyName, dateEs, money, monthEs, pct, pts } from '../format'
import { Card, Empty, H, Pill, ScoreChip, Sparkline, bandLabel } from '../components/ui'
import { DriverList } from '../components/Drivers'

const ALL = Array.from({ length: 24 }, (_, i) => { const m = 9 + i; return `${2024 + Math.floor((m - 1) / 12)}-${String(((m - 1) % 12) + 1).padStart(2, '0')}` })
const FLOW_LABEL: Record<string, string> = { cobros_operativos: 'Cobros operativos', pagos_operativos: 'Pagos operativos', financiacion: 'Financiación', inversion: 'Inversión', flujo_neto: 'Flujo neto', bank: 'Saldo banco', committed: 'Comprometido', pledged: 'Pignorado', caja: 'Caja Real' }

export default function Company() {
  const { gid = '', id = '' } = useParams()
  const { data: c } = getCompany(id)
  if (!c) return <Empty text="Empresa no disponible" />
  const byM = Object.fromEntries(c.score_series.map(s => [s.month, s]))
  const cajaBy = Object.fromEntries(c.caja_real_series.map(s => [s.month, s]))
  const flBy = Object.fromEntries(c.flujos.map(f => [f.month, f]))
  const rows = ALL.map(m => ({
    m, label: monthEs(m), score: byM[m]?.score ?? null,
    ...(cajaBy[m] ? { bank: cajaBy[m].bank_cash, committed: -cajaBy[m].committed, pledged: -cajaBy[m].pledged, caja: cajaBy[m].caja_real } : {}),
    ...(flBy[m] ? { cobros_operativos: flBy[m].cobros_operativos, pagos_operativos: flBy[m].pagos_operativos, financiacion: flBy[m].financiacion, inversion: flBy[m].inversion, flujo_neto: flBy[m].flujo_neto } : {}),
  }))
  const censored = c.last_data_month < ALL[ALL.length - 1]
  const firstNeg = c.caja_real_series.findIndex(s => s.caja_real < 0)
  const cross = firstNeg > 0 ? c.caja_real_series[firstNeg] : null
  const startsNeg = firstNeg === 0
  const base = c.score.baseline_12m
  const ev = c.evidencia.resumen
  const cob = c.cobro[c.cobro.length - 1]
  const deu = c.deuda.serie[c.deuda.serie.length - 1]
  const perfil = c.deuda.perfil
  const tip = (v: unknown, n: unknown) => [money(Number(v), false), FLOW_LABEL[String(n)] ?? String(n)] as [string, string]
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <ScoreChip value={c.score.value} band={c.score.band} size="lg" hollow={!ev.publicable} />
        <div>
          <div className="text-[18px] font-semibold">{companyName(c.company_id)} <span className="text-ink-3 font-normal text-[13px]">{bandLabel[c.score.band]}</span>{!ev.publicable && <Pill tone="bad">Score no publicable</Pill>}</div>
          <div className="text-[13px] text-ink-2"><span className={`num font-medium ${c.score.delta_3m < 0 ? 'text-bad' : 'text-good'}`}>{pts(c.score.delta_3m)}</span> en 3 meses · media propia {Math.round(base)} <span className="text-ink-3">(12 m)</span></div>
        </div>
        <div className="ml-auto flex gap-2 items-center">
          <Pill tone={ev.cobertura.banco ? 'accent' : 'neutral'}>Banco</Pill><Pill tone={ev.cobertura.erp ? 'accent' : 'neutral'}>ERP</Pill><Pill tone={ev.cobertura.deuda ? 'accent' : 'neutral'}>Deuda</Pill>
          <Link to={`/g/${gid}/c/${id}/caja`} className="ml-2 bg-accent text-white text-[13px] font-medium px-3 py-1.5 rounded">Ver camino de caja →</Link>
        </div>
      </div>
      {!ev.publicable && <div className="bg-bad-soft border-l-4 border-bad rounded p-3 text-[13px]"><span className="font-semibold">Este score no se publica.</span> {ev.motivos.join('. ')}. Se muestra solo como orientación interna.</div>}

      <div className="grid grid-cols-[3fr_2fr] gap-5">
        <div className="flex flex-col gap-4">
          <Card className="p-4"><H sub={censored ? `Sin datos desde ${monthEs(c.last_data_month)}. Se dibuja como ausencia, no como caída.` : 'Frente a su propia media de 12 meses'}>Trayectoria del score</H>
            <div className="h-44"><ResponsiveContainer><LineChart data={rows} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="label" interval={2} tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip formatter={v => [Math.round(Number(v)), 'Score']} />
              <ReferenceArea y1={base - 5} y2={base + 5} fill="var(--color-accent)" fillOpacity={0.07} />
              {c.event && <ReferenceLine x={monthEs(c.event.onset_month)} stroke="var(--color-bad)" strokeDasharray="3 3" label={{ value: 'Estrés observado', position: 'insideTopRight', fontSize: 11, fill: 'var(--color-bad)' }} />}
              <Line type="monotone" dataKey="score" stroke="var(--color-ink)" strokeWidth={2} dot={false} connectNulls={false} />
            </LineChart></ResponsiveContainer></div>
          </Card>
          <Card className="p-4"><H sub="Cobros y pagos operativos, financiación e inversión. Transferencias internas y movimientos sin categoría quedan fuera del neto.">Flujos mensuales</H>
            <div className="h-48"><ResponsiveContainer><ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} stackOffset="sign">
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="label" interval={2} tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={v => money(v)} width={72} />
              <Tooltip formatter={tip} />
              <ReferenceLine y={0} stroke="var(--color-ink)" />
              <Bar dataKey="cobros_operativos" stackId="f" fill="var(--color-good)" fillOpacity={0.75} />
              <Bar dataKey="pagos_operativos" stackId="f" fill="var(--color-bad)" fillOpacity={0.6} />
              <Bar dataKey="financiacion" stackId="f" fill="#6b4fa0" fillOpacity={0.7} />
              <Bar dataKey="inversion" stackId="f" fill="var(--color-ink-3)" fillOpacity={0.6} />
              <Line type="monotone" dataKey="flujo_neto" stroke="var(--color-ink)" strokeWidth={2} dot={false} />
            </ComposedChart></ResponsiveContainer></div>
          </Card>
          <Card className="p-4"><H sub={`${cross ? `Cruza a negativo en ${monthEs(cross.month)} mientras el saldo bancario sigue positivo. ` : startsNeg ? `En negativo desde ${monthEs(c.caja_real_series[0].month)}. ` : ''}Nivel anclado al saldo del ${dateEs(c.assessment_date)} (reconstruido); la forma viene de los flujos.`}>Caja Real mensual</H>
            <div className="h-48"><ResponsiveContainer><ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} stackOffset="sign">
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="label" interval={2} tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={v => money(v)} width={72} />
              <Tooltip formatter={tip} />
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

          <Card className={`p-4 ${ev.publicable ? '' : 'border-bad'}`}><H sub="Decide si el score se publica">Evidencia</H>
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              <Kv k="Meses de historia" v={`${ev.meses_historia}`} tone={ev.meses_historia >= 12 ? 'good' : 'bad'} />
              <Kv k="Sin categorizar" v={pct(Math.round(ev.pct_sin_categorizar * 100))} tone={ev.pct_sin_categorizar > 0.6 ? 'bad' : ev.pct_sin_categorizar > 0.3 ? 'warn' : 'good'} />
              <Kv k="Publicable" v={ev.publicable ? 'Sí' : 'No'} tone={ev.publicable ? 'good' : 'bad'} />
            </div>
            <div className="flex gap-2 mt-3 text-[12px]">
              <Src ok={ev.cobertura.banco} t="Banco" /><Src ok={ev.cobertura.erp} t="ERP" /><Src ok={ev.cobertura.deuda} t="Deuda" />
            </div>
            {ev.motivos.length > 0 && <ul className="mt-2 text-[12px] text-bad list-disc pl-4">{ev.motivos.map(m => <li key={m}>{m}</li>)}</ul>}
            {!ev.cobertura.erp && <div className="text-[12px] text-ink-2 mt-2">ERP no conectado, cobertura parcial. No penaliza el score.</div>}
          </Card>

          <Card className="p-4"><H sub="Cartera reconstruida a cierre de cada mes, desde facturas">Cobro</H>
            {!cob || cob.cartera_abierta === 0 && cob.dso_real === null ? <div className="text-[12px] text-ink-3">Sin facturas de cliente en el periodo.</div> : (
              <div className="flex flex-col gap-3 text-[12px]">
                <div className="grid grid-cols-3 gap-2">
                  <Kv k="DSO real" v={cob.dso_real !== null ? `${Math.round(cob.dso_real)} días` : '—'} extra={<Sparkline points={c.cobro.slice(-6).map(x => x.dso_real ?? 0)} w={56} h={16} />} />
                  <Kv k="Vencido" v={cob.pct_vencido !== null ? pct(Math.round(cob.pct_vencido * 100)) : '—'} tone={cob.pct_vencido !== null && cob.pct_vencido > 0.3 ? 'bad' : 'neutral'} />
                  <Kv k="Top 3 clientes" v={cob.top3_pct !== null ? pct(cob.top3_pct) : '—'} tone={cob.top3_pct !== null && cob.top3_pct > 60 ? 'warn' : 'neutral'} extra={<span className="text-ink-3">{cob.n_clientes} clientes · 12 m</span>} />
                </div>
                <Aging a={cob.aging} total={cob.cartera_abierta} />
              </div>)}
          </Card>

          <Card className="p-4"><H sub="Servicio observado en banco y perfil estático">Deuda</H>
            {perfil.n_productos === 0 ? <div className="text-[12px] text-ink-3">Sin productos de deuda conectados.</div> : (
              <div className="grid grid-cols-3 gap-2 text-[12px]">
                <Kv k="Cobertura del servicio" v={deu?.cobertura !== null && deu?.cobertura !== undefined ? `${deu.cobertura.toLocaleString('es-ES')}×` : '—'} tone={deu?.cobertura !== null && deu?.cobertura !== undefined && deu.cobertura < 1 ? 'bad' : 'neutral'} extra={<span className="text-ink-3">flujo operativo / cuotas</span>} />
                <Kv k="Utilización" v={perfil.utilizacion !== null ? pct(Math.round(perfil.utilizacion * 100)) : '—'} tone={perfil.utilizacion !== null && perfil.utilizacion > 0.9 ? 'bad' : 'neutral'} extra={<span className="text-ink-3">{money(perfil.dispuesto)} de {money(perfil.concedido)}</span>} />
                <Kv k="Próxima cuota" v={dateEs(perfil.proxima_cuota)} extra={<span className="text-ink-3">{perfil.n_productos} productos</span>} />
                <div className="col-span-3 flex gap-1 flex-wrap">{Object.entries(perfil.tipos).map(([t, n]) => <Pill key={t}>{t} × {n}</Pill>)}</div>
              </div>)}
          </Card>
        </div>
      </div>
    </div>
  )
}

function Kv({ k, v, tone = 'neutral', extra }: { k: string; v: string; tone?: 'neutral' | 'good' | 'bad' | 'warn'; extra?: React.ReactNode }) {
  const t = { neutral: 'text-ink', good: 'text-good', bad: 'text-bad', warn: 'text-warn' }[tone]
  return <div><div className="text-[11px] uppercase tracking-wider text-ink-3">{k}</div><div className={`num text-[16px] font-semibold ${t}`}>{v}</div>{extra && <div className="mt-0.5">{extra}</div>}</div>
}
function Src({ ok, t }: { ok: boolean; t: string }) {
  return <span className={`flex items-center gap-1.5 px-2 py-1 rounded border ${ok ? 'border-line' : 'border-dashed border-line bg-bg/60 text-ink-3'}`}><span className={`w-2 h-2 rounded-full ${ok ? 'bg-accent' : 'bg-line'}`} />{t}</span>
}
function Aging({ a, total }: { a: { corriente: number; d1_30: number; d31_90: number; d90p: number }; total: number }) {
  if (total <= 0) return null
  const seg = [['Corriente', a.corriente, 'bg-accent'], ['1 a 30', a.d1_30, 'bg-warn'], ['31 a 90', a.d31_90, 'bg-bad/70'], ['+90', a.d90p, 'bg-bad']] as const
  return (
    <div><div className="text-[11px] uppercase tracking-wider text-ink-3 mb-1">Antigüedad de la cartera · {money(total)}</div>
      <div className="h-2 flex rounded overflow-hidden bg-bg">{seg.map(([l, v, cls]) => v > 0 && <div key={l} className={cls} style={{ width: `${(v / total) * 100}%` }} title={`${l}: ${money(v)}`} />)}</div>
      <div className="flex gap-3 mt-1 text-[11px] text-ink-3">{seg.map(([l, v]) => <span key={l}>{l} <span className="num text-ink-2">{Math.round((v / total) * 100)} %</span></span>)}</div></div>
  )
}
