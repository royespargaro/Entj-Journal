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
  method: "r_based" | "monetary_fallback";
  realizedR: number | null;
};

export function classifyTrade(
  trade: {
    entry?: number | string;
    exit?: number | string;
    sl?: number | string;
    tp?: number | string;
    dir?: string;
    pnl?: number | string;
  },
  beThresholdR: number = 0.10,
  beThresholdMoney: number = 0
): TradeClassification {
  const rr = calcRR(trade, "actual");

  if (rr.valid && rr.value !== null && Number.isFinite(rr.value)) {
    // R-based classification (preferred — objective, size-independent)
    if (rr.value > beThresholdR) {
      return { result: "WIN", method: "r_based", realizedR: rr.value };
    }
    if (rr.value < -beThresholdR) {
      return { result: "LOSS", method: "r_based", realizedR: rr.value };
    }
    return { result: "BREAKEVEN", method: "r_based", realizedR: rr.value };
  }

  // Fallback — monetary threshold (used when no valid SL/risk exists)
  const pnl = cleanMoney(trade.pnl);
  if (pnl > beThresholdMoney) {
    return { result: "WIN", method: "monetary_fallback", realizedR: null };
  }
  if (pnl < -beThresholdMoney) {
    return { result: "LOSS", method: "monetary_fallback", realizedR: null };
  }
  return { result: "BREAKEVEN", method: "monetary_fallback", realizedR: null };
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

export const DEFAULT_BE_THRESHOLD_R = 0.10;
export const DEFAULT_BE_THRESHOLD_MONEY = 1;

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
  beThresholdR: number = DEFAULT_BE_THRESHOLD_R,
  beThresholdMoney: number = DEFAULT_BE_THRESHOLD_MONEY
): (T & { computed: TradeComputed })[] {
  return trades.map(t => {
    const classification = classifyTrade(t, beThresholdR, beThresholdMoney);
    const planned = calcRR(t, "planned");
    const entry = Number(t.entry);
    const sl = Number(t.sl);
    const structured = !!(entry && !isNaN(entry) && sl && !isNaN(sl) && sl !== entry);

    return {
      ...t,
      computed: {
        result: classification.result,
        method: classification.method,
        realizedR: classification.realizedR,
        plannedRR: planned.valid ? planned.value : null,
        structured,
      },
    };
  });
}

// Backward-compat alias during migration — remove once no callers reference it
export const withClassification = withComputed;
</br>