import React, { useState, useEffect } from 'react';
import { X, Info, Shield, DollarSign, Percent } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../App';
import { CURRENCIES } from '../constants';
import { convertCurrency } from '../lib/utils';
import { Rules } from '../types';

interface RulesManagerProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  displayCurrency: string;
}

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

const SESSIONS = ['Asia', 'London', 'New York'];
const SETUPS = ['MSS + FVG', 'OB + SMT', 'Silver Bullet', 'London Open Sweep', 'NY PM Session'];

export const RulesManager: React.FC<RulesManagerProps> = ({ isOpen, onClose, showToast, displayCurrency }) => {
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
    if (!isOpen) return;
    const fetchRules = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'rules'));
      if (snap.exists()) {
        setRules(snap.data() as Rules);
      }
    };
    fetchRules();
  }, [isOpen]);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid, 'settings', 'rules'), rules);
    showToast('Rules saved successfully');
    onClose();
  };

  const toggleArrayItem = (array: string[], setter: any, item: string) => {
    if (array.includes(item)) {
      setter(array.filter(i => i !== item));
    } else {
      setter([...array, item]);
    }
  };

  if (!isOpen) return null;

  const calculatedLossAmount = rules.maxDailyLossType === '%' && rules.accountBalance > 0 && rules.maxDailyLoss > 0
    ? (rules.accountBalance * rules.maxDailyLoss) / 100
    : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }} className="w-full max-w-2xl bg-[#0d0d0d] rounded-3xl shadow-2xl relative z-10 border border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-spotify-green/5 to-transparent">
          <div>
            <h2 className="text-2xl font-black tracking-tighter text-white">Rules Engine</h2>
            <div className="h-1 w-12 bg-spotify-green mt-1 rounded-full" />
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-spotify-muted transition-all"><X size={24} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
            <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-white/60">These rules don't block your trading. When you log a trade, the AI automatically audits it against these rules and flags any violations.</p>
          </div>

          {/* Max Daily Loss */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-spotify-muted">Max Daily Loss</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={rules.maxDailyLoss || ''}
                onChange={(e) => {
                  let val = parseFloat(e.target.value);
                  if (isNaN(val)) val = 0;
                  if (val < 0) val = 0;
                  setRules({ ...rules, maxDailyLoss: val });
                }}
                onFocus={(e) => e.target.select()}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-spotify-green"
                placeholder="0"
              />
              <button
                onClick={() => setRules({ ...rules, maxDailyLossType: rules.maxDailyLossType === '$' ? '%' : '$' })}
                className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-black text-sm"
              >
                {rules.maxDailyLossType === '$' ? (CURRENCIES[rules.accountCurrency]?.symbol || '$') : '%'}
              </button>
            </div>
            
            {/* Account Currency Selector */}
            <div className="flex gap-2 items-center">
              <span className="text-[9px] text-spotify-muted">Account Currency:</span>
              <select
                value={rules.accountCurrency}
                onChange={(e) => setRules({ ...rules, accountCurrency: e.target.value })}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
              >
                {Object.entries(CURRENCIES).map(([code, data]) => (
                  <option key={code} value={code}>{data.symbol} {code}</option>
                ))}
              </select>
            </div>

            {/* Percentage mode: show account balance input */}
            {rules.maxDailyLossType === '%' && (
              <div className="mt-2">
                <input
                  type="number"
                  value={rules.accountBalance || ''}
                  onChange={(e) => {
                    let val = parseFloat(e.target.value);
                    if (isNaN(val)) val = 0;
                    if (val < 0) val = 0;
                    setRules({ ...rules, accountBalance: val });
                  }}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-spotify-green"
                  placeholder="Account Balance"
                />
              </div>
            )}

            {/* Calculated loss info */}
            {calculatedLossAmount > 0 && (
              <div className="bg-spotify-green/10 border border-spotify-green/20 rounded-xl p-3">
                <p className="text-xs text-spotify-green">
                  Max daily loss: {CURRENCIES[rules.accountCurrency]?.symbol}{calculatedLossAmount.toFixed(2)} {rules.accountCurrency}
                  {' · '}
                  ${convertCurrency(calculatedLossAmount, rules.accountCurrency, 'USD').toFixed(2)} USD
                </p>
              </div>
            )}
            {rules.maxDailyLossType === '$' && rules.maxDailyLoss > 0 && (
              <p className="text-[9px] text-white/30">{CURRENCIES[rules.accountCurrency]?.symbol}{rules.maxDailyLoss} {rules.accountCurrency} max daily loss</p>
            )}
          </div>

          {/* Max Trades Per Day */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-spotify-muted">Max Trades Per Day</label>
            <input
              type="number"
              value={rules.maxTradesPerDay || ''}
              onChange={(e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val)) val = 0;
                if (val < 0) val = 0;
                setRules({ ...rules, maxTradesPerDay: Math.floor(val) });
              }}
              onFocus={(e) => e.target.select()}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-spotify-green"
              placeholder="0 = no limit"
            />
          </div>

          {/* My Trading Sessions */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-spotify-muted">My Trading Sessions</label>
              <p className="text-[9px] text-white/30 mt-0.5">Flag trades outside these sessions</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SESSIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleArrayItem(rules.allowedSessions, (newArr: string[]) => setRules({ ...rules, allowedSessions: newArr }), s)}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${rules.allowedSessions.includes(s) ? 'bg-spotify-green text-black' : 'bg-white/5 text-white/60'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* My A+ Setups */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-spotify-muted">My A+ Setups</label>
              <p className="text-[9px] text-white/30 mt-0.5">Flag trades using setups not on this list</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SETUPS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleArrayItem(rules.allowedSetups, (newArr: string[]) => setRules({ ...rules, allowedSetups: newArr }), s)}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${rules.allowedSetups.includes(s) ? 'bg-spotify-green text-black' : 'bg-white/5 text-white/60'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Flag These Emotions */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-spotify-muted">Flag These Emotions</label>
              <p className="text-[9px] text-white/30 mt-0.5">AI will flag trades logged with these emotional states</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => toggleArrayItem(rules.flaggedEmotions, (newArr: string[]) => setRules({ ...rules, flaggedEmotions: newArr }), e)}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${rules.flaggedEmotions.includes(e) ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-white/5 text-white/60'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* News Toggle */}
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
            <div>
              <p className="text-xs font-bold text-white">Flag news event trades</p>
              <p className="text-[9px] text-white/30">AI will flag trades taken during high-impact news</p>
            </div>
            <button
              onClick={() => setRules({ ...rules, noTradingDuringNews: !rules.noTradingDuringNews })}
              className={`w-12 h-6 rounded-full transition-all ${rules.noTradingDuringNews ? 'bg-spotify-green' : 'bg-white/20'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-all ${rules.noTradingDuringNews ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-white/5 flex gap-3">
          <button onClick={onClose} className="flex-1 px-6 py-3 rounded-xl border border-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/5">Cancel</button>
          <button onClick={handleSave} className="flex-1 bg-spotify-green text-black font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:scale-[1.02] transition-all">Save Rules</button>
        </div>
      </motion.div>
    </div>
  );
};
