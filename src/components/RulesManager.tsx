import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, Save, AlertCircle, Info } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../App';
import { Rules } from '../types';
import { CURRENCIES } from '../constants';
import { convertCurrency, formatCurrency } from '../lib/utils';

const SESSIONS = ['Asia', 'London', 'New York'];
const SETUPS = ["OB Bullish", "OB Bearish", "Breaker Block", "Mitigation Block", "FVG Bullish", "FVG Bearish", "IFVG", "Liquidity Sweep Long", "Liquidity Sweep Short", "Stop Hunt", "Equal Highs/Lows (EQH/EQL)", "BOS Long", "BOS Short", "CHoCH Long", "CHoCH Short", "MSS", "OTE (61.8-79% fib)", "PD Arrays", "NWOG/NDOG", "Silver Bullet", "Planned Strategy", "News Trade", "Custom"];
const EMOTIONS = [
  'Calm / Confident',
  'Excited / Rushed',
  'Fearful / Hesitant',
  'Revenge',
  'Neutral',
  'FOMO',
  'Overconfident',
  'Bored / Impatient',
  'Anxious',
  'Frustrated',
  'Greedy'
];

export const RulesManager = ({ isOpen, onClose, showToast, displayCurrency }: {
  isOpen: boolean,
  onClose: () => void,
  showToast: (msg: string, type?: 'success' | 'error') => void,
  displayCurrency: string
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<Rules>({
    maxDailyLoss: 0,
    maxDailyLossType: "$",
    accountBalance: 0,
    accountCurrency: displayCurrency || 'USD',
    maxTradesPerDay: 0,
    allowedSessions: [],
    allowedSetups: [],
    flaggedEmotions: [],
    noTradingDuringNews: false,
  });

  useEffect(() => {
    if (isOpen && auth.currentUser) {
      setLoading(true);
      const fetchRules = async () => {
        try {
          const docRef = doc(db, 'users', auth.currentUser!.uid, 'settings', 'rules');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as any;
            // migrate blockedEmotions → flaggedEmotions for existing users
            if (data.blockedEmotions && !data.flaggedEmotions) {
              data.flaggedEmotions = data.blockedEmotions;
              delete data.blockedEmotions;
            }
            setRules(prev => ({ ...prev, ...data }));
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      fetchRules();
    }
  }, [isOpen]);

  const saveRules = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid, 'settings', 'rules');
      await setDoc(docRef, rules);
      showToast('Rules saved successfully!', 'success');
      onClose();
    } catch (e) {
      showToast('Failed to save rules', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayItem = (key: keyof Rules, item: string) => {
    setRules(prev => {
      const arr = prev[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item]
      };
    });
  };

  if (!isOpen) return null;

  const calculatedLossAmount = rules.maxDailyLossType === '%'
    ? (rules.accountBalance * rules.maxDailyLoss / 100)
    : rules.maxDailyLoss;
  const usdEquivalent = convertCurrency(calculatedLossAmount, rules.accountCurrency, 'USD');
  const currencySymbol = (CURRENCIES as any)[rules.accountCurrency]?.symbol || '$';

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-spotify-card p-6 rounded-3xl w-full max-w-lg border border-white/10 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-white font-black uppercase tracking-widest text-lg">Rules Engine</h2>
          <button onClick={onClose} className="text-spotify-muted hover:text-white"><X size={20} /></button>
        </div>

        {/* Info banner */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
          <Info size={16} className="shrink-0 text-blue-400 mt-0.5" />
          <p className="text-xs text-white/60">These rules don't block your trading. When you log a trade, the AI automatically audits it against these rules and flags any violations.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-spotify-green" /></div>
        ) : (
          <div className="space-y-6">

            {/* Max Daily Loss */}
            <div>
              <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-2 block">Max Daily Loss</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={rules.maxDailyLoss || ''}
                  onFocus={(e) => e.target.select()}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '') { setRules({...rules, maxDailyLoss: 0}); return; }
                    const num = parseFloat(val);
                    if (!isNaN(num) && num >= 0) setRules({...rules, maxDailyLoss: num});
                  }}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm w-full outline-none focus:border-spotify-green transition-colors"
                />
                <button
                  onClick={() => setRules({...rules, maxDailyLossType: rules.maxDailyLossType === '$' ? '%' : '$'})}
                  className="bg-white/5 border border-white/10 px-4 rounded-xl font-bold text-white text-sm min-w-[52px] hover:bg-white/10 transition-colors"
                >
                  {rules.maxDailyLossType === '$' ? currencySymbol : '%'}
                </button>
              </div>

              {/* Account currency selector */}
              <div className="mb-2">
                <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-1 block">Account Currency</label>
                <select
                  value={rules.accountCurrency}
                  onChange={e => setRules({...rules, accountCurrency: e.target.value})}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm w-full outline-none focus:border-spotify-green transition-colors"
                >
                  {Object.entries(CURRENCIES).map(([code, config]: any) => (
                    <option key={code} value={code} className="bg-[#0f0f0f]">
                      {code} ({config.symbol}) — {config.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account balance — only shown in % mode */}
              {rules.maxDailyLossType === '%' && (
                <div className="mb-2">
                  <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-1 block">
                    Account Balance ({rules.accountCurrency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={`e.g. 10000`}
                    value={rules.accountBalance || ''}
                    onFocus={(e) => e.target.select()}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') { setRules({...rules, accountBalance: 0}); return; }
                      const num = parseFloat(val);
                      if (!isNaN(num) && num >= 0) setRules({...rules, accountBalance: num});
                    }}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm w-full outline-none focus:border-spotify-green transition-colors"
                  />
                </div>
              )}

              {/* Calculated result */}
              {rules.maxDailyLoss > 0 && (
                <div className="bg-spotify-green/10 border border-spotify-green/20 p-3 rounded-xl flex items-start gap-2">
                  <Info size={14} className="shrink-0 text-spotify-green mt-0.5" />
                  <div className="text-xs text-spotify-green">
                    {rules.maxDailyLossType === '$' ? (
                      <span>
                        Max loss: <strong>{currencySymbol}{rules.maxDailyLoss} {rules.accountCurrency}</strong>
                        {rules.accountCurrency !== 'USD' && ` ≈ $${usdEquivalent.toFixed(2)} USD`}
                      </span>
                    ) : (
                      rules.accountBalance > 0 ? (
                        <span>
                          {rules.maxDailyLoss}% of {currencySymbol}{rules.accountBalance.toLocaleString()} = <strong>{currencySymbol}{calculatedLossAmount.toFixed(2)} {rules.accountCurrency}</strong>
                          {rules.accountCurrency !== 'USD' && ` ≈ $${usdEquivalent.toFixed(2)} USD`}
                        </span>
                      ) : (
                        <span className="text-white/40">Enter your account balance above to see the calculated amount</span>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Max Trades Per Day */}
            <div>
              <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-2 block">Max Trades / Day</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={rules.maxTradesPerDay || ''}
                onFocus={(e) => e.target.select()}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '') { setRules({...rules, maxTradesPerDay: 0}); return; }
                  const num = Math.floor(parseFloat(val));
                  if (!isNaN(num) && num >= 0) setRules({...rules, maxTradesPerDay: num});
                }}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm w-full outline-none focus:border-spotify-green transition-colors"
              />
            </div>

            {/* My Trading Sessions */}
            <div>
              <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-1 block">My Trading Sessions</label>
              <p className="text-[10px] text-white/40 mb-2">Flag trades outside these sessions</p>
              <div className="flex gap-2 flex-wrap">
                {SESSIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleArrayItem('allowedSessions', s)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${rules.allowedSessions.includes(s) ? 'bg-spotify-green text-black' : 'bg-white/5 text-white hover:bg-white/10'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* My A+ Setups */}
            <div>
              <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-1 block">My A+ Setups</label>
              <p className="text-[10px] text-white/40 mb-2">Flag trades using setups not on this list</p>
              <div className="grid grid-cols-2 gap-2">
                {SETUPS.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleArrayItem('allowedSetups', s)}
                    className={`p-2 rounded-lg text-left text-[10px] font-bold transition-colors truncate ${rules.allowedSetups.includes(s) ? 'bg-spotify-green text-black' : 'bg-white/5 text-white hover:bg-white/10'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Flag These Emotions */}
            <div>
              <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-1 block">Flag These Emotions</label>
              <p className="text-[10px] text-white/40 mb-2">AI will flag trades logged with these emotional states</p>
              <div className="flex gap-2 flex-wrap">
                {EMOTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => toggleArrayItem('flaggedEmotions', e)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-colors ${
                      rules.flaggedEmotions.includes(e)
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                        : 'bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Flag News Trades */}
            <div className="flex justify-between items-start bg-white/5 p-4 rounded-xl">
              <div>
                <label className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle size={16} /> Flag news event trades
                </label>
                <p className="text-[10px] text-white/40 mt-1">AI will flag trades taken during high-impact news</p>
              </div>
              <input
                type="checkbox"
                checked={rules.noTradingDuringNews}
                onChange={e => setRules({...rules, noTradingDuringNews: e.target.checked})}
                className="toggle mt-1"
              />
            </div>

            {/* Save Button */}
            <button
              onClick={saveRules}
              disabled={saving}
              className="w-full bg-spotify-green py-4 rounded-full font-black text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save Rules
            </button>

          </div>
        )}
      </motion.div>
    </div>
  );
};
