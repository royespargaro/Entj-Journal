import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getSessionTimes, isSessionActive, getActiveOverlaps } from '../constants';

// ── ICT Kill Zone definitions (all times in UTC) ─────────────────────────────
// Reference: ICT methodology by Michael Huddleston
// All times auto-adjust for DST via getSessionTimes()

function getKillZones(date: Date) {
  const ukDST = isUKSummerTime(date);
  const usDST = isUSSummerTime(date);

  return [
    {
      id:      'asian',
      name:    'Asian Kill Zone',
      short:   'Asia KZ',
      // 8:00–10:00 PM EST = 00:00–02:00 UTC (winter) / 01:00–03:00 UTC (summer)
      open:    usDST ? 1  : 0,
      close:   usDST ? 3  : 2,
      color:   'text-orange-300',
      bg:      'bg-orange-300/10',
      border:  'border-orange-300/30',
      dot:     'bg-orange-300',
      glow:    'rgba(253,186,116,0.15)',
      pairs:   ['USD/JPY', 'AUD/USD', 'NZD/USD'],
      intel:   'Range building. USD consolidates. Mark highs & lows —  will target these.',
      what:    'Asian Range Formation',
      icon:    '🥢',
      pip:     '15–20 pip scalp potential',
    },
    {
      id:      'london',
      name:    'London Kill Zone',
      short:   'London KZ',
      // 2:00–5:00 AM EST = 07:00–10:00 UTC (winter) / 06:00–09:00 UTC (summer)
      open:    usDST ? 6  : 7,
      close:   usDST ? 9  : 10,
      color:   'text-green-400',
      bg:      'bg-green-400/10',
      border:  'border-green-400/30',
      dot:     'bg-green-400',
      glow:    'rgba(74,222,128,0.15)',
      pairs:   ['EUR/USD', 'GBP/USD', 'XAU/USD', 'EUR/GBP'],
      intel:   'Judas Swing likely. Expect sweep of Asian high/low before true daily direction reveals.',
      what:    'Daily Bias Formation',
      icon:    '🇬🇧',
      pip:     '25–50 pip move potential',
    },
    {
      id:      'newyork',
      name:    'New York Kill Zone',
      short:   'NY KZ',
      // 7:00–10:00 AM EST = 12:00–15:00 UTC (winter) / 11:00–14:00 UTC (summer)
      open:    usDST ? 11 : 12,
      close:   usDST ? 14 : 15,
      color:   'text-blue-400',
      bg:      'bg-blue-400/10',
      border:  'border-blue-400/30',
      dot:     'bg-blue-400',
      glow:    'rgba(96,165,250,0.15)',
      pairs:   ['EUR/USD', 'GBP/USD', 'USD/CAD', 'NAS100', 'XAU/USD'],
      intel:   'London continuation or reversal. 8:30 AM EST news spikes create FVG entries. Peak volume window.',
      what:    'Peak Volume & News',
      icon:    '🗽',
      pip:     '20–30 pip move potential',
    },
    {
      id:      'londonclose',
      name:    'London Close Kill Zone',
      short:   'London Close',
      // 10:00 AM–12:00 PM EST = 15:00–17:00 UTC (winter) / 14:00–16:00 UTC (summer)
      open:    usDST ? 14 : 15,
      close:   usDST ? 16 : 17,
      color:   'text-purple-400',
      bg:      'bg-purple-400/10',
      border:  'border-purple-400/30',
      dot:     'bg-purple-400',
      glow:    'rgba(192,132,252,0.15)',
      pairs:   ['EUR/USD', 'GBP/USD', 'EUR/GBP'],
      intel:   'Position squaring. London banks close books. Can produce sharp reversals or continuation swing entries.',
      what:    'Position Squaring',
      icon:    '💂‍♀️',
      pip:     'Reversal or continuation',
    },
  ];
}

// DST helpers (duplicated here so component is self-contained)
function lastSundayOf(year: number, month: number): Date {
  const d = new Date(Date.UTC(year, month + 1, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}
function nthSundayOf(year: number, month: number, n: number): Date {
  const d = new Date(Date.UTC(year, month, 1));
  const offset = (7 - d.getUTCDay()) % 7;
  d.setUTCDate(1 + offset + (n - 1) * 7);
  return d;
}
function isUKSummerTime(date: Date): boolean {
  const y = date.getUTCFullYear();
  const start = lastSundayOf(y, 2); start.setUTCHours(1);
  const end   = lastSundayOf(y, 9); end.setUTCHours(1);
  return date >= start && date < end;
}
function isUSSummerTime(date: Date): boolean {
  const y = date.getUTCFullYear();
  const start = nthSundayOf(y, 2, 2);  start.setUTCHours(7);
  const end   = nthSundayOf(y, 10, 1); end.setUTCHours(6);
  return date >= start && date < end;
}

function isKillZoneActive(kz: { open: number; close: number }, utcHour: number): boolean {
  if (kz.open > kz.close) return utcHour >= kz.open || utcHour < kz.close;
  return utcHour >= kz.open && utcHour < kz.close;
}

function minsUntil(targetHour: number, utcHour: number, utcMin: number): number {
  const nowMins    = utcHour * 60 + utcMin;
  const targetMins = targetHour * 60;
  let diff = targetMins - nowMins;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function ProgressRing({ pct, color, size = 40 }: { pct: number; color: string; size?: number }) {
  const r   = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={dash}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </svg>
  );
}

export default function KillZoneTicker() {
  const [now, setNow]             = useState(new Date());
  const [expanded, setExpanded]   = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'schedule'>('live');

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcS = now.getUTCSeconds();
  const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;

  const killZones     = useMemo(() => getKillZones(now), [utcH]);
  const sessionTimes  = useMemo(() => getSessionTimes(now), [utcH]);
  const activeKZs     = killZones.filter(kz => isKillZoneActive(kz, utcH));
  const activeSessions = Object.values(sessionTimes).filter(s => isSessionActive(s, utcH));
  const overlaps      = getActiveOverlaps(utcH, now);

  // Next kill zone
  const nextKZ = useMemo(() => {
    if (activeKZs.length > 0) return null;
    return killZones
      .map(kz => ({ ...kz, mins: minsUntil(kz.open, utcH, utcM) }))
      .sort((a, b) => a.mins - b.mins)[0];
  }, [killZones, utcH, utcM, activeKZs]);

  // Progress through active KZ
  const kzProgress = (kz: typeof killZones[0]) => {
    const totalMins = ((kz.close - kz.open + 24) % 24) * 60;
    const elapsed   = ((utcH - kz.open + 24) % 24) * 60 + utcM;
    return Math.min(100, Math.round((elapsed / totalMins) * 100));
  };

  const utcClock = `${String(utcH).padStart(2,'0')}:${String(utcM).padStart(2,'0')}:${String(utcS).padStart(2,'0')}`;

  // Color map for progress ring
  const colorMap: Record<string, string> = {
    'text-orange-300': '#fdba74',
    'text-green-400':  '#4ade80',
    'text-blue-400':   '#60a5fa',
    'text-purple-400': '#c084fc',
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-spotify-card backdrop-blur-md w-full">

      {/* ── COMPACT BAR ── */}
      <div
        className="flex items-center gap-2 px-3 py-3 cursor-pointer select-none flex-wrap sm:gap-3 sm:px-4"
        onClick={() => setExpanded(e => !e)}
      >
        {/* UTC Clock */}
        <div className="flex items-center gap-2 pr-2 border-r border-white/10 shrink-0 sm:pr-4">
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-spotify-green"
          />
          <span className="text-[9px] font-black font-mono text-white/70 tracking-widest sm:text-[10px]">
            UTC {utcClock}
          </span>
        </div>

        {isWeekend ? (
          <span className="text-[9px] font-black text-white/50 uppercase tracking-widest sm:text-[10px]">
            Weekend — Markets Closed
          </span>
        ) : activeKZs.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap sm:gap-2">
            {activeKZs.map(kz => (
              <motion.div
                key={kz.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${kz.bg} ${kz.border} sm:px-3 sm:py-1.5`}
              >
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className={`w-1.5 h-1.5 rounded-full ${kz.dot}`}
                />
                <span className={`text-[8px] font-black uppercase tracking-widest ${kz.color} sm:text-[9px]`}>
                  ⚡ {kz.short}
                </span>
                <span className={`text-[8px] font-mono ${kz.color} opacity-80 sm:text-[9px]`}>
                  {kzProgress(kz)}%
                </span>
              </motion.div>
            ))}
            {overlaps.map(o => (
              <div key={o.name} className={`flex items-center gap-1 px-2 py-1 rounded-full border ${o.bg} ${o.border} sm:gap-1.5 sm:px-3 sm:py-1.5`}>
                <span className={`text-[8px] font-black uppercase tracking-widest ${o.color} sm:text-[9px]`}>
                  {o.name}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-[9px] font-black text-white/50 uppercase tracking-widest sm:text-[10px]">
              Between Kill Zones
            </span>
            {nextKZ && (
              <span className={`text-[9px] font-black uppercase tracking-widest ${nextKZ.color} sm:text-[10px]`}>
                {nextKZ.icon} {nextKZ.short} in {formatDuration(minsUntil(nextKZ.open, utcH, utcM))}
              </span>
            )}
          </div>
        )}

        <span className="text-[9px] text-white/30 ml-auto shrink-0 transition-transform sm:text-[9px]">
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* ── EXPANDED PANEL ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-white/5"
          >
            {/* Tab bar */}
            <div className="flex border-b border-white/5">
              {(['live', 'schedule'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                    activeTab === tab
                      ? 'text-white border-b-2 border-spotify-green'
                      : 'text-white/20 hover:text-white/40'
                  }`}
                >
                  {tab === 'live' ? 'Live Intelligence' : 'Full Schedule'}
                </button>
              ))}
            </div>

            {/* ── LIVE TAB ── */}
            {activeTab === 'live' && (
              <div className="p-5 space-y-4">
                {isWeekend ? (
                  <div className="text-center py-10 space-y-2">
                    <p className="text-3xl">😴</p>
                    <p className="text-sm font-black text-white/40 uppercase tracking-widest">Markets Closed</p>
                    <p className="text-[10px] text-white/20">Opens Sunday 22:00 UTC</p>
                  </div>
                ) : (
                  <>
                    {activeKZs.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Active Now</p>
                        {activeKZs.map(kz => {
                          const pct      = kzProgress(kz);
                          const minsLeft = ((kz.close - utcH + 24) % 24) * 60 - utcM;
                          return (
                            <motion.div
                              key={kz.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`rounded-2xl border p-5 space-y-4`}
                              style={{ background: `radial-gradient(ellipse at top right, ${kz.glow} 0%, transparent 60%), #111` }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <ProgressRing pct={pct} color={colorMap[kz.color] || '#4ade80'} size={44} />
                                    <span className="absolute inset-0 flex items-center justify-center text-sm">{kz.icon}</span>
                                  </div>
                                  <div>
                                    <p className={`text-xs font-black uppercase tracking-widest ${kz.color}`}>{kz.name}</p>
                                    <p className="text-[10px] text-white/40 font-bold">{kz.what}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={`text-lg font-black font-mono ${kz.color}`}>{pct}%</p>
                                  <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">
                                    {formatDuration(minsLeft)} left
                                  </p>
                                </div>
                              </div>

                              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 1 }}
                                  className={`h-full rounded-full ${kz.dot}`}
                                />
                              </div>

                              <div className={`rounded-xl p-3 border ${kz.border} ${kz.bg}`}>
                                <p className={`text-[9px] font-black uppercase tracking-widest ${kz.color} mb-1`}>ICT Intel</p>
                                <p className="text-[11px] text-white/60 font-bold leading-relaxed">{kz.intel}</p>
                              </div>

                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-2">Hot Pairs</p>
                                <div className="flex flex-wrap gap-2">
                                  {kz.pairs.map(p => (
                                    <span key={p} className={`text-[9px] font-black px-2.5 py-1 rounded-lg border ${kz.border} ${kz.bg} ${kz.color}`}>
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[9px] font-black text-white/20 uppercase tracking-widest pt-1 border-t border-white/5">
                                <span>{String(kz.open).padStart(2,'0')}:00 – {String(kz.close).padStart(2,'0')}:00 UTC</span>
                                <span>{kz.pip}</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center space-y-3">
                        <p className="text-2xl">🌙</p>
                        <p className="text-sm font-black text-white/30 uppercase tracking-widest">Dead Zone — Low Probability</p>
                        <p className="text-[10px] text-white/20 leading-relaxed max-w-xs mx-auto">
                          No kill zone active. Avoid trading. Price action is thin, spreads are wide, and setups are unreliable.
                        </p>
                        {nextKZ && (
                          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${nextKZ.border} ${nextKZ.bg} mt-2`}>
                            <span className="text-xl">{nextKZ.icon}</span>
                            <div className="text-left">
                              <p className={`text-[9px] font-black uppercase tracking-widest ${nextKZ.color}`}>{nextKZ.name}</p>
                              <p className="text-[10px] font-black text-white/40">
                                Opens in {formatDuration(minsUntil(nextKZ.open, utcH, utcM))}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {overlaps.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Active Overlaps</p>
                        {overlaps.map(o => (
                          <div key={o.name} className={`flex items-center justify-between p-3 rounded-xl border ${o.border} ${o.bg}`}>
                            <div className="flex items-center gap-2">
                              <motion.div
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                                className={`w-2 h-2 rounded-full ${o.dot}`}
                              />
                              <span className={`text-[10px] font-black uppercase tracking-widest ${o.color}`}>{o.name}</span>
                            </div>
                            <span className="text-[9px] text-white/30 font-bold">{o.desc}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-2">Market Context</p>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.values(sessionTimes).map(s => {
                          const active = isSessionActive(s, utcH);
                          return (
                            <div key={s.name} className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${active ? s.dot : 'bg-white/10'}`} />
                              <span className={`text-[9px] font-bold ${active ? s.color : 'text-white/20'}`}>{s.name}</span>
                              <span className="text-[8px] text-white/15 ml-auto font-mono">
                                {String(s.open).padStart(2,'0')}–{String(s.close).padStart(2,'0')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── SCHEDULE TAB ── */}
            {activeTab === 'schedule' && (
              <div className="p-5 space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-4">
                  All times UTC · DST auto-adjusted · {isUKSummerTime(now) ? 'UK on BST' : 'UK on GMT'} · {isUSSummerTime(now) ? 'US on EDT' : 'US on EST'}
                </p>

                {killZones.map((kz, i) => {
                  const active   = isKillZoneActive(kz, utcH) && !isWeekend;
                  const upcoming = !active && minsUntil(kz.open, utcH, utcM) < 120;
                  return (
                    <motion.div
                      key={kz.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={`rounded-2xl border p-4 transition-all ${
                        active   ? `${kz.bg} ${kz.border}` :
                        upcoming ? 'bg-white/[0.03] border-white/10' :
                                   'bg-transparent border-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{kz.icon}</span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-xs font-black ${active ? kz.color : 'text-white/50'}`}>{kz.name}</p>
                              {active && (
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${kz.bg} ${kz.color} border ${kz.border} uppercase tracking-widest`}>
                                  LIVE
                                </span>
                              )}
                              {upcoming && !active && (
                                <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 uppercase tracking-widest">
                                  Soon
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] font-mono text-white/30 mt-0.5">
                              {String(kz.open).padStart(2,'0')}:00 – {String(kz.close).padStart(2,'0')}:00 UTC
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {active ? (
                            <p className={`text-[10px] font-black ${kz.color}`}>
                              {formatDuration(((kz.close - utcH + 24) % 24) * 60 - utcM)} left
                            </p>
                          ) : (
                            <p className="text-[10px] font-black text-white/20">
                              in {formatDuration(minsUntil(kz.open, utcH, utcM))}
                            </p>
                          )}
                        </div>
                      </div>

                      {(active || upcoming) && (
                        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                          <p className="text-[10px] text-white/40 leading-relaxed">{kz.intel}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {kz.pairs.map(p => (
                              <span key={p} className={`text-[8px] font-black px-2 py-0.5 rounded-md border ${kz.border} ${kz.bg} ${kz.color} opacity-80`}>
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {/* ICT concepts reference */}
                <div className="mt-4 rounded-2xl bg-white/[0.02] border border-white/5 p-5 space-y-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20">ICT Concepts Reference</p>
                  {[
                    { term: 'Judas Swing', def: 'False move at London open that sweeps Asian range before reversing to true daily direction.' },
                    { term: 'Asian Range', def: 'High & low formed during Asian session. London targets these for liquidity sweeps.' },
                    { term: 'Kill Zone', def: 'High-probability 2–3hr window when institutional algorithms execute. Outside = low probability.' },
                    { term: 'Dead Zone', def: 'Between kill zones. Spreads wide, price random. Avoid entries.' },
                    { term: 'London–NY Overlap', def: '12:00–16:00 UTC. Highest volume of the day. Most reliable XAU/USD and EUR/USD moves.' },
                  ].map(c => (
                    <div key={c.term} className="flex gap-3">
                      <span className="text-[9px] font-black text-spotify-green uppercase tracking-widest shrink-0 w-28">{c.term}</span>
                      <span className="text-[10px] text-white/30 leading-relaxed">{c.def}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
