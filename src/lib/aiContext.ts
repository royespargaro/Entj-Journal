export function buildCompactContext(context: any) {
  if (!context) return {};
  
  return {
    shortWinRate: context.swr,
    longWinRate: context.lwr,
    shortsCount: context.shortsCount,
    longsCount: context.longsCount,
    avgRR: context.avgRR,
    bestSession: context.sessionData?.length 
      ? [...context.sessionData].sort((a: any, b: any) => b.wr - a.wr)[0]?.name 
      : null,
    sessionSummary: (context.sessionData || []).slice(0, 5).map((s: any) => ({
      name: s.name, winRate: s.wr, pnl: Math.round(s.pnl), trades: s.count
    })),
    emotionSummary: (context.emotionData || []).slice(0, 5).map((e: any) => ({
      name: e.name, winRate: e.wr, pnl: Math.round(e.pnl), trades: e.count
    })),
    topSetups: (context.setupPerformanceData || []).slice(0, 5).map((s: any) => ({
      name: s.name, winRate: s.wr, pnl: Math.round(s.pnl), trades: s.count
    })),
    bestTrade: context.bestTrade ? {
      pair: context.bestTrade.pair, pnl: Math.round(context.bestTrade.usdPnl), date: context.bestTrade.date
    } : null,
    worstTrade: context.worstTrade ? {
      pair: context.worstTrade.pair, pnl: Math.round(context.worstTrade.usdPnl), date: context.worstTrade.date
    } : null,
    newsImpact: context.newsData,
  };
}