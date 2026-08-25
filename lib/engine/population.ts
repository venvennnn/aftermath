import { MERIDIAN, PLAN_WEIGHTS } from "./company";
import { boundedNormal, clamp, hash32, hashFloat, pick } from "./rng";
import type { CommunicationStyle, Customer, Plan } from "./types";

const FIRST = [
  "Aisha", "Arjun", "Meera", "Nikhil", "Priya", "Rohan", "Leila", "Samir",
  "Ananya", "Dev", "Fatima", "Ishan", "Kavya", "Omar", "Sana", "Vikram",
  "Helena", "Marcus", "Naomi", "Julian", "Sofia", "Elena", "Mateo", "Chloe",
  "Hiro", "Yuki", "Amara", "Tomas", "Ines", "Pascal", "Greta", "Noah",
  "Aditi", "Kabir", "Zara", "Luca", "Maya", "Etienne", "Nora", "Ravi",
];

const LAST = [
  "Menon", "Iyer", "Kapoor", "Nair", "Sharma", "Reddy", "Das", "Banerjee",
  "Khan", "Joshi", "Pillai", "Ghosh", "Patel", "Rao", "Sen", "Malik",
  "Okoye", "Berg", "Santos", "Novak", "Moreau", "Keller", "Silva", "Cohen",
  "Nakamura", "Park", "Alvarez", "Dubois", "Lindqvist", "Okafor", "Rossi", "Wahl",
];

const TITLES = [
  "VP Customer Experience", "Head of IT", "Director of Operations",
  "Founder", "CTO", "Support Lead", "COO", "Head of Revenue",
  "ITSM Manager", "CX Principal", "Procurement Lead", "General Manager",
];

const COMPANIES = [
  "Harbor & Co", "Nimbus Labs", "Kala Health", "Volt Freight", "Sable Bank",
  "Iris Retail", "North Quay", "Pulp Media", "Cedar Clinics", "Apex Drones",
  "Yellowfield", "Orchid Hotels", "Gridline Energy", "Banyan Pay", "Lumen Legal",
  "Salt & Grain", "Helix Robotics", "Monad Analytics", "Cove Insurance",
  "Petal Beauty", "Ironclad Logistics", "Wick & Co", "Saffron Air",
  "Brightside Ed", "Quill Press", "Terra Mines", "Indigo Rail", "Moss Fintech",
  "Cinder Studios", "Lotus Mobility", "Arc Ship", "Velvet Cart", "Pinnacle HR",
  "Kite & Anchor", "Onyx Security", "Marigold Foods", "Echo Clinics",
];

const INDUSTRIES = [
  "fintech", "healthcare", "logistics", "retail", "hospitality",
  "education", "manufacturing", "media", "insurance", "aviation",
  "legal", "energy", "saas", "public sector", "ecommerce",
];

const REGIONS = ["Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune", "London", "Berlin", "Singapore", "Austin", "Toronto", "Dubai"];

const STYLES: CommunicationStyle[] = [
  "terse",
  "formal",
  "emotional",
  "analytical",
  "confrontational",
];

const GOALS = [
  "Keep ticket backlog under a day",
  "Protect enterprise renewals this quarter",
  "Cut cost-to-serve without touching NPS",
  "Give the field team a single source of truth",
  "Stop after-hours escalations waking the founder",
  "Pass a pending SOC 2 audit",
  "Launch in two new cities before monsoon",
  "Replace a rival platform at renewal",
];

function assignPlan(seed: number): Plan {
  const r = hashFloat(seed, "plan");
  if (r < PLAN_WEIGHTS.basic) return "basic";
  if (r < PLAN_WEIGHTS.basic + PLAN_WEIGHTS.pro) return "pro";
  return "enterprise";
}

export function createPopulation(count: number, worldSeed: number): Customer[] {
  const customers: Customer[] = [];
  for (let i = 0; i < count; i += 1) {
    const seed = hash32(worldSeed, i, "customer");
    const plan = assignPlan(seed);
    const name = `${pick(FIRST, seed, "first")} ${pick(LAST, seed, "last")}`;
    const company = pick(COMPANIES, seed, "co");
    const industry = pick(INDUSTRIES, seed, "ind");
    const sizeMean = plan === "enterprise" ? 1800 : plan === "pro" ? 180 : 28;
    const companySize = Math.max(
      4,
      Math.round(sizeMean * (0.55 + hashFloat(seed, "size") * 1.6)),
    );
    const basePrice = MERIDIAN.plans[plan].priceInr;
    const seatMult = plan === "enterprise" ? 3 + hashFloat(seed, "seats") * 8 : 1;
    const monthlySpend = Math.round(basePrice * seatMult);
    const tenureMonths = Math.round(4 + hashFloat(seed, "tenure") * 72);
    const loyalty = boundedNormal(plan === "enterprise" ? 0.72 : 0.55, 0.16, 0.12, 0.96, seed, "loy");
    const priceSensitivity = boundedNormal(
      plan === "enterprise" ? 0.32 : plan === "pro" ? 0.58 : 0.7,
      0.14,
      0.08,
      0.97,
      seed,
      "ps",
    );
    const churnRisk = clamp(
      0.12 + (1 - loyalty) * 0.45 + hashFloat(seed, "cr") * 0.12,
    );
    const usesPhone = hashFloat(seed, "phone") < (plan === "basic" ? 0.62 : 0.34);

    customers.push({
      id: `c_${(seed % 1_000_000).toString(16)}`,
      seed,
      name,
      title: pick(TITLES, seed, "title"),
      company,
      industry,
      region: pick(REGIONS, seed, "region"),
      companySize,
      plan,
      originalPlan: plan,
      tenureMonths,
      monthlySpend,
      clv: Math.round(monthlySpend * (10 + tenureMonths / 4) * (1.2 + loyalty)),
      priceSensitivity,
      loyalty,
      technicalKnowledge: boundedNormal(0.55, 0.2, 0.1, 0.98, seed, "tech"),
      communicationStyle: pick(STYLES, seed, "style"),
      churnRisk,
      frustration: boundedNormal(0.18, 0.1, 0.02, 0.55, seed, "fr"),
      churnThreshold: boundedNormal(0.72, 0.08, 0.52, 0.92, seed, "th"),
      willingnessToPay: boundedNormal(
        plan === "enterprise" ? 0.78 : 0.55,
        0.14,
        0.15,
        0.97,
        seed,
        "wtp",
      ),
      switchingCost: boundedNormal(
        plan === "enterprise" ? 0.74 : plan === "pro" ? 0.48 : 0.28,
        0.12,
        0.08,
        0.92,
        seed,
        "sw",
      ),
      supportTicketsLast90: Math.round(hashFloat(seed, "t90") * (plan === "enterprise" ? 14 : 7)),
      nps: Math.round(boundedNormal(32, 22, -40, 90, seed, "nps")),
      usesPhoneSupport: usesPhone,
      prefersHuman: usesPhone || hashFloat(seed, "human") > 0.55,
      goals: [pick(GOALS, seed, "g1"), pick(GOALS, seed, "g2")],
      history: [
        tenureMonths > 24
          ? `Customer since ${2026 - Math.floor(tenureMonths / 12)}`
          : "Relatively new account",
        `${companySize} people · ${industry}`,
        usesPhone ? "Relies on phone for urgent tickets" : "Mostly chat and email",
      ],
      status: "active",
      alive: true,
      daysToChurn: null,
      discountGrantedPercent: 0,
      ticketsOpened: 0,
      escalations: 0,
    });
  }
  return customers;
}

export function cloneCustomers(customers: Customer[]): Customer[] {
  return customers.map((customer) => ({
    ...customer,
    goals: [...customer.goals],
    history: [...customer.history],
  }));
}
