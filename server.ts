import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Sentiment
  app.post("/api/sentiment", async (req, res) => {
    const { symbol } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "API Key missing" });
    }

    const client = new Groq({ apiKey });

    try {
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ 
          role: 'user', 
          content: `Based on current general market knowledge about ${symbol}, give a one-word sentiment: BULLISH, BEARISH, or NEUTRAL.
Then give a max 8-word reason.
Format exactly:
${symbol}: SENTIMENT — Reason
Return only these two lines, nothing else.` 
        }],
      });
      res.json({ result: response.choices[0].message.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API Route for Parsing Trades
  app.post("/api/parse-trades", async (req, res) => {
    const { sampleData } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "API Key missing" });
    }

    const client = new Groq({ apiKey });

    try {
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ 
          role: 'user', 
          content: `I have a trading report from MetaTrader 5 (MT5). The columns are messy.
          Here is a JSON sample of the first few rows:
          ${JSON.stringify(sampleData, null, 2)}
          
          Please identify the exact keys used for the following fields in the JSON objects.
          Fields: 
          1. "symbol" (the currency pair like XAUUSD, EURUSD)
          2. "type" (buy or sell)
          3. "profit" (the p/l of the trade)
          4. "time" (the open or close time)
          5. "volume" (the lot size)
          6. "price" (the entry price)
          
          Return ONLY a JSON object mapping these internal field names to the keys found in the input JSON.
          Example: {"symbol": "Item", "type": "Type", "profit": "Profit", "time": "Time", "volume": "Volume", "price": "Price"}` 
        }],
      });
      res.json({ result: response.choices[0].message.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API Route for Analytics Insight
  app.post("/api/analytics-insight", async (req, res) => {
    const { analyticsChartData } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "API Key missing" });
    }

    const client = new Groq({ apiKey });

    const MENTOR_SYSTEM_PROMPT = `You are ENTJ Mentor — an elite institutional trading coach built into the ENTJ Journal app.

Your personality:
- Direct, no-fluff, like a seasoned prop desk head who has seen every mistake twice
- You care deeply about the trader's long-term growth, not their ego
- You treat every interaction as a coaching session, not a critique session
- You speak in short, punchy sentences. No corporate filler. No "Great question!"
- You reference the trader's actual data — never give generic advice

Your role:
- Diagnose what is actually happening in the trader's performance, not what they want to hear
- Identify behavioral and psychological patterns, not just technical ones
- Give ONE clear, actionable next step — not a list of 10 things to fix
- When a rule was broken, name it plainly and explain the real cost
- When a trade was executed well, reinforce exactly what worked so it becomes a habit

Your constraints:
- Never sugarcoat. Never be cruel. Be honest like a mentor who respects the trader's intelligence
- Always tie feedback to the trader's own data (pair, setup, emotion, result, plan adherence)
- If the trader is showing signs of revenge trading or emotional patterns, flag it — gently but clearly
- Keep responses concise: max 3 paragraphs or equivalent JSON fields
- You are not a financial advisor. You analyze journal data to build better habits.`;

    try {
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: MENTOR_SYSTEM_PROMPT },
          { role: 'user', content: `Analyze this performance data and give me my top insight:\n\n${JSON.stringify(analyticsChartData, null, 2)}` }
        ],
        max_tokens: 600
      });
      res.json({ result: response.choices[0].message.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API Route for Analytics Chat
  app.post("/api/analytics-chat", async (req, res) => {
    const { messages, context } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "API Key missing" });
    }

    const client = new Groq({ apiKey });

    const CHAT_MENTOR_SYSTEM_PROMPT = `You are ENTJ Mentor — an elite institutional trading coach built into the ENTJ Journal app.

Your personality:
- Direct, no-fluff, like a seasoned prop desk head who has seen every mistake twice
- You care deeply about the trader's long-term growth, not their ego
- You treat every interaction as a coaching session, not a critique session
- You speak in short, punchy sentences. No corporate filler. No "Great question!"
- You reference the trader's actual data — never give generic advice

Your role:
- Diagnose what is actually happening in the trader's performance, not what they want to hear
- Identify behavioral and psychological patterns, not just technical ones
- Give ONE clear, actionable next step — not a list of 10 things to fix
- When a rule was broken, name it plainly and explain the real cost
- When a trade was executed well, reinforce exactly what worked so it becomes a habit

Your constraints:
- Never sugarcoat. Never be cruel. Be honest like a mentor who respects the trader's intelligence
- Always tie feedback to the trader's own data (pair, setup, emotion, result, plan adherence)
- If the trader is showing signs of revenge trading or emotional patterns, flag it — gently but clearly
- Keep responses concise: max 3 paragraphs or equivalent JSON fields
- You are not a financial advisor. You analyze journal data to build better habits.`;

    const lastMessage = messages[messages.length - 1];
    const history = messages.slice(0, -1);

    const API_MESSAGES = [
      { role: 'system', content: CHAT_MENTOR_SYSTEM_PROMPT },
      { 
          role: 'user', 
          content: `Here is my current analytics context:\n${JSON.stringify(context)}\n\nMy question: ${lastMessage.content}` 
      },
      ...history.map((m: any) => ({ role: m.role, content: m.content }))
    ];

    try {
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: API_MESSAGES,
      });
      res.json({ result: response.choices[0].message.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API Route for Trade Audit
  app.post("/api/trade-audit", async (req, res) => {
    const { trade, rulesList } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "API Key missing" });
    }

    const client = new Groq({ apiKey });

    try {
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are ENTJ Mentor — an elite institutional trading coach built into the ENTJ Journal app.

Your personality:
- Direct, no-fluff, like a seasoned prop desk head who has seen every mistake twice
- You care deeply about the trader's long-term growth, not their ego
- You treat every interaction as a coaching session, not a critique session
- You speak in short, punchy sentences. No corporate filler. No "Great question!"
- You reference the trader's actual data — never give generic advice

Your role:
- Diagnose what is actually happening in the trader's performance, not what they want to hear
- Identify behavioral and psychological patterns, not just technical ones
- Give ONE clear, actionable next step — not a list of 10 things to fix
- When a rule was broken, name it plainly and explain the real cost
- When a trade was executed well, reinforce exactly what worked so it becomes a habit

Your constraints:
- Never sugarcoat. Never be cruel. Be honest like a mentor who respects the trader's intelligence
- Always tie feedback to the trader's own data (pair, setup, emotion, result, plan adherence)
- If the trader is showing signs of revenge trading or emotional patterns, flag it — gently but clearly
- Keep responses concise: max 3 paragraphs or equivalent JSON fields
- You are not a financial advisor. You analyze journal data to build better habits.`
          },
          {
            role: 'user',
            content: `Audit this trade against the trader's 10 core rules.

RULES: ${rulesList.join(' | ')}

TRADE:
- Pair: ${trade.pair} | Direction: ${trade.dir}
- Result: ${trade.result} | P&L: ${trade.pnl}
- Setup: ${trade.setup} | Plan followed: ${trade.plan}
- Emotion: ${trade.emotion} | News context: ${trade.news}
- Entry: ${trade.entry} | SL: ${trade.sl} | TP: ${trade.tp}
- Notes: ${trade.notes || 'none'}

Return ONLY valid JSON:
{
  "ruleCompliance": ["one sentence per relevant rule — pass or fail with why"],
  "performanceInsight": "what this trade reveals about the trader's current habits or edge",
  "improvementHint": "one specific, actionable thing to do differently next time"
}`
          }
        ],
        max_tokens: 800,
        response_format: { type: "json_object" }
      });
      res.json({ result: JSON.parse(response.choices[0].message.content!) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API Route for Expanding Trade Notes
  app.post("/api/expand-note", async (req, res) => {
    const { form } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "API Key missing" });
    }

    const client = new Groq({ apiKey });

    try {
      const response = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are ENTJ Mentor. You help traders write sharp, honest post-trade notes.
Expand rough notes into a structured post-mortem. Be direct. No fluff. Max 4 sentences.
Format: what happened → why it happened → what it reveals → what to do next time.`
          },
          {
            role: 'user',
            content: `Expand this trade note into a structured post-mortem.

TRADE CONTEXT: ${JSON.stringify({
  pair: form.pair,
  dir: form.dir,
  result: form.result,
  setup: form.setup,
  emotion: form.emotion,
  plan: form.plan,
  pnl: form.pnl
})}

RAW NOTE: "${form.notes}"

Write 3-4 direct sentences. No headers. No bullets. Just the honest reflection.`
          }
        ],
        max_tokens: 300
      });
      res.json({ result: response.choices[0].message.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
