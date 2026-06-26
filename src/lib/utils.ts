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

/**
 * Calculate the Risk-Reward ratio for a trade.
 * 
 * This function prioritizes actual exit prices over planned TP/SL.
 * 
 * LOGIC:
 * 1. If SL exists AND type='planned' → use planned TP/SL
 * 2. If SL exists AND type='actual' → use actual exit for reward, SL for risk
 * 3. If NO SL but has PnL and lot:
 *    a. For losing trades → return -1R (you lost exactly your risk)
 *    b. For winning trades → use fallback risk estimate or return null
 * 4. If all else fails → return null
 */
export function calcRR(
  trade: {
    entry?: number | string;
    exit?: number | string;
    sl?: number | string;
    tp?: number | string;
    dir?: string;
    pnl?: number | string;
    lot?: number | string;
    pair?: string;
    currency?: string;
  },
  type: 'planned' | 'actual' = 'actual'
): { value: number; method: 'sl' | 'inferred' | 'manual_exit' | 'fallback' | null } | null {

  const entry = Number(trade.entry) || 0;
  const exit = Number(trade.exit) || 0;
  const sl = Number(trade.sl) || 0;
  const tp = Number(trade.tp) || 0;
  const pnl = cleanMoney(trade.pnl);
  const lot = Number(trade.lot) || 0;
  const isLong = trade.dir === 'Long';
  const config = PAIR_CONFIG[(trade.pair || '') as keyof typeof PAIR_CONFIG];
  const multiplier = config?.multiplier || 1;
  const currency = trade.currency || 'USD';

  // --- VALIDATION ---
  if (!entry) return null;
  
  // For 'actual' type, we need exit OR pnl+lot
  if (type === 'actual' && !exit && (!pnl || !lot)) return null;
  
  // For 'planned' type, we need TP and SL
  if (type === 'planned' && (!tp || !sl)) return null;

  // --- CALCULATE ACTUAL REWARD (if exit exists) ---
  const rewardPrice = exit ? (isLong ? (exit - entry) : (entry - exit)) : 0;
  const isWin = rewardPrice > 0;

  // --- PRIORITY 1: SL is available (most accurate) ---
  if (sl && sl !== entry) {
    const riskPrice = Math.abs(entry - sl);
    if (riskPrice === 0) return null;

    // Planned RR: Use TP for reward
    if (type === 'planned' && tp && tp !== entry) {
      const plannedReward = isLong ? (tp - entry) : (entry - tp);
      if (plannedReward <= 0) return null;
      return { value: plannedReward / riskPrice, method: 'sl' };
    }

    // Actual RR: Use actual exit for reward
    if (type === 'actual' && exit) {
      return { value: rewardPrice / riskPrice, method: 'sl' };
    }
    
    // If actual but no exit, but we have pnl+lot
    if (type === 'actual' && pnl && lot) {
      const pnlInPips = pnl / (lot * multiplier);
      const rewardInPips = isLong ? pnlInPips : -pnlInPips; // For shorts, pnl is negative when price goes up
      if (rewardInPips > 0) {
        return { value: rewardInPips / (riskPrice / multiplier), method: 'sl' };
      } else {
        // Losing trade with SL = -1R exactly
        return { value: -1, method: 'sl' };
      }
    }
  }

  // --- PRIORITY 2: NO SL — Infer from PnL + Lot ---
  if (type === 'actual' && pnl && lot) {
    const pnlValue = Number(pnl);
    const pnlInPips = pnlValue / (lot * multiplier);
    
    // If we have exit, calculate reward directly
    if (exit && rewardPrice !== 0) {
      // Losing trade: we know exactly how much was risked
      if (pnlValue < 0) {
        // The risk was exactly the loss amount
        const riskPrice = Math.abs(pnlInPips) * multiplier;
        return { value: -1, method: 'inferred' };
      }
      
      // Winning trade without SL: use fallback risk
      const fallbackRisk = getFallbackRisk(entry, trade.pair);
      const riskPrice = fallbackRisk * multiplier;
      return { value: rewardPrice / riskPrice, method: 'fallback' };
    }
    
    // No exit, but we have PnL and lot
    // Losing trade: always -1R
    if (pnlValue < 0) {
      return { value: -1, method: 'inferred' };
    }
    
    // Winning trade without exit: use fallback
    const fallbackRisk = getFallbackRisk(entry, trade.pair);
    const riskPrice = fallbackRisk * multiplier;
    // Estimate reward from PnL
    const rewardPrice = Math.abs(pnlInPips) * multiplier;
    return { value: rewardPrice / riskPrice, method: 'fallback' };
  }

  return null;
}

/**
 * Get a fallback risk estimate when no SL is available.
 * Uses a percentage of entry price (1%) or minimum pip value.
 */
function getFallbackRisk(entry: number, pair?: string): number {
  if (!entry) return 10; // Default 10 pips
  
  const config = PAIR_CONFIG[(pair || '') as keyof typeof PAIR_CONFIG];
  const multiplier = config?.multiplier || 1;
  
  // Use 1% of entry price as fallback risk
  const percentRisk = Math.abs(entry) * 0.01;
  const minRisk = 10 * multiplier; // Minimum 10 pips
  
  return Math.max(percentRisk, minRisk);
}

/**
 * Calculate average RR across multiple trades.
 * 
 * Handles trades with missing SL/TP by using fallback calculations.
 * Losing trades always contribute -1R.
 * Winning trades without SL use fallback risk estimates.
 */
export function avgRR(
  trades: any[],
  type: 'planned' | 'actual' = 'actual'
): number | null {
  if (!trades || trades.length === 0) return null;

  const values = trades
    .map(t => calcRR(t, type))
    .filter((r): r is NonNullable<ReturnType<typeof calcRR>> =>
      r !== null && 
      isFinite(r.value) && 
      Math.abs(r.value) < 100 && // Cap extreme values
      r.value !== 0 // Exclude breakeven
    )
    .map(r => r.value);

  if (!values.length) return null;
  
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Get detailed RR statistics including breakdown by trade.
 * Useful for debugging and showing users their RR distribution.
 */
export function getRRStats(
  trades: any[],
  type: 'planned' | 'actual' = 'actual'
): {
  average: number | null;
  total: number;
  byMethod: Record<string, { count: number; avg: number; sum: number }>;
  values: number[];
} {
  const results = trades
    .map(t => calcRR(t, type))
    .filter((r): r is NonNullable<ReturnType<typeof calcRR>> =>
      r !== null && isFinite(r.value) && Math.abs(r.value) < 100
    );

  const values = results.map(r => r.value);
  const byMethod: Record<string, { count: number; avg: number; sum: number }> = {};
  
  results.forEach(r => {
    const method = r.method || 'unknown';
    if (!byMethod[method]) byMethod[method] = { count: 0, avg: 0, sum: 0 };
    byMethod[method].count++;
    byMethod[method].sum += r.value;
    byMethod[method].avg = byMethod[method].sum / byMethod[method].count;
  });

  return {
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    total: values.length,
    byMethod,
    values
  };
}

/**
 * Get a human-readable description of a trade's RR calculation method.
 */
export function getRRMethodLabel(method: string | null): string {
  switch (method) {
    case 'sl': return 'Stop Loss';
    case 'inferred': return 'Inferred from PnL';
    case 'manual_exit': return 'Manual Exit';
    case 'fallback': return 'Estimated (1% Risk)';
    default: return 'Unknown';
  }
}