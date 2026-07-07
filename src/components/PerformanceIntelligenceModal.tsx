import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronDown, Sparkles, Loader2, Send } from 'lucide-react';
import Groq from 'groq-sdk';
import { doc, collection, addDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../App'; // adjust path if App.tsx exports db elsewhere
import { generateFindings, suggestMission, missionProgress, type Finding, type Mission, type TimelineEntry } from '../lib/utils';

const CATEGORY_CONFIG = {
  priority: { label: 'Priority', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  edge: { label: 'Edge', color: 'text-spotify-green', bg: 'bg-spotify-green/10', border: 'border-spotify-green/20' },
  risk: { label: 'Risk', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  goal: { label: 'Goals', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
};

function FindingCard({ finding, onCreateMission }: { finding: Finding; onCreateMission: (f: Finding) => void }) {
  const [expanded, setExpanded] = useState(false);
  const config = CATEGORY_CONFIG[finding.category];

  return (
    <div className={`rounded-2xl border ${config.border} ${config.bg} overflow-hidden`}>
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between p-5 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0">{finding.icon}</span>
          <div className="min-w-0">
            <p className={`text-[9px] font-black uppercase tracking-widest ${config.color}`}>{config.label}</p>
            <p className="text-sm font-black text-white truncate">{finding.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className={`text-xs font-black ${config.color}`}>{finding.confidence}%</p>
            <p className="text-[8px] text-white/30 uppercase tracking-widest">confidence</p>
          </div>
          <ChevronDown size={16} className={`text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-3 border-t border-white/5 pt-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Why</p>
              <div className="space-y-1.5">
                {finding.evidence.map(e => (
                  <div key={e.label} className="flex justify-between text-xs">
                    <span className="text-white/40">{e.label}</span>
                    <span className="font-bold text-white font-mono">{e.value}</span>
                  </div>
                ))}
              </div>
              {(finding.category === 'priority' || finding.category === 'risk') && (
                <button onClick={() => onCreateMission(finding)} className={`mt-2 w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${config.bg} ${config.color} border ${config.border} hover:opacity-80 transition-opacity`}>
                  Start Mission →
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MissionCard({ mission }: { mission: Mission }) {
  const progress = missionProgress(mission);
  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-black text-white">{mission.label}</p>
        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{mission.status}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-2">
        <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-blue-400 rounded-full" />
      </div>
      <div className="flex justify-between text-[10px] text-white/40">
        <span>{progress}% complete</span>
        <span>{mission.estimatedImpact}</span>
      </div>
    </div>
  );
}

export function PerformanceIntelligenceModal({ onClose, context, userId, toDisp }: {
  onClose: () => void;
  context: any; // habitStats-shaped object
  userId: string;
  toDisp: (usd: number) => string;
}) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  useEffect(() => {
    setFindings(generateFindings(context, toDisp));
  }, [context, toDisp]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'users', userId, 'missions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setMissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Mission)).filter(m => m.status === 'active'));
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'users', userId, 'timeline'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setTimeline(snap.docs.map(d => ({ id: d.id, ...d.data() } as TimelineEntry)));
    });
    return () => unsub();
  }, [userId]);

  const createMission = async (finding: Finding) => {
    const currentValue = finding.id === 'revenge' ? context.revengeTrades
      : finding.id === 'overtrade' ? context.overtradeDays
      : finding.dollarImpact ? Math.abs(finding.dollarImpact) : 1;
    const suggestion = suggestMission(finding, currentValue);
    if (!suggestion) return;
    await addDoc(collection(db, 'users', userId, 'missions'), {
      ...suggestion,
      status: 'active',
      createdAt: Date.now(),
      completedAt: null,
    });
    await addDoc(collection(db, 'users', userId, 'timeline'), {
      monthKey: new Date().toISOString().slice(0, 7),
      type: 'weakness_identified',
      label: finding.headline,
      detail: `Mission started: ${suggestion.label}`,
      createdAt: Date.now(),
    });
  };

  const priorityFindings = findings.filter(f => f.category === 'priority').sort((a, b) => b.severity - a.severity);
  const edgeFindings = findings.filter(f => f.category === 'edge').sort((a, b) => b.severity - a.severity);
  const riskFindings = findings.filter(f => f.category === 'risk');

  const sendFollowUp = async () => {
    if (!chatInput.trim() || isThinking) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsThinking(true);

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) { setIsThinking(false); return; }
    const client = new Groq({ apiKey, dangerouslyAllowBrowser: true });

    try {
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: `You are a trading performance analyst. You only reason over data already provided — never invent numbers. Evidence: ${JSON.stringify(findings)}` },
          ...chatMessages,
          { role: 'user', content: userMsg },
        ],
        max_tokens: 500,
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.choices[0]?.message?.content || '' }]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-2xl max-h-[88vh] bg-[#0d0d0d] rounded-3xl border border-white/10 overflow-hidden flex flex-col">

        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-spotify-green" />
            <div>
              <h2 className="text-lg font-black text-white">Performance Intelligence</h2>
              <p className="text-[10px] text-white/30">Evidence-backed, not guesswork</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/40"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {priorityFindings.length > 0 && (
            <div className="space-y-3">
              {priorityFindings.map(f => <FindingCard key={f.id} finding={f} onCreateMission={createMission} />)}
            </div>
          )}

          {missions.length > 0 && (
            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30 px-1">Active Missions</p>
              {missions.map(m => <MissionCard key={m.id} mission={m} />)}
            </div>
          )}

          {edgeFindings.length > 0 && (
            <div className="space-y-3">
              {edgeFindings.map(f => <FindingCard key={f.id} finding={f} onCreateMission={createMission} />)}
            </div>
          )}

          {riskFindings.length > 0 && (
            <div className="space-y-3">
              {riskFindings.map(f => <FindingCard key={f.id} finding={f} onCreateMission={createMission} />)}
            </div>
          )}

          {/* Intelligence Timeline */}
          <div className="border-t border-white/5 pt-4">
            <button onClick={() => setShowTimeline(v => !v)} className="w-full flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors">
              Intelligence Timeline <ChevronDown size={14} className={`transition-transform ${showTimeline ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showTimeline && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-4">
                  {timeline.length === 0 ? (
                    <p className="text-xs text-white/20 italic">No history yet — your journey starts here.</p>
                  ) : (
                    <div className="space-y-3">
                      {timeline.map(t => (
                        <div key={t.id} className="flex gap-3 text-xs">
                          <span className="text-white/20 font-mono w-16 shrink-0">{t.monthKey}</span>
                          <div>
                            <p className="font-bold text-white">{t.label}</p>
                            <p className="text-white/40">{t.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Full Report — demoted, always available */}
          <div className="border-t border-white/5 pt-4">
            <button onClick={() => setShowFullReport(v => !v)} className="w-full py-3 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:border-white/20 transition-all">
              {showFullReport ? 'Hide Full Report' : 'Generate Full Report'}
            </button>
            {showFullReport && (
              <div className="mt-4 space-y-2 text-xs text-white/60 leading-relaxed">
                {findings.map(f => (
                  <p key={f.id}>• <span className="font-bold text-white">{f.title}</span> — {f.confidence}% confidence, based on {f.evidence.map(e => `${e.label}: ${e.value}`).join(', ')}.</p>
                ))}
              </div>
            )}
          </div>

          {/* Follow-up chat */}
          {chatMessages.length > 0 && (
            <div className="space-y-3 border-t border-white/5 pt-4">
              {chatMessages.map((m, i) => (
                <div key={i} className={`text-xs p-3 rounded-xl ${m.role === 'user' ? 'bg-white/5 text-white/70 ml-8' : 'bg-spotify-green/5 text-white/80 mr-8'}`}>
                  {m.content}
                </div>
              ))}
              {isThinking && <Loader2 size={16} className="animate-spin text-spotify-green mx-auto" />}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/5 flex gap-2 shrink-0">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendFollowUp()}
            placeholder="Ask a follow-up question..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-spotify-green"
          />
          <button onClick={sendFollowUp} disabled={isThinking} className="p-2.5 bg-spotify-green text-black rounded-xl disabled:opacity-50">
            <Send size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}