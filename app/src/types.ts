// Model -> App contract. Money in EUR as numbers, months YYYY-MM, dates YYYY-MM-DD.
// null means unknown, never zero.
export type Band = 'sana' | 'vigilar' | 'riesgo' | 'critica'
export type HistoryMode = 'as_known' | 'reconstructed'

export interface LeadStats {
  median_lead_months: number | null
  caught_1m_pct: number | null
  caught_3m_pct: number | null
  missed_pct: number | null
  false_alarms: number
  n_clean: number
}

export interface CompanyRow {
  company_id: string; name: string; currency: string
  score: number; band: Band; delta_3m: number; trend_6m: number[]
  bank_cash: number; caja_real: number
  first_shortfall_date: string | null
  last_data_month: string
  coverage: { bank: boolean; erp: boolean; debt: boolean }
}

export interface Alert {
  alert_id: string; company_id: string; raised_month: string
  severity: 'P0' | 'P1' | 'info'
  type: 'deterioro' | 'recuperacion' | 'caja_real_negativa' | 'deficit_30d'
  title_es: string; persistence_months: number
  score_from: number | null; score_to: number | null; lead_months: number | null
  status: 'nueva' | 'vista'
}

export interface Group {
  group_id: string; name: string; assessment_date: string; model_version: string
  history_mode: HistoryMode
  consolidated: { bank_cash: number; committed_30d: number; pledged: number; trapped: number; caja_real: number }
  short_count: number; short_total: number
  anticipation: { reference: LeadStats; ours: LeadStats | null }
  companies: CompanyRow[]; alerts: Alert[]
}

export interface Driver {
  key: string; label_es: string; contribution_pts: number
  value: number | null; baseline: number | null
  unit: 'days' | 'eur' | 'ratio' | 'months'
  months: string[]
  evidence: { source: 'transactions' | 'invoices' | 'debt_products'; ids: string[] }[]
}

export interface CashPoint { date: string; cash: number; kind: 'contractual' | 'behavioural' }
export interface CashPath {
  horizon_days: number; buffer: number
  points: CashPoint[]
  checkpoints: { day: number; cash: number; committed_due: number }[]
  min_cash: { date: string; cash: number }
  first_shortfall: { date: string; amount: number } | null
  funding_gap: { amount: number; date: string } | null
  assumptions: { key: string; label_es: string; value: number; unit: string; period: string; source: 'historical' | 'user' }[]
}

export interface PlanCard {
  plan_id: string; title_es: string
  changes: { driver: string; label_es: string; from: number; to: number; unit: string }[]
  attainment: { value: number; target: number; pct: number; met: boolean }
  cash_impact: { min_cash: number; min_cash_date: string; delta_vs_base: number }
  trade_offs: { metric: string; label_es: string; delta: number; unit: string }[]
  unmet_constraints: { constraint_label_es: string; breach_date: string; value: number }[]
  qualifies: boolean
}

export interface Goal {
  goal_id: string; metric: string; label_es: string; target: number; unit: string; deadline: string
  constraints: { metric: string; op: string; value: number; label_es: string }[]
  plans: PlanCard[]
  remaining_gap: { amount: number; date: string } | null
}

export interface Company {
  company_id: string; group_id: string; name: string; currency: string
  assessment_date: string; model_version: string; history_mode: HistoryMode
  last_data_month: string
  score: { value: number; band: Band; delta_3m: number; baseline_12m: number }
  score_series: { month: string; score: number; mode: HistoryMode }[]
  caja_real_series: { month: string; bank_cash: number; committed: number; pledged: number; trapped: number; caja_real: number }[]
  drivers: Driver[]
  coverage: {
    bank: { ok: boolean; last_date: string | null; n_accounts: number }
    erp: { ok: boolean; last_date: string | null; n_invoices: number }
    debt: { ok: boolean; n_products: number; next_instalment_date: string | null }
  }
  event: { onset_month: string; conditions: string[] } | null
  cash_path: CashPath | null
  goals: Goal[]
}
