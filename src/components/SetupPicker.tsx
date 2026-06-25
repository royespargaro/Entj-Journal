
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Search, Check } from 'lucide-react';

const setupLibrary: Record<string, string[]> = {
  "ORDER BLOCKS": [
    "OB Bullish", "OB Bearish", "Breaker Block", "Mitigation Block", "Rejection Block"
  ],
  "FAIR VALUE GAPS": [
    "FVG Bullish", "FVG Bearish", "IFVG", "Volume Imbalance", "Balanced Price Range (BPR)"
  ],
  "LIQUIDITY": [
    "Liquidity Sweep Long", "Liquidity Sweep Short", "Stop Hunt",
    "Equal Highs/Lows (EQH/EQL)", "Turtle Soup", "Internal Range Liquidity (IRL)",
    "External Range Liquidity (ERL)"
  ],
  "STRUCTURE": [
    "BOS Long", "BOS Short", "CHoCH Long", "CHoCH Short", "MSS", "Quasimodo (QML)"
  ],
  "ICT MODELS": [
    "OTE (61.8-79% fib)", "PD Arrays", "NWOG/NDOG", "Silver Bullet",
    "Unicorn Model", "Judas Swing", "Power of Three (AMD)"
  ],
  "WYCKOFF": [
    "Wyckoff Accumulation", "Wyckoff Distribution", "Spring", "Upthrust"
  ],
  "CLASSIC PRICE ACTION": [
    "Breakout Entry", "Pullback / Retest", "Trendline Break", "Range Reversal", "Double Top/Bottom"
  ],
  "OTHER": ["Planned Strategy", "News Trade", "Custom"]
};

const setupTags: Record<string, string[]> = {
  "OB": ["OB", "SMC"],
  "Breaker": ["OB", "SMC"],
  "Mitigation": ["OB", "SMC"],
  "Rejection Block": ["OB", "ICT"],
  "FVG": ["FVG", "SMC"],
  "Volume Imbalance": ["FVG", "SMC"],
  "BPR": ["FVG", "SMC"],
  "Liquidity": ["Liquidity", "Sweep"],
  "Stop Hunt": ["Liquidity", "Sweep"],
  "EQH/EQL": ["Liquidity", "SMC"],
  "Turtle Soup": ["Liquidity", "Reversal"],
  "IRL": ["Liquidity", "ICT"],
  "ERL": ["Liquidity", "ICT"],
  "BOS": ["Structure", "SMC"],
  "CHoCH": ["Structure", "SMC"],
  "MSS": ["Structure", "SMC"],
  "Quasimodo": ["Structure", "Reversal"],
  "OTE": ["OTE", "ICT", "Fib"],
  "PD Arrays": ["ICT", "PDArray"],
  "NWOG": ["ICT", "Gap"],
  "NDOG": ["ICT", "Gap"],
  "Silver Bullet": ["ICT", "Killzone"],
  "Unicorn": ["ICT", "OB", "FVG"],
  "Judas Swing": ["ICT", "Manipulation"],
  "Power of Three": ["ICT", "AMD"],
  "Wyckoff": ["Wyckoff"],
  "Spring": ["Wyckoff"],
  "Upthrust": ["Wyckoff"],
  "Breakout": ["PriceAction", "Breakout"],
  "Pullback": ["PriceAction", "Retest"],
  "Trendline": ["PriceAction", "Trendline"],
  "Range Reversal": ["PriceAction", "Range"],
  "Double Top": ["PriceAction", "Reversal"],
  "Double Bottom": ["PriceAction", "Reversal"],
};

interface SetupPickerProps {
  isOpen: boolean;
  onClose: () => void;
  // FIX: onSelect now also returns the raw array of individual setup names
  onSelect: (setup: string, tags: string[], setupList: string[]) => void;
  initialSelected?: string[];
}

export const SetupPicker = ({ isOpen, onClose, onSelect, initialSelected = [] }: SetupPickerProps) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(initialSelected);

  if (!isOpen) return null;

  const filteredSetups = Object.entries(setupLibrary).reduce((acc, [cat, list]) => {
    const filtered = list.filter(item => item.toLowerCase().includes(search.toLowerCase()));
    if (filtered.length > 0) acc[cat] = filtered;
    return acc;
  }, {} as Record<string, string[]>);

  const toggleSetup = (setup: string) => {
    setSelected(prev =>
      prev.includes(setup) ? prev.filter(s => s !== setup) : [...prev, setup]
    );
  };

  const computeTags = (setups: string[]): string[] => {
    let tags: string[] = [];
    setups.forEach(setup => {
      Object.entries(setupTags).forEach(([key, tagList]) => {
        if (setup.includes(key)) tags = [...new Set([...tags, ...tagList])];
      });
    });
    return tags;
  };

  const handleConfirm = () => {
    if (selected.length === 0) return;
    const combinedSetup = selected.join(' + ');
    const tags = computeTags(selected);
    onSelect(combinedSetup, tags, selected); // FIX: pass the array too
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4"
    >
      <div className="bg-spotify-card p-6 rounded-3xl w-full max-w-lg border border-white/10 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-white font-black uppercase tracking-widest text-lg">Pick Setup(s)</h2>
            <p className="text-[10px] text-spotify-muted mt-0.5">Select one or more confluences for this trade</p>
          </div>
          <button onClick={onClose} className="text-spotify-muted hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex items-center gap-2 bg-spotify-darker p-3 rounded-xl border border-white/5 shrink-0">
          <Search className="text-spotify-muted" size={16} />
          <input
            type="text"
            placeholder="Search setups..."
            className="bg-transparent text-white text-sm outline-none w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 shrink-0 bg-spotify-green/5 border border-spotify-green/20 rounded-xl p-3">
            {selected.map(s => (
              <span
                key={s}
                onClick={() => toggleSetup(s)}
                className="flex items-center gap-1.5 bg-spotify-green/20 text-spotify-green text-[10px] font-bold px-2.5 py-1 rounded-full cursor-pointer hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                {s} <X size={10} />
              </span>
            ))}
          </div>
        )}

        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {Object.entries(filteredSetups).map(([cat, list]) => (
            <div key={cat}>
              <h3 className="text-spotify-muted text-[10px] font-black uppercase tracking-widest mb-2">{cat}</h3>
              <div className="grid grid-cols-2 gap-2">
                {list.map(setup => {
                  const isSelected = selected.includes(setup);
                  return (
                    <button
                      key={setup}
                      type="button"
                      onClick={() => toggleSetup(setup)}
                      className={`relative text-left p-3 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-spotify-green/20 border border-spotify-green text-white'
                          : 'bg-white/5 border border-transparent hover:bg-spotify-green/10 text-white'
                      }`}
                    >
                      <span>{setup}</span>
                      {isSelected && <Check size={14} className="text-spotify-green shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(filteredSetups).length === 0 && (
            <p className="text-center text-spotify-muted text-xs py-8">No setups match "{search}"</p>
          )}
        </div>

        <div className="shrink-0 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selected.length === 0}
            className="w-full bg-spotify-green disabled:opacity-30 disabled:cursor-not-allowed text-spotify-darker font-extrabold uppercase tracking-widest text-[11px] py-4 rounded-full hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            {selected.length === 0 ? 'Select at least one setup' : `Apply ${selected.length} Setup${selected.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </motion.div>
  );
};