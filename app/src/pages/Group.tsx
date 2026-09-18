import { Link, useNavigate, useParams } from 'react-router-dom'
import { getGroup } from '../data'
import { companyName, dateEs, money, pts } from '../format'
import { Card, CoverageDots, Empty, H, ScoreChip, Sparkline, StatTile } from '../components/ui'

export default function Group() {
  const { gid = '' } = useParams()
  const nav = useNavigate()
  const { data: g } = getGroup(gid)
  if (!g) return <Empty text="Grupo no disponible" />
  const c = g.consolidated
  const worse = [...g.companies].sort((a, b) => a.delta_3m - b.delta_3m).filter(x => x.delta_3m < 0).slice(0, 3)
  const better = [...g.companies].sort((a, b) => b.delta_3m - a.delta_3m).filter(x => x.delta_3m > 0).slice(0, 3)
  const to = (id: string) => `/g/${gid}/c/${id}`
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-3">
        <StatTile label="Saldo bancario consolidado" value={money(c.bank_cash)} caption="Lo que ve el banco" />
        <StatTile label="Caja Real consolidada" value={money(c.caja_real)} tone={c.caja_real >= 0 ? 'good' : 'bad'} caption="Saldo menos compromisos a 30 días, pignorado y atrapado en otra entidad" />
        <StatTile label="Agujero en filiales" value={money(g.short_total)} tone="bad" caption="Suma de las entidades en negativo" />
        <StatTile label="Filiales en corto" value={<>{g.short_count} <span className="text-ink-3 text-[16px]">de {g.companies.length}</span></>} tone={g.short_count ? 'warn' : 'good'} caption="El dinero existe, pero no donde hay que pagar" />
      </div>
      <div className="grid grid-cols-[1fr_300px] gap-5">
        <Card className="overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-bg text-[11px] uppercase tracking-wider text-ink-3"><tr>
              <th className="text-left px-4 py-2 font-medium">Empresa</th><th className="text-left px-2 py-2 font-medium">Score</th><th className="text-left px-2 py-2 font-medium">Tendencia 6m</th>
              <th className="text-right px-2 py-2 font-medium">Caja Real</th><th className="text-right px-2 py-2 font-medium">Saldo banco</th><th className="text-left px-2 py-2 font-medium">Primer déficit</th><th className="text-left px-4 py-2 font-medium">Cobertura</th>
            </tr></thead>
            <tbody>{g.companies.map(r => (
              <tr key={r.company_id} onClick={() => nav(to(r.company_id))} className="border-t border-line hover:bg-accent-soft/40 cursor-pointer">
                <td className="px-4 py-2 font-medium">{companyName(r.company_id)}{r.currency !== 'EUR' && <span className="ml-2 text-[10px] font-mono text-ink-3 border border-line rounded px-1">{r.currency}</span>}</td>
                <td className="px-2 py-2"><ScoreChip value={r.score} band={r.band} hollow={!r.coverage.erp} /></td>
                <td className="px-2 py-2"><Sparkline points={r.trend_6m} /></td>
                <td className={`px-2 py-2 text-right num font-medium ${r.caja_real < 0 ? 'text-bad' : ''}`}>{money(r.caja_real)}</td>
                <td className="px-2 py-2 text-right num text-ink-2">{money(r.bank_cash)}</td>
                <td className={`px-2 py-2 num ${r.first_shortfall_date ? 'text-bad' : 'text-ink-3'}`}>{dateEs(r.first_shortfall_date)}</td>
                <td className="px-4 py-2"><CoverageDots c={r.coverage} /></td>
              </tr>))}</tbody>
          </table>
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="p-4"><H sub="Cambio de score en 3 meses">Quién gira</H>
            <div className="text-[11px] uppercase tracking-wider text-bad mb-1">Empeorando</div>
            {worse.length === 0 ? <div className="text-[12px] text-ink-3">Ninguna</div> : worse.map(r => <Row key={r.company_id} r={r} href={to(r.company_id)} />)}
            <div className="text-[11px] uppercase tracking-wider text-good mt-3 mb-1">Mejorando</div>
            {better.length === 0 ? <div className="text-[12px] text-ink-3">Ninguna</div> : better.map(r => <Row key={r.company_id} r={r} href={to(r.company_id)} />)}
          </Card>
        </div>
      </div>
    </div>
  )
}
function Row({ r, href }: { r: { company_id: string; score: number; band: 'sana' | 'vigilar' | 'riesgo' | 'critica'; delta_3m: number }; href: string }) {
  return <Link to={href} className="flex items-center justify-between py-1 text-[13px] hover:text-accent"><span>{companyName(r.company_id)}</span><span className="flex items-center gap-2"><ScoreChip value={r.score} band={r.band} /><span className={`num text-[12px] ${r.delta_3m < 0 ? 'text-bad' : 'text-good'}`}>{pts(r.delta_3m)}</span></span></Link>
}
