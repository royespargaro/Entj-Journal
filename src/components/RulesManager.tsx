import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, Save, AlertCircle, Info } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../App';
import { Rules } from '../types';
import { CURRENCIES } from '../constants';
import { convertCurrency, formatCurrency } from '../lib/utils';

const SESSONS = ['Asia', 'London', 'New York'];
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

export const RulesManager = ({ isOpen, onClose, showToast, displayCurrency }: { isOpen: boolean, onClose: () => void, showToast: (msg: string, type?: 'success' | 'error') => void, displayCurrency: string }) => {
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
    blockedEmotions: [],
    noTradingDuringNews: false,
  });

  useEffect(() => {
    if (isOpen && auth.currentUser) {
      const fetchRules = async () => {
        try {
          const docRef = doc(db, 'users', auth.currentUser!.uid, 'settings', 'rules');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setRules({ ...rules, ...docSnap.data() as Rules });
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
  }

  if (!isOpen) return null;

  const calculatedLossAmount = rules.maxDailyLossType === '%' ? (rules.accountBalance * rules.maxDailyLoss / 100) : rules.maxDailyLoss;
  const usdEquivalent = rules.maxDailyLossType === '%' ? convertCurrency(calculatedLossAmount, rules.accountCurrency, 'USD') : convertCurrency(rules.maxDailyLoss, rules.accountCurrency, 'USD');

  return (
    <div className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-spotify-card p-6 rounded-3xl w-full max-w-lg border border-white/10 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-white font-black uppercase tracking-widest text-lg">Rules Engine</h2>
          <button onClick={onClose} className="text-spotify-muted hover:text-white"><X size={20} /></button>
        </div>
        {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-spotify-green" /></div>
        ) : (
            <div className="space-y-6">
                <div>
                     <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-2 block">Max Daily Loss</label>
                     <div className="flex gap-2 mb-2">
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          value={rules.maxDailyLoss || ''} 
                          onFocus={(e) => e.target.select()}
                          onChange={e => setRules({...rules, maxDailyLoss: Math.max(0, parseFloat(e.target.value) || 0)})} 
                          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm w-full outline-none" 
                        />
                        <button onClick={() => setRules({...rules, maxDailyLossType: rules.maxDailyLossType === '$' ? '%' : '$'})} className="bg-white/5 px-4 rounded-xl font-bold text-white text-sm">
                            {rules.maxDailyLossType === '$' ? (CURRENCIES[rules.accountCurrency]?.symbol || '$') : '%'}
                        </button>
                    </div>

                    <select value={rules.accountCurrency} onChange={e => setRules({...rules, accountCurrency: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm w-full outline-none mb-4">
                        {Object.entries(CURRENCIES).map(([code, config]: any) => (
                           <option key={code} value={code} className="bg-black">{code} - {config.name}</option>
                        ))}
                    </select>

                    {rules.maxDailyLossType === '%' && (
                         <div className="mb-2">
                            <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-2 block">Account Balance</label>
                            <input 
                                type="number" 
                                min="0"
                                step="any"
                                value={rules.accountBalance || ''} 
                                onFocus={(e) => e.target.select()}
                                onChange={e => setRules({...rules, accountBalance: Math.max(0, parseFloat(e.target.value) || 0)})} 
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm w-full outline-none" 
                            />
                         </div>
                    )}

                    {(rules.maxDailyLoss > 0) && (
                        <div className="bg-spotify-green/10 border border-spotify-green/20 p-3 rounded-xl text-spotify-green text-xs flex gap-2">
                            <Info size={16} className="shrink-0"/>
                            <div>
                                {rules.maxDailyLossType === '$' ? (
                                   <span>Fixed Stop: {CURRENCIES[rules.accountCurrency]?.symbol || '$'}{rules.maxDailyLoss} ({formatCurrency(usdEquivalent, 'USD')})</span>
                                ) : (
                                   <span>Percentage Risk: {rules.maxDailyLoss}% of {rules.accountCurrency} {rules.accountBalance} = {CURRENCIES[rules.accountCurrency]?.symbol || '$'}{calculatedLossAmount.toFixed(2)} ({formatCurrency(usdEquivalent, 'USD')})</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div>
                     <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-2 block">Max Trades / Day</label>
                     <input 
                       type="number" 
                       min="0"
                       step="1"
                       value={rules.maxTradesPerDay || ''} 
                       onFocus={(e) => e.target.select()}
                       onChange={e => setRules({...rules, maxTradesPerDay: Math.floor(Math.max(0, parseInt(e.target.value) || 0))})} 
                       className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm w-full outline-none" 
                     />
                </div>

                <div>
                    <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-2 block">Allowed Sessions</label>
                    <div className="flex gap-2 flex-wrap">
                        {SESSONS.map(s => (
                            <button key={s} onClick={() => toggleArrayItem('allowedSessions', s)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${rules.allowedSessions.includes(s) ? 'bg-spotify-green text-black' : 'bg-white/5 text-white'}`}>
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div>
                     <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-2 block">Allowed Setups</label>
                     <div className="grid grid-cols-2 gap-2 text-[10px]">
                        {SETUPS.map(s => (
                            <button key={s} onClick={() => toggleArrayItem('allowedSetups', s)} className={`p-2 rounded-lg text-left transition-colors truncate ${rules.allowedSetups.includes(s) ? 'bg-spotify-green text-black' : 'bg-white/5 text-white'}`}>
                                {s}
                            </button>
                        ))}
                     </div>
                </div>

                <div>
                    <label className="text-[10px] font-black text-spotify-muted uppercase tracking-widest mb-2 block">Blocked Emotions</label>
                    <div className="flex gap-2 flex-wrap">
                        {EMOTIONS.map(e => (
                             <button key={e} onClick={() => toggleArrayItem('blockedEmotions', e)} className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-colors ${rules.blockedEmotions.includes(e) ? 'bg-red-500 text-white' : 'bg-white/5 text-white'}`}>
                                {e}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl">
                    <label className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2"><AlertCircle size={16} /> Block during News</label>
                    <input type="checkbox" checked={rules.noTradingDuringNews} onChange={e => setRules({...rules, noTradingDuringNews: e.target.checked})} className="toggle" />
                </div>

                <button onClick={saveRules} disabled={saving} className="w-full bg-spotify-green py-4 rounded-full font-black text-black flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="animate-spin" /> : <Save size={18} />} Save Rules
                </button>
            </div>
        )}
      </motion.div>
    </div>
  );
};
