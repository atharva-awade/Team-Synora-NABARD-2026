export interface Profile {
  id: string;
  name: string;
  sector: string;
  sector_label: string;
  sector_emoji: string;
  district: string;
  state: string;
  org_type: string;
  size_factor: number;
  established_year: number;
  has_loan: boolean;
  loan_amount: number;
  emi: number;
}

export interface Vitals {
  liquidity_runway_months: number;
  income_volatility: number;
  repayment_capacity: number | null;
  current_cash_balance: number;
  avg_monthly_income: number;
  avg_monthly_net_cashflow: number;
  savings: number;
  loan_outstanding: number;
}

export interface HistoryPoint {
  month: string;
  income: number;
  expenses: number;
  net_cashflow: number;
  cash_balance: number;
  savings: number;
  loan_outstanding: number;
  repayment_due: number;
  repayment_made: number;
  upi_txn_count: number;
  active_shock: string;
}

export interface Contribution {
  driver: string;
  key: string;
  value: number;
}

export interface ForecastMonth {
  month: string;
  predicted_net_cashflow: number;
  baseline: number;
  driver_adjustment: number;
  lower: number;
  upper: number;
  contributions: Contribution[];
  active_shocks: Record<string, number>;
}

export interface RiskFactor {
  label: string;
  weight: number;
}

export interface Risk {
  score: number;
  band: "Low" | "Watch" | "High";
  baseline_score?: number;
  top_factors: RiskFactor[];
}

export interface CreditReadiness {
  score: number;
  band: "Building" | "Emerging" | "Credit-ready";
  components: Record<string, number>;
}

export interface ActionItem {
  title: string;
  detail: string;
  urgency: "low" | "medium" | "high";
  factor: string;
}

export interface EnterpriseDetail {
  profile: Profile;
  vitals: Vitals;
  history: HistoryPoint[];
  forecast: ForecastMonth[];
  risk: Risk;
  credit_readiness: CreditReadiness;
  actions: ActionItem[];
  horizon_months: number;
  what_if_applied: boolean;
}

export interface PortfolioCard {
  id: string;
  name: string;
  sector: string;
  sector_label: string;
  sector_emoji: string;
  district: string;
  state: string;
  org_type: string;
  risk_score: number;
  risk_band: "Low" | "Watch" | "High";
  credit_readiness: number;
  credit_band: string;
  next_month_net_cashflow: number;
  avg_net_cashflow: number;
  runway_months: number;
  top_factor: string | null;
}

export interface PortfolioSummary {
  enterprises: PortfolioCard[];
  summary: {
    total: number;
    band_counts: Record<string, number>;
    sector_counts: Record<string, number>;
    avg_credit_readiness: number;
    credit_ready_count: number;
    at_risk_count: number;
  };
}

export interface SectorMeta {
  key: string;
  label: string;
  emoji: string;
  shocks: { key: string; label: string; icon: string; driver: string }[];
}

export interface DriverMeta {
  key: string;
  label: string;
}

export interface SectorParams {
  coef: number[];
  intercept: number;
  driver_means: number[];
  seasonal_mult: number[];
  expected_path: number[][];
  months: string[];
}

export interface ForecastParams {
  driver_cols: string[];
  driver_signs: number[];
  horizon: number;
  sectors: Record<string, SectorParams>;
  enterprises: Record<string, { scale: number; sector: string; baseline_vals: number[] }>;
}

export interface Bundle {
  meta: {
    sectors: SectorMeta[];
    drivers: DriverMeta[];
    metrics: Record<string, unknown>;
  };
  portfolio: PortfolioSummary;
  enterprises: Record<string, EnterpriseDetail>;
  forecast_params: ForecastParams;
  risk_meta: {
    features: string[];
    feature_importances: number[];
    bands: { high: number; watch: number };
  };
  current_risk_features: Record<string, Record<string, number>>;
}
