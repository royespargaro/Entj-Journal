export const PAIR_CONFIG = {
  'XAUUSD': { multiplier: 100, digits: 2, pipSize: 0.1 },
  'BTCUSD': { multiplier: 1, digits: 2, pipSize: 1 },
  'EURUSD': { multiplier: 100000, digits: 5, pipSize: 0.0001 },
  'GBPUSD': { multiplier: 100000, digits: 5, pipSize: 0.0001 },
  'NAS100': { multiplier: 20, digits: 2, pipSize: 0.1 },
  'US30':   { multiplier: 10, digits: 2, pipSize: 1 },
  'ETHUSD': { multiplier: 1, digits: 2, pipSize: 1 },
};

export const CURRENCIES = {
  // Standard currencies
  USD: { symbol: '$',    code: 'USD', rate: 1,        name: 'US Dollar',        isCent: false },
  EUR: { symbol: '€',    code: 'EUR', rate: 0.93,     name: 'Euro',             isCent: false },
  GBP: { symbol: '£',    code: 'GBP', rate: 0.81,     name: 'British Pound',    isCent: false },
  JPY: { symbol: '¥',    code: 'JPY', rate: 155.50,   name: 'Japanese Yen',     isCent: false },
  AUD: { symbol: 'A$',   code: 'AUD', rate: 1.54,     name: 'Australian Dollar', isCent: false },
  CAD: { symbol: 'C$',   code: 'CAD', rate: 1.37,     name: 'Canadian Dollar',  isCent: false },
  CHF: { symbol: 'CHf',  code: 'CHF', rate: 0.91,     name: 'Swiss Franc',      isCent: false },
  CNY: { symbol: '¥',    code: 'CNY', rate: 7.23,     name: 'Chinese Yuan',     isCent: false },
  INR: { symbol: '₹',    code: 'INR', rate: 83.50,    name: 'Indian Rupee',     isCent: false },
  IDR: { symbol: 'Rp',   code: 'IDR', rate: 16250,    name: 'Indonesian Rupiah', isCent: false },
  HKD: { symbol: 'HK$',  code: 'HKD', rate: 7.82,     name: 'Hong Kong Dollar', isCent: false },
  SGD: { symbol: 'S$',   code: 'SGD', rate: 1.35,     name: 'Singapore Dollar', isCent: false },
  NZD: { symbol: 'NZ$',  code: 'NZD', rate: 1.66,     name: 'New Zealand Dollar', isCent: false },
  BRL: { symbol: 'R$',   code: 'BRL', rate: 5.12,     name: 'Brazilian Real',   isCent: false },
  SAR: { symbol: 'SR',   code: 'SAR', rate: 3.75,     name: 'Saudi Riyal',      isCent: false },
  AED: { symbol: 'DH',   code: 'AED', rate: 3.67,     name: 'UAE Dirham',       isCent: false },

  // Cent accounts — 1 cent = 0.01 of parent currency
  USC: { symbol: '¢',    code: 'USC', rate: 100,      name: 'US Cents (Cent Account)',    isCent: true, parentCurrency: 'USD' },
EUC: { symbol: 'c€',   code: 'EUC', rate: 93,       name: 'Euro Cents (Cent Account)',  isCent: true, parentCurrency: 'EUR' },
GBC: { symbol: 'p',    code: 'GBC', rate: 81,       name: 'GBP Pence (Cent Account)',   isCent: true, parentCurrency: 'GBP' },
IDC: { symbol: 'sen',  code: 'IDC', rate: 1625000,  name: 'IDR Cents (Cent Account)',   isCent: true, parentCurrency: 'IDR' },
};

// ── DST Helpers ───────────────────────────────────────────────────────────────

function lastSundayOf(year: number, month: number): Date {
  // month: 0-indexed (2 = March, 9 = October, 10 = November)
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const dayOfWeek = lastDay.getUTCDay(); // 0 = Sunday
  lastDay.setUTCDate(lastDay.getUTCDate() - dayOfWeek);
  return lastDay;
}

function nthSundayOf(year: number, month: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const daysUntilSunday = (7 - first.getUTCDay()) % 7;
  first.setUTCDate(1 + daysUntilSunday + (n - 1) * 7);
  return first;
}

// UK: clocks forward last Sunday March 01:00 UTC → last Sunday October 01:00 UTC
function isUKSummerTime(date: Date): boolean {
  const y = date.getUTCFullYear();
  const start = lastSundayOf(y, 2);  // last Sunday March
  const end   = lastSundayOf(y, 9);  // last Sunday October
  start.setUTCHours(1); end.setUTCHours(1);
  return date >= start && date < end;
}

// US: clocks forward 2nd Sunday March 07:00 UTC → 1st Sunday November 06:00 UTC
function isUSSummerTime(date: Date): boolean {
  const y = date.getUTCFullYear();
  const start = nthSundayOf(y, 2, 2);   // 2nd Sunday March
  const end   = nthSundayOf(y, 10, 1);  // 1st Sunday November
  start.setUTCHours(7); end.setUTCHours(6);
  return date >= start && date < end;
}

// ── Session Times (UTC) ───────────────────────────────────────────────────────
//
//  Session     Winter (UTC)      Summer (UTC)      DST observed?
//  Sydney      21:00 – 06:00     22:00 – 07:00     Yes (southern hemisphere — opposite season)
//  Tokyo       00:00 – 09:00     00:00 – 09:00     No — never shifts
//  London      08:00 – 17:00     07:00 – 16:00     Yes (UK BST)
//  New York    13:00 – 22:00     12:00 – 21:00     Yes (US EDT)
//
//  Overlaps:
//  Sydney–Tokyo     00:00 – 02:00 UTC  (AUD/JPY, NZD/JPY)
//  Tokyo–London     07:00 – 09:00 UTC  (EUR/JPY, GBP/JPY)
//  London–New York  12:00 – 16:00 UTC  ← Highest volume. XAU/USD, EUR/USD, GBP/USD

export interface SessionConfig {
  name:             string;
  open:             number; // UTC hour
  close:            number; // UTC hour
  crossesMidnight:  boolean;
  color:            string;
  bg:               string;
  border:           string;
  dot:              string;
  pairs:            string; // most active pairs
}

export function getSessionTimes(date: Date = new Date()): Record<string, SessionConfig> {
  const ukDST = isUKSummerTime(date);
  const usDST = isUSSummerTime(date);

  return {
    sydney: {
      name:            'Sydney',
      // Sydney is in southern hemisphere — its summer is our winter
      // When UK is in summer (northern summer), Sydney is in winter → opens 22:00 UTC
      // When UK is in winter (northern winter), Sydney is in summer → opens 21:00 UTC
      open:            ukDST ? 22 : 21,
      close:           ukDST ?  7 :  6,
      crossesMidnight: true,
      color:  'text-orange-300',
      bg:     'bg-orange-300/10',
      border: 'border-orange-300/20',
      dot:    'bg-orange-300',
      pairs:  'AUD/USD, NZD/USD',
    },
    tokyo: {
      name:            'Tokyo',
      open:            0,   // never changes — Tokyo has no DST
      close:           9,
      crossesMidnight: false,
      color:  'text-pink-400',
      bg:     'bg-pink-400/10',
      border: 'border-pink-400/20',
      dot:    'bg-pink-400',
      pairs:  'USD/JPY, EUR/JPY',
    },
    london: {
      name:            'London',
      open:            ukDST ?  7 :  8,
      close:           ukDST ? 16 : 17,
      crossesMidnight: false,
      color:  'text-green-400',
      bg:     'bg-green-400/10',
      border: 'border-green-400/20',
      dot:    'bg-green-400',
      pairs:  'EUR/USD, GBP/USD, XAU/USD',
    },
    newYork: {
      name:            'New York',
      open:            usDST ? 12 : 13,
      close:           usDST ? 21 : 22,
      crossesMidnight: false,
      color:  'text-blue-400',
      bg:     'bg-blue-400/10',
      border: 'border-blue-400/20',
      dot:    'bg-blue-400',
      pairs:  'EUR/USD, USD/CAD, XAU/USD',
    },
  };
}

export function isSessionActive(session: SessionConfig, utcHour: number): boolean {
  if (session.crossesMidnight) {
    return utcHour >= session.open || utcHour < session.close;
  }
  return utcHour >= session.open && utcHour < session.close;
}

export interface OverlapConfig {
  name:   string;
  color:  string;
  bg:     string;
  border: string;
  dot:    string;
  desc:   string;
  open:   number;
  close:  number;
}

export function getActiveOverlaps(utcHour: number, date: Date = new Date()): OverlapConfig[] {
  const times  = getSessionTimes(date);
  const active = Object.values(times).filter(s => isSessionActive(s, utcHour));
  const has    = (name: string) => active.some(s => s.name === name);
  const result: OverlapConfig[] = [];

  if (has('Sydney') && has('Tokyo')) result.push({
    name: 'Sydney–Tokyo', color: 'text-purple-400', bg: 'bg-purple-400/10',
    border: 'border-purple-400/20', dot: 'bg-purple-400',
    desc: 'AUD/JPY, NZD/JPY active',
    open: times.tokyo.open, close: times.sydney.close
  });

  if (has('Tokyo') && has('London')) result.push({
    name: 'Tokyo–London', color: 'text-yellow-400', bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/20', dot: 'bg-yellow-400',
    desc: 'EUR/JPY, GBP/JPY active',
    open: times.london.open, close: times.tokyo.close
  });

  if (has('London') && has('New York')) result.push({
    name: 'London–NY ⚡', color: 'text-emerald-400', bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20', dot: 'bg-emerald-400',
    desc: 'Peak volume — EUR/USD, XAU/USD',
    open: times.newYork.open, close: times.london.close
  });

  return result;
}

// ── getCurrentSessions — backward compatible ──────────────────────────────────
// Used in SetupForm, CloseTradeFinalizer, etc. Returns string[] of active names.
export function getCurrentSessions(): string[] {
  const now      = new Date();
  const utcHour  = now.getUTCHours();
  const times    = getSessionTimes(now);
  const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;
  if (isWeekend) return [];
  return Object.values(times)
    .filter(s => isSessionActive(s, utcHour))
    .map(s => s.name);
}

// ── SESSIONS array — backward compatible ──────────────────────────────────────
// Used in SetupCard session badge rendering. Shape matches original.
export const SESSIONS = [
  { name: 'Sydney',   color: 'bg-orange-300/10 text-orange-300 border-orange-300/20' },
  { name: 'Tokyo',    color: 'bg-pink-400/10   text-pink-400   border-pink-400/20'   },
  { name: 'London',   color: 'bg-green-400/10  text-green-400  border-green-400/20'  },
  { name: 'New York', color: 'bg-blue-400/10   text-blue-400   border-blue-400/20'   },
];