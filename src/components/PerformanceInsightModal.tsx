import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, RefreshCw, ChevronRight, Brain, TrendingUp, AlertTriangle, Target } from 'lucide-react';
import Markdown from 'react-markdown';
import { buildCompactContext } from '../lib/aiContext';
interface PerformanceInsightModalProps {
  onClose: () => void;
  context: any;
}

const INSIGHT_MODES = [
  { 
    id: 'full', 
    label: 'Full Report', 
    icon: Brain, 
    prompt: `Analyze this trader's performance and deliver a powerful structured report:

**Your Biggest Edge** — what they do right, must keep doing, with specific numbers
**Your Silent Leak** — the single biggest thing destroying their performance, be brutal  
**Emotional Pattern** — how psychology is affecting results, name specific emotions
**Risk Assessment** — is their risk management sustainable or gambling?
**This Week's Priority** — one concrete action to improve immediately

Be an elite prop desk mentor. Brutally honest. Reference actual numbers. Reassure where earned, challenge where needed.` 
  },
  { 
    id: 'edge', 
    label: 'Find My Edge', 
    icon: TrendingUp, 
    prompt: `Analyze this trader's data and identify their statistical edge. What setups, sessions, and conditions produce their best results? Be specific with numbers. Tell them exactly how to exploit this edge more aggressively. End with a challenge: are they leaving money on the table?` 
  },
  { 
    id: 'risk', 
    label: 'Risk Audit', 
    icon: AlertTriangle, 
    prompt: `Conduct a brutal risk management audit. Analyze lot sizing consistency, R:R ratios, drawdown patterns, and emotional trading. Tell them if they trade like a professional or are gambling. Give a risk score 1-10 and specific steps to improve. Their account survival depends on this.` 
  },
  { 
    id: 'ready', 
    label: 'Prop Firm Ready?', 
    icon: Target, 
    prompt: `Evaluate if this trader is ready for a prop firm challenge like FTMO. Analyze consistency, drawdown control, win rate, and emotional discipline. Give a readiness score 1-10. Tell them exactly what to fix before risking money on a challenge. Be honest but encouraging.` 
  },
];

const QUICK_QUESTIONS = [
  "What is my biggest weakness right now?",
  "Am I ready to trade a prop firm challenge?",
  "What setup should I focus on this week?",
  "Is my risk management good enough?",
  "What emotion is killing my performance?",
  "Should I increase my lot size?",
];
export const PerformanceInsightModal: React.FC<PerformanceInsightModalProps> = ({ onClose, context }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(INSIGHT_MODES[0]);
  const [followUp, setFollowUp] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);

  const fetchInsight = async (mode = activeMode, extraMessage?: string) => {
    setIsLoading(true);
    setShowFollowUp(false);
    try {
      const Groq = (await import('groq-sdk')).default;
      const client = new Groq({
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        dangerouslyAllowBrowser: true
      });

      const messages: any[] = [
        {
          role: 'system',
          content: `You are an elite prop desk trading mentor — direct, experienced, brutally honest. You genuinely care about this trader's growth. Reassure where results are earned, challenge hard where improvement is needed. Never sugarcoat. Always end with something that makes them want to act immediately. Trader summary: ${JSON.stringify(buildCompactContext(context))}`
        },
        { role: 'user', content: mode.prompt }
      ];

      if (extraMessage) {
        messages.push({ role: 'assistant', content: insight || '' });
        messages.push({ role: 'user', content: extraMessage });
      }

      const completion = await client.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages,
  max_tokens: 800,
});
      const result = completion.choices[0]?.message?.content || 'No insight generated.';
      setInsight(result);
      setShowFollowUp(true);
    } catch (err) {
      console.error("Insight failed:", err);
      setInsight("Failed to generate insight. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (mode: typeof INSIGHT_MODES[0]) => {
  setActiveMode(mode);
  setInsight(null);
  setShowFollowUp(false);
  setTimeout(() => fetchInsight(mode), 100);
};

  const handleFollowUp = (q?: string) => {
    const question = q || followUp;
    if (!question.trim()) return;
    setFollowUp('');
    fetchInsight(activeMode, question);
  };

  React.useEffect(() => {
    fetchInsight();
  }, []);

  return (
    <div className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0f0f0f] border border-white/10 p-6 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col gap-4"
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2">
            <Sparkles size={18} className="text-spotify-green" /> AI Mentor
          </h2>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-4 gap-2">
          {INSIGHT_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeMode.id === mode.id
                  ? 'bg-spotify-green text-black'
                  : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              <mode.icon size={14} />
              {mode.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-[200px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-spotify-green rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-spotify-green rounded-full animate-bounce delay-100" />
                <div className="w-1.5 h-1.5 bg-spotify-green rounded-full animate-bounce delay-200" />
              </div>
              <p className="text-spotify-muted text-xs uppercase tracking-widest">Mentor is analyzing...</p>
            </div>
          ) : insight ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeMode.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Markdown components={{
                  strong: ({children}) => <span className="text-spotify-green font-bold">{children}</span>,
                  p: ({children}) => <p className="mb-3 last:mb-0 text-white/80 text-sm leading-relaxed">{children}</p>,
                  ul: ({children}) => <ul className="list-disc pl-4 space-y-1 mb-3">{children}</ul>,
                  li: ({children}) => <li className="text-white/70 text-sm leading-relaxed">{children}</li>,
                  h3: ({children}) => <h3 className="text-white font-black uppercase tracking-widest text-xs mb-2 mt-4">{children}</h3>,
                }}>{insight}</Markdown>
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        {/* Quick Questions — only show after insight loads */}
        {showFollowUp && !isLoading && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Ask a follow-up</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleFollowUp(q)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-spotify-green/20 border border-white/10 hover:border-spotify-green/30 rounded-full text-[10px] text-white/60 hover:text-white transition-all"
                >
                  <ChevronRight size={10} className="text-spotify-green" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Row */}
        <div className="flex gap-2">
          <input
            value={followUp}
            onChange={e => setFollowUp(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleFollowUp()}
            placeholder="Ask your mentor anything..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-3 text-white text-sm outline-none focus:border-spotify-green"
          />
          <button
            onClick={() => handleFollowUp()}
            disabled={isLoading || !followUp.trim()}
            className="bg-spotify-green p-3 rounded-full hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            <ChevronRight size={18} className="text-black" />
          </button>
          <button
            onClick={() => fetchInsight()}
            disabled={isLoading}
            title="Regenerate"
            className="bg-white/5 p-3 rounded-full hover:bg-white/10 disabled:opacity-30 transition-opacity"
          >
            <RefreshCw size={18} className="text-white" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};