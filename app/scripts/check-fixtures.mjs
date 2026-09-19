// Shape check for fixtures and model output, no test framework. Exit 1 on the first miss.
import { readdirSync, readFileSync } from 'node:fs'
const dir = new URL('../src/fixtures/', import.meta.url)
const need = (o, path, file) => {
  for (const k of path.split('.')) { if (o === null || typeof o !== 'object' || !(k in o)) { console.error(`${file}: missing ${path}`); process.exit(1) } o = o[k] }
}
let n = 0
for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const j = JSON.parse(readFileSync(new URL(f, dir), 'utf8')); n++
  if (f.startsWith('GROUP_')) {
    for (const p of ['group_id', 'assessment_date', 'model_version', 'history_mode', 'consolidated.caja_real', 'short_count', 'anticipation.reference.false_alarms', 'companies', 'alerts']) need(j, p, f)
    for (const r of j.companies) for (const p of ['company_id', 'score', 'band', 'delta_3m', 'trend_6m', 'caja_real', 'last_data_month', 'publicable', 'coverage.erp']) need(r, p, f)
  } else {
    for (const p of ['company_id', 'score.value', 'score.band', 'score.baseline_12m', 'score_series', 'caja_real_series', 'drivers', 'coverage.bank.ok', 'coverage.erp.ok', 'coverage.debt.ok', 'goals', 'flujos', 'cobro', 'deuda.serie', 'deuda.perfil', 'evidencia.serie', 'evidencia.resumen.publicable']) need(j, p, f)
    for (const d of j.drivers) for (const p of ['key', 'label_es', 'contribution_pts', 'unit', 'months', 'evidence']) need(d, p, f)
    if (j.cash_path) for (const p of ['buffer', 'points', 'checkpoints', 'min_cash.cash', 'assumptions']) need(j.cash_path, p, f)
    for (const g of j.goals) { need(g, 'plans', f); if (g.plans.length < 3) { console.error(`${f}: goal ${g.goal_id} has ${g.plans.length} plans, expected at least 3`); process.exit(1) }
      for (const pl of g.plans) for (const q of ['plan_id', 'title_es', 'attainment.met', 'cash_impact.min_cash', 'unmet_constraints', 'qualifies']) need(pl, q, f) }
  }
}
console.log(`${n} fixture files ok`)
