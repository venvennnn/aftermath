export type Plan = "basic" | "pro" | "enterprise";

export type DecisionType =
  | "pricing"
  | "support_channel"
  | "refund_policy"
  | "sla"
  | "onboarding"
  | "cancellation"
  | "ai_agent"
  | "capacity"
  | "other";

export type CommunicationStyle =
  | "terse"
  | "formal"
  | "emotional"
  | "analytical"
  | "confrontational";

export type CustomerStatus =
  | "active"
  | "downgraded"
  | "upgraded"
  | "negotiating"
  | "escalated"
  | "churned";

export type Actor =
  | "customer"
  | "support"
  | "knowledge"
  | "ai_agent"
  | "escalation"
  | "retention"
  | "finance"
  | "sales"
  | "policy"
  | "world";

export interface CompanyProfile {
  name: string;
  product: string;
  hq: string;
  arrInr: number;
  customerCount: number;
  csHeadcount: number;
  plans: Record<Plan, { label: string; priceInr: number; seats: string }>;
}

export interface EnterprisePolicy {
  pricing: Record<Plan, number>;
  phoneSupportPlans: Plan[];
  refundWindowDays: number;
  slaHours: Record<Plan, number>;
  maxDiscountPercent: number;
  financeApprovalThreshold: number;
  dailyDiscountBudgetInr: number;
  aiAgentEnabled: boolean;
  aiHandlesPlans: Plan[];
  humanSupportCapacity: number;
  cancellationNoticeDays: number;
  onboardingFriction: number;
}

export interface ParsedDecision {
  raw: string;
  type: DecisionType;
  summary: string;
  startDay: number;
  horizonDays: number;
  affectedPlans: Plan[];
  priceChangePercent: number;
  removePhoneSupport: boolean;
  refundWindowDays: number | null;
  slaHours: number | null;
  launchAiAgent: boolean;
  humanCapacityDeltaPercent: number;
  cancellationNoticeDays: number | null;
  onboardingFrictionDelta: number;
  notes: string[];
}

export interface Customer {
  id: string;
  seed: number;
  name: string;
  title: string;
  company: string;
  industry: string;
  region: string;
  companySize: number;
  plan: Plan;
  originalPlan: Plan;
  tenureMonths: number;
  monthlySpend: number;
  clv: number;
  priceSensitivity: number;
  loyalty: number;
  technicalKnowledge: number;
  communicationStyle: CommunicationStyle;
  churnRisk: number;
  frustration: number;
  churnThreshold: number;
  willingnessToPay: number;
  switchingCost: number;
  supportTicketsLast90: number;
  nps: number;
  usesPhoneSupport: boolean;
  prefersHuman: boolean;
  goals: string[];
  history: string[];
  status: CustomerStatus;
  alive: boolean;
  daysToChurn: number | null;
  discountGrantedPercent: number;
  ticketsOpened: number;
  escalations: number;
}

export interface SimEvent {
  id: string;
  day: number;
  actor: Actor;
  customerId: string;
  kind: string;
  title: string;
  detail: string;
  severity: "info" | "warn" | "critical";
  tool?: string;
  amountInr?: number;
}

export interface Ticket {
  id: string;
  day: number;
  customerId: string;
  topic: string;
  channel: "phone" | "email" | "chat" | "ai";
  resolved: boolean;
  quality: number;
  escalated: boolean;
  handler: Actor;
}

export interface DailySnapshot {
  day: number;
  activeCustomers: number;
  churned: number;
  tickets: number;
  escalations: number;
  discountsInr: number;
  revenueInr: number;
}

export interface UniverseSummary {
  id: string;
  label: string;
  description: string;
  policy: EnterprisePolicy;
  metrics: UniverseMetrics;
  events: SimEvent[];
  daily: DailySnapshot[];
  customers: Customer[];
}

export interface UniverseMetrics {
  population: number;
  churned: number;
  churnRate: number;
  downgraded: number;
  tickets: number;
  escalations: number;
  enterpriseEscalations: number;
  discountSpendInr: number;
  revenueInr: number;
  lostClvInr: number;
  npsAvg: number;
  financeRejections: number;
  aiMishandles: number;
  phoneAttemptsBlocked: number;
  policyConflicts: number;
}

export interface CausalLink {
  day: number;
  actor: Actor;
  action: string;
  outcome: string;
}

export interface CausalStory {
  id: string;
  headline: string;
  customerId: string;
  outcome: string;
  chain: CausalLink[];
  insight: string;
}

export interface ObserverFinding {
  pattern: string;
  evidence: string;
  severity: "info" | "warn" | "critical";
}

export interface ObserverReport {
  headline: string;
  thesis: string;
  findings: ObserverFinding[];
  recommendation: string;
  unexpected: string[];
  policyConflicts: string[];
}

export interface IncomingCall {
  day: number;
  customerId: string;
  fromName: string;
  fromCompany: string;
  tenureLabel: string;
  script: string;
  closingLine: string;
}

export interface TimelineBeat {
  day: number;
  kicker: string;
  title: string;
  body: string;
  severity: "info" | "warn" | "critical";
  customerId?: string;
}

export interface SimulationResult {
  id: string;
  seed: number;
  usedGemini: boolean;
  company: CompanyProfile;
  decision: ParsedDecision;
  control: UniverseSummary;
  treatment: UniverseSummary;
  counterfactuals: UniverseSummary[];
  deltas: {
    churnRate: number;
    supportVolume: number;
    enterpriseEscalations: number;
    discountSpendInr: number;
    revenueImpactInr: number;
    nps: number;
    tickets: number;
  };
  featured: Customer[];
  stories: CausalStory[];
  observer: ObserverReport;
  incomingCall: IncomingCall;
  timeline: TimelineBeat[];
  generatedAt: string;
}

export interface ConverseMessage {
  role: "user" | "customer";
  content: string;
}
