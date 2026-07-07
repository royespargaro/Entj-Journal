import { CURRENCIES, PAIR_CONFIG } from '../constants';

// --- Live Rate Cache ---
let rateCache: Record<string, number> = {};
let lastFetched: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const fetchLiveRates = async (): Promise<Record<string, number>> => {
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=USD');
    if (!response.ok) throw new Error('Rate fetch failed');
    const data = await response.json();
    // Frankfurter returns rates relative to USD
    // Add USD itself
    const rates: Record<string, number> = { USD: 1, ...data.rates };
    return rates;
  } catch (e) {
    console.warn('Live rate fetch failed, using static fallback', e);
    return {};
  }
};

const getLiveRates = async (): Promise<Record<string, number>> => {
  const now = Date.now();
  if (Object.keys(rateCache).length > 0 && now - lastFetched < CACHE_DURATION) {
    return rateCache;
  }
  const rates = await fetchLiveRates();
  if (Object.keys(rates).length > 0) {
    rateCache = rates;
    lastFetched = now;
  }
  return rateCache;
};

// Initialize rates on app load
getLiveRates();

// --- Sync conversion using cached rates (fallback to static) ---
export const convertCurrency = (amount: number, from: string, to: string): number => {
  if (from === to) return amount;
  if (!amount || isNaN(amount)) return 0;

  // Try live cached rates first
  if (Object.keys(rateCache).length > 0) {
    const fromRate = rateCache[from] ?? null;
    const toRate = rateCache[to] ?? null;

    if (fromRate && toRate) {
      // Convert: amount in 'from' → USD → 'to'
      const inUsd = amount / fromRate;
      return inUsd * toRate;
    }
  }

  // Fallback to static rates from constants
  const fromRate = CURRENCIES[from as keyof typeof CURRENCIES]?.rate || 1;
  const toRate = CURRENCIES[to as keyof typeof CURRENCIES]?.rate || 1;
  const inUsd = amount / fromRate;
  return inUsd * toRate;
};

// --- Async version for when you need guaranteed live rates ---
export const convertCurrencyLive = async (amount: number, from: string, to: string): Promise<number> => {
  if (from === to) return amount;
  if (!amount || isNaN(amount)) return 0;

  const rates = await getLiveRates();

  const fromRate = rates[from] ?? CURRENCIES[from as keyof typeof CURRENCIES]?.rate ?? 1;
  const toRate = rates[to] ?? CURRENCIES[to as keyof typeof CURRENCIES]?.rate ?? 1;

  const inUsd = amount / fromRate;
  return inUsd * toRate;
};

// --- Hook for React components to trigger rate refresh ---
export const refreshRates = async (): Promise<boolean> => {
  try {
    const rates = await fetchLiveRates();
    if (Object.keys(rates).length > 0) {
      rateCache = rates;
      lastFetched = Date.now();
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// --- Get current rate for display ---
export const getRate = (from: string, to: string): number => {
  if (from === to) return 1;
  const fromRate = rateCache[from] ?? CURRENCIES[from as keyof typeof CURRENCIES]?.rate ?? 1;
  const toRate = rateCache[to] ?? CURRENCIES[to as keyof typeof CURRENCIES]?.rate ?? 1;
  return toRate / fromRate;
};

export const formatNum = (val: any, decimals: number = 2) => {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(n)) return '0.00';
  return n.toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

export const formatCurrency = (val: any, currency: string = 'USD') => {
  const meta = (CURRENCIES as any)[currency] || CURRENCIES.USD;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, '')) || 0;
  const absVal = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (currency === 'IDR' || currency === 'IDC') {
    return `${sign}${meta.symbol}${Math.round(absVal).toLocaleString('id-ID')}`;
  }

  // Cent accounts — show with cent symbol and 2 decimals
  if (meta.isCent) {
    return `${sign}${meta.symbol}${formatNum(absVal, 2)}`;
  }

  return `${sign}${meta.symbol}${formatNum(absVal, 2)}`;
};

export const cleanMoney = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  let s = String(val).trim();
  s = s.replace(/[−–—]/g, '-');
  s = s.replace(/\s+/g, ''); 
  
  if (s.startsWith('(') && s.endsWith(')')) {
    s = '-' + s.substring(1, s.length - 1);
  }
  
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  } else if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') < s.lastIndexOf('.')) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/\./g, '').replace(',', '.');
    }
  } else if (s.includes(',')) {
    s = s.replace(/,/g, '');
  }

  if (s.endsWith('-')) {
    s = '-' + s.substring(0, s.length - 1);
  }

  const cleaned = s.replace(/[^\d.\-]/g, '');
  const hasMinus = cleaned.startsWith('-');
  const numericPart = cleaned.replace(/-/g, '');
  const dotParts = numericPart.split('.');
  let normalizedNumeric = dotParts[0];
  if (dotParts.length > 1) {
    normalizedNumeric += '.' + dotParts.slice(1).join('');
  }
  
  const parsed = parseFloat((hasMinus ? '-' : '') + normalizedNumeric);
  return isNaN(parsed) ? 0 : parsed;
};
export type RRResult = {
  value: number | null;
  method: "planned" | "realized" | null;
  valid: boolean;
  reason?:
    | "missing_entry"
    | "missing_exit"
    | "missing_sl"
    | "missing_tp"
    | "invalid";
};

export function calcRR(
  trade: {
    entry?: number | string;
    exit?: number | string;
    sl?: number | string;
    tp?: number | string;
    dir?: string;
  },
  type: "planned" | "actual" = "actual"
): RRResult {

  const entry = Number(trade.entry);
  const exit = Number(trade.exit);
  const sl = Number(trade.sl);
  const tp = Number(trade.tp);

  const isLong = trade.dir === "Long";

  if (!entry || isNaN(entry)) {
    return {
      value: null,
      method: null,
      valid: false,
      reason: "missing_entry",
    };
  }

  // --------------------
  // Planned RR
  // --------------------

  if (type === "planned") {

    if (!sl || sl === entry) {
      return {
        value: null,
        method: null,
        valid: false,
        reason: "missing_sl",
      };
    }

    if (!tp || tp === entry) {
      return {
        value: null,
        method: null,
        valid: false,
        reason: "missing_tp",
      };
    }

    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);

    if (risk <= 0 || reward <= 0) {
      return {
        value: null,
        method: null,
        valid: false,
        reason: "invalid",
      };
    }

    return {
      value: reward / risk,
      method: "planned",
      valid: true,
    };
  }

  // --------------------
  // Realized RR
  // --------------------

  if (!exit || isNaN(exit)) {
    return {
      value: null,
      method: null,
      valid: false,
      reason: "missing_exit",
    };
  }

  if (!sl || sl === entry) {
    return {
      value: null,
      method: null,
      valid: false,
      reason: "missing_sl",
    };
  }

  const risk = Math.abs(entry - sl);

  if (risk <= 0) {
    return {
      value: null,
      method: null,
      valid: false,
      reason: "invalid",
    };
  }

  const reward = isLong
    ? exit - entry
    : entry - exit;

  const rr = reward / risk;

  return {
    value: Number(rr.toFixed(2)),
    method: "realized",
    valid: true,
  };
}
export function avgRR(
  trades: any[],
  type: "planned" | "actual" = "actual"
) {

  const results = trades.map(t => calcRR(t, type));

  const valid = results.filter(
    r =>
      r.valid &&
      r.value !== null &&
      Number.isFinite(r.value)
  );

  const average =
    valid.length > 0
      ? valid.reduce((sum, r) => sum + r.value!, 0) /
        valid.length
      : null;

  return {

    average,

    coverage:
      trades.length === 0
        ? 0
        : (valid.length / trades.length) * 100,

    validTrades: valid.length,

    totalTrades: trades.length,

    invalidTrades: trades.length - valid.length,

    missingSL: results.filter(r => r.reason === "missing_sl").length,

    missingTP: results.filter(r => r.reason === "missing_tp").length,

    missingExit: results.filter(r => r.reason === "missing_exit").length,

    invalidDirection: results.filter(r => r.reason === "invalid_direction").length,
  };
}

// ============================================================
// TRADE CLASSIFICATION — Win / Break-even / Loss
// ============================================================
// Uses R-based threshold when Realized R is computable.
// Falls back to a monetary threshold (in the trade's own currency)
// when SL/Entry/Exit data is incomplete or invalid.
// ============================================================

export type TradeClassification = {
  result: "WIN" | "BREAKEVEN" | "LOSS";
  method: "monetary";
  realizedR: number | null; // kept for backward compat with existing callers, always null now
};

// Pure dollar-amount classification. Anything with |P&L| under the
// threshold (default $1) is Break-even — this matches manually closing
// a trade early on a small move rather than letting it run to a clean
// TP/SL, which is common practice and shouldn't count as a decisive win/loss.
export function classifyTrade(
  trade: { pnl?: number | string },
  beThresholdMoney: number = 1
): TradeClassification {
  const pnl = cleanMoney(trade.pnl);

  if (pnl > beThresholdMoney) {
    return { result: "WIN", method: "monetary", realizedR: null };
  }
  if (pnl < -beThresholdMoney) {
    return { result: "LOSS", method: "monetary", realizedR: null };
  }
  return { result: "BREAKEVEN", method: "monetary", realizedR: null };
}

// ============================================================
// NO RISK DATA — trades excluded from R-based analytics
// ============================================================
// A trade has "No Risk Data" if Stop Loss is missing/invalid, so
// Initial Risk cannot be objectively determined. These trades still
// count toward P&L, equity curve, and trade history — just not R-stats.
// ============================================================

export function getNoRiskDataStats(trades: any[]) {
  const noRiskTrades = trades.filter(t => {
    const entry = Number(t.entry);
    const sl = Number(t.sl);
    return !entry || isNaN(entry) || !sl || isNaN(sl) || sl === entry;
  });

  return {
    count: noRiskTrades.length,
    trades: noRiskTrades,
    percentOfTotal: trades.length > 0 ? (noRiskTrades.length / trades.length) * 100 : 0,
  };
}

// ============================================================
// REWARD CAPTURE RATIO — Realized R / Planned RR
// ============================================================
// Only meaningful for WINNING trades (see architecture review —
// applying this to losers or near-zero Planned RR produces
// misleading/absurd ratios). Capped to avoid outlier distortion.
// Returns per-trade values plus a distribution summary, not just
// a single average, since averaging alone can hide bimodal patterns.
// ============================================================

export type RewardCaptureResult = {
  average: number | null;
  median: number | null;
  samples: number[];
  count: number;
  cappedCount: number; // how many were clipped by the cap
};

export function calcRewardCaptureRatio(
  trades: any[],
  cap: number = 2.0 // clip ratios above 200% capture — still shown but flagged
): RewardCaptureResult {
  const samples: number[] = [];
  let cappedCount = 0;

  trades.forEach(t => {
    const planned = calcRR(t, "planned");
    const realized = calcRR(t, "actual");

    if (
      !planned.valid || planned.value === null ||
      !realized.valid || realized.value === null ||
      planned.value <= 0
    ) return;

    // Only winners — see architecture note above
    if (realized.value <= 0) return;

    let ratio = realized.value / planned.value;
    if (ratio > cap) {
      ratio = cap;
      cappedCount++;
    }
    samples.push(ratio);
  });

  if (samples.length === 0) {
    return { average: null, median: null, samples: [], count: 0, cappedCount: 0 };
  }

  const average = samples.reduce((a, b) => a + b, 0) / samples.length;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;

  return { average, median, samples, count: samples.length, cappedCount };
}

export const DEFAULT_BE_THRESHOLD_MONEY = 1;

// ============================================================
// BEHAVIORAL NARRATIVE — turns habit stats into a short story
// instead of a wall of numbers. Deterministic (no AI call needed);
// picks the 2-3 most notable patterns and writes them as sentences.
// ============================================================
// ============================================================
// PERFORMANCE INTELLIGENCE — confidence-scored, evidence-backed findings
// ============================================================
// AI never invents these numbers or the ranking — everything here is
// computed deterministically from `stats`. The LLM's only job downstream
// is to phrase the "why" narration; it never decides severity or confidence.
// ============================================================

export type Evidence = { label: string; value: string };

export type Finding = {
  id: string;
  category: 'priority' | 'edge' | 'risk' | 'goal';
  icon: string;
  title: string;
  headline: string; // e.g. "Revenge Trading"
  confidence: number; // 0-100
  severity: number; // 0-100, used for ranking within category
  evidence: Evidence[];
  dollarImpact: number | null;
};

// Confidence scales with sample size — small samples never get high
// confidence, regardless of how extreme the pattern looks.
function confidenceFromSampleSize(n: number, maxConfidence: number = 96): number {
  if (n <= 0) return 0;
  // Logistic-ish ramp: ~50% conf at n=5, ~80% at n=15, caps near maxConfidence
  const raw = maxConfidence * (1 - Math.exp(-n / 12));
  return Math.round(Math.min(maxConfidence, Math.max(10, raw)));
}

export function generateFindings(habitStats: {
  emotionBreakdown: { emotion: string; pnl: number; winRate: number; count: number; wins: number; losses: number }[];
  sessionStats: { session: string; pnl: number; wr: number; count: number }[];
  pairStats: { pair: string; pnl: number; wr: number; count: number }[];
  setupStats: { setup: string; pnl: number; wr: number; count: number }[];
  consecutiveLosses: number;
  revengeTrades: number;
  overtradeDays: number;
  maxDD: number;
  expectedValue: number;
  adherenceScore: number;
}, toDisp: (usd: number) => string): Finding[] {
  const findings: Finding[] = [];

  // ── PRIORITY: revenge trading ──
  if (habitStats.revengeTrades > 0) {
    findings.push({
      id: 'revenge',
      category: 'priority',
      icon: '🚨',
      title: 'Revenge Trading',
      headline: 'Revenge Trading',
      confidence: confidenceFromSampleSize(habitStats.revengeTrades, 96),
      severity: Math.min(100, habitStats.revengeTrades * 20),
      evidence: [
        { label: 'Repeated pattern instances', value: `${habitStats.revengeTrades}` },
        { label: 'Trigger window', value: 'Within 15 min of a loss' },
      ],
      dollarImpact: null,
    });
  }

  // ── PRIORITY: overtrading ──
  if (habitStats.overtradeDays > 0) {
    findings.push({
      id: 'overtrade',
      category: 'priority',
      icon: '🚨',
      title: 'Overtrading',
      headline: 'Overtrading',
      confidence: confidenceFromSampleSize(habitStats.overtradeDays, 90),
      severity: Math.min(100, habitStats.overtradeDays * 15),
      evidence: [
        { label: 'Days with 5+ trades', value: `${habitStats.overtradeDays}` },
      ],
      dollarImpact: null,
    });
  }

  // ── PRIORITY: worst emotion ──
  const worstEmotion = [...habitStats.emotionBreakdown].filter(e => e.count >= 2).sort((a, b) => a.pnl - b.pnl)[0];
  if (worstEmotion && worstEmotion.pnl < 0) {
    findings.push({
      id: 'worst-emotion',
      category: 'priority',
      icon: '🚨',
      title: `Trading While "${worstEmotion.emotion}"`,
      headline: worstEmotion.emotion,
      confidence: confidenceFromSampleSize(worstEmotion.count, 92),
      severity: Math.min(100, Math.abs(worstEmotion.pnl) / 10),
      evidence: [
        { label: 'Trades', value: `${worstEmotion.count}` },
        { label: 'Win rate', value: `${worstEmotion.winRate}%` },
        { label: 'Total impact', value: toDisp(worstEmotion.pnl) },
      ],
      dollarImpact: worstEmotion.pnl,
    });
  }

  // ── EDGE: best session ──
  const totalPnl = habitStats.sessionStats.reduce((s, x) => s + Math.max(0, x.pnl), 0) || 1;
  const bestSession = [...habitStats.sessionStats].filter(s => s.count >= 3).sort((a, b) => b.pnl - a.pnl)[0];
  if (bestSession && bestSession.pnl > 0) {
    const pctOfProfit = Math.round((bestSession.pnl / totalPnl) * 100);
    findings.push({
      id: 'best-session',
      category: 'edge',
      icon: '⭐',
      title: `${bestSession.session} Session`,
      headline: bestSession.session,
      confidence: confidenceFromSampleSize(bestSession.count, 94),
      severity: pctOfProfit,
      evidence: [
        { label: 'Trades', value: `${bestSession.count}` },
        { label: 'Win rate', value: `${bestSession.wr}%` },
        { label: 'Share of total profit', value: `${pctOfProfit}%` },
      ],
      dollarImpact: bestSession.pnl,
    });
  }

  // ── EDGE: best setup ──
  const bestSetup = [...habitStats.setupStats].filter(s => s.count >= 2).sort((a, b) => b.pnl - a.pnl)[0];
  if (bestSetup && bestSetup.pnl > 0) {
    findings.push({
      id: 'best-setup',
      category: 'edge',
      icon: '⭐',
      title: `${bestSetup.setup} Setup`,
      headline: bestSetup.setup,
      confidence: confidenceFromSampleSize(bestSetup.count, 90),
      severity: bestSetup.wr,
      evidence: [
        { label: 'Trades', value: `${bestSetup.count}` },
        { label: 'Win rate', value: `${bestSetup.wr}%` },
        { label: 'Total profit', value: toDisp(bestSetup.pnl) },
      ],
      dollarImpact: bestSetup.pnl,
    });
  }

  // ── RISK: drawdown ──
  findings.push({
    id: 'drawdown',
    category: 'risk',
    icon: '🛡',
    title: 'Max Drawdown',
    headline: habitStats.maxDD > 500 ? 'Elevated' : 'Stable',
    confidence: 98, // this is a direct computation, not a pattern inference
    severity: Math.min(100, (habitStats.maxDD / 1000) * 100),
    evidence: [
      { label: 'Max drawdown', value: toDisp(habitStats.maxDD) },
      { label: 'Consecutive losses (current)', value: `${habitStats.consecutiveLosses}` },
    ],
    dollarImpact: -habitStats.maxDD,
  });

  return findings;
}

export function generateBehavioralStory(habitStats: {
  emotionBreakdown: { emotion: string; pnl: number; winRate: number; count: number }[];
  sessionStats: { session: string; pnl: number; wr: number; count: number }[];
  pairStats: { pair: string; pnl: number; wr: number; count: number }[];
  consecutiveLosses: number;
  revengeTrades: number;
  overtradeDays: number;
  weekDelta: { pnl: number; wr: number; discipline: number };
  thisWeek: { pnl: number; wr: number; discipline: number; count: number };
}): string[] {
  const lines: string[] = [];

  // Emotion pattern
  const worstEmotion = [...habitStats.emotionBreakdown].filter(e => e.count >= 2).sort((a, b) => a.pnl - b.pnl)[0];
  const bestEmotion = [...habitStats.emotionBreakdown].filter(e => e.count >= 2).sort((a, b) => b.pnl - a.pnl)[0];
  if (worstEmotion && worstEmotion.pnl < 0) {
    lines.push(`Trading while "${worstEmotion.emotion}" has cost you the most — ${worstEmotion.count} trades with a ${worstEmotion.winRate}% win rate.`);
  }
  if (bestEmotion && bestEmotion.pnl > 0 && bestEmotion.emotion !== worstEmotion?.emotion) {
    lines.push(`Your best state of mind is "${bestEmotion.emotion}" — that's when your edge actually shows up.`);
  }

  // Session pattern
  const bestSession = [...habitStats.sessionStats].sort((a, b) => b.pnl - a.pnl)[0];
  const worstSession = [...habitStats.sessionStats].filter(s => s.count >= 3).sort((a, b) => a.pnl - b.pnl)[0];
  if (bestSession && worstSession && bestSession.session !== worstSession.session && worstSession.pnl < 0) {
    lines.push(`Most of your edge comes from the ${bestSession.session} session, while ${worstSession.session} has been a consistent drag.`);
  }

  // Pair pattern
  const bestPair = [...habitStats.pairStats].sort((a, b) => b.pnl - a.pnl)[0];
  if (bestPair && bestPair.pnl > 0) {
    lines.push(`${bestPair.pair} is your strongest instrument — ${bestPair.wr}% win rate across ${bestPair.count} trades.`);
  }

  // Tilt pattern
  if (habitStats.consecutiveLosses >= 3) {
    lines.push(`You're currently on a ${habitStats.consecutiveLosses}-loss streak — this is when discipline typically slips.`);
  }
  if (habitStats.revengeTrades > 0) {
    lines.push(`${habitStats.revengeTrades} trade${habitStats.revengeTrades > 1 ? 's were' : ' was'} entered within 15 minutes of a loss — a classic revenge-trading signature.`);
  }

  // Week trend
  if (habitStats.thisWeek.count > 0) {
    if (habitStats.weekDelta.discipline > 5) {
      lines.push(`Discipline is trending up — ${Math.round(habitStats.weekDelta.discipline)} points better than last week.`);
    } else if (habitStats.weekDelta.discipline < -5) {
      lines.push(`Discipline slipped ${Math.abs(Math.round(habitStats.weekDelta.discipline))} points versus last week — worth a reset.`);
    }
  }

  if (lines.length === 0) {
    lines.push('Not enough distinct patterns yet — keep logging trades and your story will sharpen.');
  }

  return lines.slice(0, 4);
}

// ============================================================
// MISSIONS — stateful, cross-session progress tracking
// ============================================================
export type Mission = {
  id: string;
  metric: string; // e.g. 'rewardCapture', 'consecutiveLosses', 'planAdherence'
  label: string; // "Hold winners longer"
  startValue: number;
  targetValue: number;
  currentValue: number;
  status: 'active' | 'completed' | 'abandoned';
  estimatedImpact: string; // "+$420/month"
  createdAt: number; // epoch ms
  completedAt: number | null;
};

export function suggestMission(finding: Finding, currentMetricValue: number): Omit<Mission, 'id' | 'createdAt' | 'completedAt' | 'status'> | null {
  // Only priority/risk findings become missions — edges are celebrated, not fixed.
  if (finding.category !== 'priority' && finding.category !== 'risk') return null;

  const target = finding.id === 'revenge' || finding.id === 'overtrade'
    ? 0
    : Math.round(currentMetricValue * 0.5); // aim to halve the negative pattern

  return {
    metric: finding.id,
    label: `Reduce ${finding.headline}`,
    startValue: currentMetricValue,
    targetValue: target,
    currentValue: currentMetricValue,
    estimatedImpact: finding.dollarImpact ? `+$${Math.round(Math.abs(finding.dollarImpact) * 0.5)}/month` : 'Improved consistency',
  };
}

export function missionProgress(mission: Mission): number {
  const range = Math.abs(mission.startValue - mission.targetValue) || 1;
  const moved = Math.abs(mission.startValue - mission.currentValue);
  return Math.round(Math.min(100, Math.max(0, (moved / range) * 100)));
}

// ============================================================
// INTELLIGENCE TIMELINE — monthly snapshots of dominant weakness/strength
// ============================================================
export type TimelineEntry = {
  id: string;
  monthKey: string; // "2026-01"
  type: 'weakness_identified' | 'mission_completed' | 'strength_discovered' | 'milestone';
  label: string;
  detail: string;
  createdAt: number;
};
// Tags every trade with a classification derived from classifyTrade(),
// as `._classification`. Use this everywhere a WIN/BE/LOSS label or a
// win-rate % is shown, instead of the stale stored `result` field
// (which was set at log/import time using a different, hardcoded rule).
export type TradeComputed = {
  result: "WIN" | "BREAKEVEN" | "LOSS";
  method: "r_based" | "monetary_fallback";
  realizedR: number | null;
  plannedRR: number | null;
  structured: boolean; // false = "No Risk Data" (no valid SL)
};

// Single source of truth for every derived trade value. Nothing about
// a trade's Win/Loss/BE label, R-multiples, or "structured" status
// should ever be read from a stored Firestore field — always from here.
export function withComputed<T extends { entry?: any; exit?: any; sl?: any; tp?: any; dir?: any; pnl?: any }>(
  trades: T[],
  beThresholdMoney: number = DEFAULT_BE_THRESHOLD_MONEY
): (T & { computed: TradeComputed })[] {
  return trades.map(t => {
    const classification = classifyTrade(t, beThresholdMoney);
    const planned = calcRR(t, "planned");
    const realized = calcRR(t, "actual"); // still shown as a stat, just not used for W/L/BE
    const entry = Number(t.entry);
    const sl = Number(t.sl);
    const structured = !!(entry && !isNaN(entry) && sl && !isNaN(sl) && sl !== entry);

    return {
      ...t,
      computed: {
        result: classification.result,
        method: classification.method,
        realizedR: realized.valid ? realized.value : null,
        plannedRR: planned.valid ? planned.value : null,
        structured,
      },
    };
  });
}
// Backward-compat alias during migration — remove once no callers reference it
export const withClassification = withComputed;
