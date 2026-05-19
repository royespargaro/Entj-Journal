import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Bot, Sparkles } from 'lucide-react';
import Markdown from 'react-markdown';

interface PerformanceInsightModalProps {
  onClose: () => void;
  context: any;
}

export const PerformanceInsightModal: React.FC<PerformanceInsightModalProps> = ({ onClose, context }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchInsight = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/analytics-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyticsChartData: context }),
      });
      const data = await response.json();
      setInsight(data.result);
    } catch (err) {
      console.error("Insight failed:", err);
      setInsight("Failed to generate insight.");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchInsight();
  }, []);

  return (
    <div className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0f0f0f]/90 border border-white/10 p-6 rounded-3xl max-w-2xl w-full max-h-[80vh] flex flex-col"
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2">
                <Sparkles size={18} className="text-spotify-green" /> Top Insight
            </h2>
            <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 text-white/80">
            {isLoading ? (
                <div className="text-spotify-muted text-xs">Analyzing performace data...</div>
            ) : insight ? (
                <div className="prose prose-invert prose-sm"><Markdown>{insight}</Markdown></div>
            ) : null}
        </div>
      </motion.div>
    </div>
  );
};
