import { NavLink, Outlet, useParams } from 'react-router-dom'
import { getGroup } from '../data'
import { dateEs } from '../format'

const EMBAT = ['Tesorería', 'Previsión', 'Intercompany', 'Contrapartes', 'Deuda', 'Conciliación', 'Pagos', 'Global Banking', 'TellMe AI']

export default function Shell() {
  const { gid = '' } = useParams()
  const { data: g, source } = getGroup(gid)
  const unread = g?.alerts.filter(a => a.status === 'nueva').length ?? 0
  const link = 'block px-3 py-1.5 rounded text-[13px]'
  return (
    <div className="min-h-screen flex">
      <aside className="w-[220px] shrink-0 bg-surface border-r border-line px-3 py-4 flex flex-col gap-1">
        <div className="px-3 pb-3 mb-2 border-b border-line">
          <div className="font-semibold tracking-tight">embat</div>
          <div className="text-[11px] text-ink-3">Treasury Management</div>
        </div>
        {EMBAT.map(m => <div key={m} className={`${link} text-ink-3 cursor-default`}>{m}</div>)}
        <div className="mt-3 px-3 pt-3 border-t border-line text-[11px] uppercase tracking-wider text-accent font-medium">Caja Real</div>
        <NavLink end to={`/g/${gid}`} className={({ isActive }) => `${link} ${isActive ? 'bg-accent-soft text-accent font-medium' : 'text-ink hover:bg-bg'}`}>Grupo</NavLink>
        <NavLink to={`/g/${gid}/alertas`} className={({ isActive }) => `${link} flex justify-between ${isActive ? 'bg-accent-soft text-accent font-medium' : 'text-ink hover:bg-bg'}`}>
          <span>Alertas</span>{unread > 0 && <span className="text-[11px] bg-bad text-white rounded-full px-1.5 leading-5">{unread}</span>}
        </NavLink>
        <div className="mt-auto px-3 text-[11px] text-ink-3 font-mono">{g?.model_version ?? '—'}<br />{source}</div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="h-12 bg-surface border-b border-line flex items-center gap-4 px-6 text-[13px]">
          <span className="font-medium">{g?.name ?? gid}</span>
          <span className="text-ink-3">Datos a {dateEs(g?.assessment_date)}</span>
          <span className="ml-auto text-[11px] font-mono px-2 py-0.5 rounded bg-bg border border-line text-ink-2">{g?.history_mode ?? '—'}</span>
        </header>
        <main className="p-6 max-w-[1280px]"><Outlet /></main>
      </div>
    </div>
  )
}
