import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, SendHorizontal, Bot } from 'lucide-react';
import Markdown from 'react-markdown';

interface AnalyticsChatModalProps {
  onClose: () => void;
  context: any;
}

export const AnalyticsChatModal: React.FC<AnalyticsChatModalProps> = ({ onClose, context }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hello! I am your AI trading mentor. I have analyzed your performance data. What would you like to know or improve?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    try {
      const Groq = (await import('groq-sdk')).default;
      const client = new Groq({ 
        apiKey: import.meta.env.VITE_GROQ_API_KEY, 
        dangerouslyAllowBrowser: true 
      });
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: `You are an elite prop desk trading mentor. Analyze this trader's performance data and give deep, valuable insights. Format your response cleanly using:
- Bold headers for each section using **Header**
- Bullet points for lists
- Line breaks between sections
- Be direct, specific, and data-driven. No fluff. No filler sentences.
- Call out weaknesses brutally. Reinforce strengths clearly.
Trader data: ${JSON.stringify(context)}` },
          ...[...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
        ],
        max_tokens: 1000,
      });
      const result = completion.choices[0]?.message?.content || 'No response.';
      setMessages(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (err) {
      console.error("Chat failed:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Oops, I had trouble processing that. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0f0f0f]/90 border border-white/10 p-6 rounded-3xl max-w-2xl w-full max-h-[80vh] flex flex-col"
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2">
                <Bot size={18} className="text-spotify-green" /> Analytics Chat
            </h2>
            <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-4 rounded-2xl max-w-[80%] text-sm leading-relaxed ${m.role === 'user' ? 'bg-spotify-green text-black font-bold' : 'bg-white/5 text-white'}`}>
                        <Markdown components={{
                          strong: ({children}) => <span className="text-spotify-green font-bold">{children}</span>,
                          p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
                          ul: ({children}) => <ul className="list-disc pl-4 space-y-1 mb-3">{children}</ul>,
                          li: ({children}) => <li className="text-white/80">{children}</li>,
                          h3: ({children}) => <h3 className="text-white font-black uppercase tracking-widest text-xs mb-2 mt-4">{children}</h3>,
                        }}>{m.content}</Markdown>
                    </div>
                </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-spotify-muted text-xs">
                <div className="w-1.5 h-1.5 bg-spotify-green rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-spotify-green rounded-full animate-bounce delay-100" />
                <div className="w-1.5 h-1.5 bg-spotify-green rounded-full animate-bounce delay-200" />
              </div>
            )}
        </div>

        <div className="flex gap-2">
            <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about your metrics..."
                className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-3 text-white text-sm outline-none focus:border-spotify-green"
            />
            <button 
                onClick={handleSend}
                disabled={isLoading}
                className="bg-spotify-green p-3 rounded-full hover:opacity-90 disabled:opacity-50"
            >
                <SendHorizontal size={18} className="text-black" />
            </button>
        </div>
      </motion.div>
    </div>
  );
};
