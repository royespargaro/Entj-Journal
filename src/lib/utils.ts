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
  const pnlValue = cleanMoney(trade.pnl);
  const lot = Number(trade.lot) || 0;
  const isLong = trade.dir === 'Long';
  const config = PAIR_CONFIG[(trade.pair || '') as keyof typeof PAIR_CONFIG];
  const multiplier = config?.multiplier || 1;

  // --- VALIDATION ---
  if (!entry) return null;
  
  // For 'actual' type, we need exit OR pnl+lot
  if (type === 'actual' && !exit && (!pnlValue || !lot)) return null;
  
  // For 'planned' type, we need TP and SL
  if (type === 'planned' && (!tp || !sl)) return null;

  // --- CALCULATE ACTUAL REWARD (if exit exists) ---
  const rewardPrice = exit ? (isLong ? (exit - entry) : (entry - exit)) : 0;

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
    if (type === 'actual' && pnlValue && lot) {
      const pnlInPips = pnlValue / (lot * multiplier);
      const rewardInPips = isLong ? pnlInPips : -pnlInPips;
      if (rewardInPips > 0) {
        return { value: rewardInPips / (riskPrice / multiplier), method: 'sl' };
      } else {
        // Losing trade with SL = -1R exactly
        return { value: -1, method: 'sl' };
      }
    }
  }

  // --- PRIORITY 2: NO SL — Infer from PnL + Lot ---
  if (type === 'actual' && pnlValue && lot) {
    const pnlInPips = pnlValue / (lot * multiplier);
    
    // If we have exit, calculate reward directly
    if (exit && rewardPrice !== 0) {
      // Losing trade: we know exactly how much was risked
      if (pnlValue < 0) {
        // The risk was exactly the loss amount
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
    const estimatedReward = Math.abs(pnlInPips) * multiplier;
    return { value: estimatedReward / riskPrice, method: 'fallback' };
  }

  return null;
}