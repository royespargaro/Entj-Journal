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

import { convertCurrency, formatNum, formatCurrency, cleanMoney, calcRR, avgRR } from './lib/utils';

export function calcRR(
  trade: {
    entry?: number | string;
    exit?:  number | string;
    sl?:    number | string;
    tp?:    number | string;
    dir?:   string;
    pnl?:   number | string;
    lot?:   number | string;
    pair?:  string;
  },
  type: 'planned' | 'actual' = 'actual'
): { value: number; method: 'sl' | 'inferred' | null } | null {

  const entry      = Number(trade.entry)  || 0;
  const exit       = Number(trade.exit)   || 0;
  const sl         = Number(trade.sl)     || 0;
  const tp         = Number(trade.tp)     || 0;
  const pnl        = cleanMoney(trade.pnl);
  const lot        = Number(trade.lot)    || 0;
  const isLong     = trade.dir === 'Long';
  const config     = PAIR_CONFIG[(trade.pair || '') as keyof typeof PAIR_CONFIG];
  const multiplier = config?.multiplier || 1;

  if (!entry || !exit) return null;

  const rewardPrice = isLong ? (exit - entry) : (entry - exit);

  // Method 1 — SL is stored
  if (sl && sl !== entry) {
    const riskPrice = Math.abs(entry - sl);
    if (riskPrice === 0) return null;

    if (type === 'planned' && tp && tp !== entry) {
      const plannedReward = isLong ? (tp - entry) : (entry - tp);
      if (plannedReward <= 0) return null;
      return { value: plannedReward / riskPrice, method: 'sl' };
    }

    return { value: rewardPrice / riskPrice, method: 'sl' };
  }

  // Method 2 — Infer risk from PnL + lot (actual only)
  if (type === 'actual' && pnl && lot) {
    const inferredRisk = Math.abs(pnl) / (lot * multiplier);
    if (inferredRisk === 0) return null;
    return { value: rewardPrice / inferredRisk, method: 'inferred' };
  }

  return null;
}

export function avgRR(
  trades: any[],
  type: 'planned' | 'actual' = 'actual'
): number | null {
  const values = trades
    .map(t => calcRR(t, type))
    .filter((r): r is NonNullable<ReturnType<typeof calcRR>> =>
      r !== null && isFinite(r.value) && Math.abs(r.value) < 50
    )
    .map(r => r.value);

  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}