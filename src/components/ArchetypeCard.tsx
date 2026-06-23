import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import chara1 from "../imports/marek-rudowski-tos-chara1.jpg";
import chara3 from "../imports/marek-rudowski-tos-chara3.jpg";
import chara5 from "../imports/marek-rudowski-tos-chara5.jpg";
import chara7 from "../imports/marek-rudowski-tos-chara7.jpg";

const archetypes = [
  {
    id: 0, name: "The Gambler", 
    sub: "Danger Zone", color: "#d95050", glow: "rgba(217,80,80,0.55)",
    trait1: "Impulsive", trait2: "High Risk", trait3: "Volatile",
    desc: "Chases losses. Bets big on instinct. Ignores the edge.",
    img: chara1, bgPos: "0% 15%", bgSize: "520% auto", level: 0,
  },
  {
    id: 1, name: "The Tourist", 
    sub: "Unconscious Incompetence", color: "#7a9e96", glow: "rgba(122,158,150,0.38)",
    trait1: "Wandering", trait2: "Unaware", trait3: "Hopeful",
    desc: "Doesn't know what they don't know. Luck feels like skill.",
    img: chara3, bgPos: "25% 15%", bgSize: "520% auto", level: 1,
  },
  {
    id: 2, name: "The Apprentice", 
    sub: "Conscious Incompetence", color: "#c97a3a", glow: "rgba(201,122,58,0.5)",
    trait1: "Studying", trait2: "Self-Aware", trait3: "Grinding",
    desc: "Knows the gaps. Tracks mistakes. Building habits daily.",
    img: chara7, bgPos: "25% 10%", bgSize: "520% auto", level: 2,
  },
  {
    id: 3, name: "The Strategist", 
    sub: "Pattern Recognition", color: "#c4a030", glow: "rgba(196,160,48,0.5)",
    trait1: "Analytical", trait2: "Patient", trait3: "Adaptive",
    desc: "Spots recurring patterns. Connects cause and effect.",
    img: chara1, bgPos: "50% 12%", bgSize: "520% auto", level: 3,
  },
  {
    id: 4, name: "The Tactician", 
    sub: "Conscious Development", color: "#4a8fc4", glow: "rgba(74,143,196,0.5)",
    trait1: "Deliberate", trait2: "Structured", trait3: "Evolving",
    desc: "Builds and tests strategies deliberately. Risk management is second nature.",
    img: chara3, bgPos: "50% 10%", bgSize: "520% auto", level: 4,
  },
  {
    id: 5, name: "The Specialist", 
    sub: "Conscious Competence", color: "#2eb0b8", glow: "rgba(46,176,184,0.5)",
    trait1: "Precise", trait2: "Selective", trait3: "Consistent",
    desc: "Executes a defined edge. Knows exactly when to stay out.",
    img: chara3, bgPos: "75% 10%", bgSize: "520% auto", level: 5,
  },
  
    id: 6, name: "The Operator",
    sub: "Process Mastery", color: "#9060c0", glow: "rgba(144,96,192,0.5)",
    trait1: "Systematic", trait2: "Calm", trait3: "Scalable",
    desc: "Trades like a machine. Removes emotion. Follows process.",
    img: chara1, bgPos: "75% 8%", bgSize: "520% auto", level: 6,
  },
  {
    id: 7, name: "The Sniper",
    sub: "Unconscious Competence", color: "#28a858", glow: "rgba(40,168,88,0.5)",
    trait1: "Instinctive", trait2: "Lethal", trait3: "Effortless",
    desc: "Reads context instantly. Acts with precision and calm.",
    img: chara3, bgPos: "0% 12%", bgSize: "520% auto", level: 7,
  },
  {
    id: 8, name: "The Architect", 
    sub: "System Architect", color: "#c89830", glow: "rgba(200,152,48,0.5)",
    trait1: "Visionary", trait2: "Mentor", trait3: "Sovereign",
    desc: "Designs systems. Sees the whole ecosystem as a canvas.",
    img: chara5, bgPos: "25% 10%", bgSize: "520% auto", level: 8,
  },
];

function CornerMark({ rotate = 0, color }: { rotate?: number; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      style={{ transform: `rotate(${rotate}deg)`, flexShrink: 0 }}>
      <path d="M2 2 L12 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
      <path d="M2 2 L2 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
      <circle cx="2" cy="2" r="1.8" fill={color} opacity="0.55" />
    </svg>
  );
}

interface ArchetypeCardProps {
  currentArchetypeId?: number;
  currentPersona?: string;
}

export function ArchetypeCard({ currentArchetypeId = 0, currentPersona }: ArchetypeCardProps) {
  const startIndex = currentArchetypeId ?? 0;
  const [selected, setSelected] = useState(startIndex);
  const [dir, setDir] = useState(1);
  const a = archetypes[selected];
  const isCurrentArchetype = selected === currentArchetypeId;

  const go = (d: number) => {
    setDir(d);
    setSelected((s) => (s + d + archetypes.length) % archetypes.length);
  };

  return (
    <div className="flex flex-col items-center gap-5 select-none" style={{ width: 288 }}>

      {/* Card */}
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{
          background: "#0b1512",
          border: `1px solid ${a.color}44`,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.05), 0 0 52px ${a.glow}, 0 32px 64px rgba(0,0,0,0.8)`,
          transition: "border-color 0.5s ease, box-shadow 0.5s ease",
        }}
      >
        {/* Top accent */}
        <div style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${a.color}, transparent)`,
          transition: "background 0.5s ease",
        }} />

        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
          <CornerMark color={a.color} rotate={0} />
          <div className="flex flex-col items-center gap-0.5">
            <span style={{ fontSize: "0.5rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>
              ENTJ Journal
            </span>
            <span style={{ fontSize: "0.46rem", letterSpacing: "0.16em", textTransform: "uppercase", color: a.color, opacity: 0.6, transition: "color 0.5s" }}>
              ✦ Archetype ✦
            </span>
          </div>
          <CornerMark color={a.color} rotate={90} />
        </div>

        {/* Portrait */}
        <div className="relative mx-3 overflow-hidden rounded-xl" style={{ height: 300 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={selected}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              style={{
                backgroundImage: `url(${a.img})`,
                backgroundSize: a.bgSize,
                backgroundPosition: a.bgPos,
                backgroundRepeat: "no-repeat",
              }}
            />
          </AnimatePresence>

          {/* Vignette */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: "radial-gradient(ellipse at 50% 20%, transparent 35%, rgba(0,0,0,0.38) 100%)",
          }} />
          <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{
            background: "linear-gradient(to bottom, transparent, #0b1512)",
          }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            boxShadow: "inset 10px 0 18px rgba(0,0,0,0.5), inset -10px 0 18px rgba(0,0,0,0.5)",
          }} />
          <div className="absolute inset-0 rounded-xl pointer-events-none" style={{
            border: `1px solid ${a.color}22`,
            transition: "border-color 0.5s",
          }} />

          {/* Level badge */}
          <div className="absolute top-2.5 right-2.5" style={{
            background: "rgba(0,0,0,0.6)",
            border: `1px solid ${a.color}50`,
            borderRadius: 999,
            padding: "2px 8px",
            backdropFilter: "blur(6px)",
          }}>
            <span style={{ fontSize: "0.5rem", letterSpacing: "0.14em", textTransform: "uppercase", color: a.color, fontFamily: "monospace" }}>
              LVL {a.level}
            </span>
          </div>

          {/* YOU ARE HERE badge */}
          {isCurrentArchetype && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-2.5 left-2.5"
              style={{
                background: `${a.color}22`,
                border: `1px solid ${a.color}80`,
                borderRadius: 999,
                padding: "2px 8px",
                backdropFilter: "blur(6px)",
              }}
            >
              <span style={{
                fontSize: "0.5rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: a.color,
                fontFamily: "monospace",
                fontWeight: 700,
              }}>
                ✦ You are here
              </span>
            </motion.div>
          )}
        </div>

        {/* Name */}
        <div className="px-4 pt-2 pb-0.5 text-center">
          <AnimatePresence mode="wait">
            <motion.div key={selected}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, delay: 0.06 }}
            >
              <div style={{
                fontSize: "1.15rem", fontWeight: 700, color: "#f2ede8",
                letterSpacing: "0.02em", lineHeight: 1.2,
                textShadow: `0 0 24px ${a.glow}`,
              }}>
                {a.name}
              </div>
              <div style={{
                fontSize: "0.56rem", letterSpacing: "0.18em", textTransform: "uppercase",
                color: a.color, marginTop: 3, transition: "color 0.5s",
              }}>
                {a.sub}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-2 px-4 my-2.5">
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${a.color}50)` }} />
          <svg width="7" height="7" viewBox="0 0 7 7">
            <rect x="0.5" y="0.5" width="5" height="5" transform="rotate(45 3.5 3.5)" fill={a.color} opacity="0.55" />
          </svg>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${a.color}50, transparent)` }} />
        </div>

        {/* Traits */}
        <div className="flex justify-center gap-1.5 px-4 pb-2">
          {[a.trait1, a.trait2, a.trait3].map((t) => (
            <span key={t} style={{
              fontSize: "0.5rem", letterSpacing: "0.1em", textTransform: "uppercase",
              color: a.color, background: `${a.color}16`,
              border: `1px solid ${a.color}30`,
              padding: "2px 7px", borderRadius: 999,
              transition: "all 0.5s",
            }}>
              {t}
            </span>
          ))}
        </div>

        {/* Description */}
        <AnimatePresence mode="wait">
          <motion.p key={selected}
            className="px-5 pb-3 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            style={{
              fontSize: "0.63rem", lineHeight: 1.7,
              color: "rgba(210,200,190,0.4)",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            {a.desc}
          </motion.p>
        </AnimatePresence>

        {/* Mastery bar */}
        <div className="px-5 pb-3.5">
          <div className="flex justify-between mb-1.5">
            <span style={{ fontSize: "0.48rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)" }}>Mastery</span>
            <span style={{ fontSize: "0.48rem", fontFamily: "monospace", color: "rgba(255,255,255,0.18)" }}>
              {"▰".repeat(a.level)}{"▱".repeat(8 - a.level)}
            </span>
          </div>
          <div style={{ height: 2, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <motion.div
              style={{
                height: "100%", borderRadius: 999,
                background: `linear-gradient(90deg, ${a.color}60, ${a.color})`,
                boxShadow: `0 0 6px ${a.color}80`,
              }}
              animate={{ width: `${(a.level / 8) * 100}%` }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 pb-3">
          <CornerMark color={a.color} rotate={270} />
          <span style={{ fontSize: "0.46rem", letterSpacing: "0.14em", fontFamily: "monospace", color: "rgba(255,255,255,0.12)" }}>
            #{String(a.id).padStart(3, "0")} · ENTJ-2025
          </span>
          <CornerMark color={a.color} rotate={180} />
        </div>

        {/* Bottom accent */}
        <div style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${a.color}, transparent)`,
          transition: "background 0.5s",
        }} />
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => go(-1)}
          className="cursor-pointer rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
          style={{ width: 28, height: 28, background: "rgba(255,255,255,0.04)", border: `1px solid ${a.color}33`, color: a.color }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M7.5 1.5L3.5 5.5L7.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5">
          {archetypes.map((arc) => (
            <button key={arc.id}
              onClick={() => { setDir(arc.id > selected ? 1 : -1); setSelected(arc.id); }}
              className="cursor-pointer rounded-full transition-all duration-300"
              style={{
                width: selected === arc.id ? 16 : arc.id === currentArchetypeId ? 8 : 5,
                height: selected === arc.id ? 8 : arc.id === currentArchetypeId ? 8 : 5,
                background: selected === arc.id ? arc.color : arc.id === currentArchetypeId ? `${arc.color}80` : "rgba(255,255,255,0.1)",
                boxShadow: selected === arc.id ? `0 0 5px ${arc.color}` : arc.id === currentArchetypeId ? `0 0 3px ${arc.color}60` : "none",
              }}
            />
          ))}
        </div>

        <button onClick={() => go(1)}
          className="cursor-pointer rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
          style={{ width: 28, height: 28, background: "rgba(255,255,255,0.04)", border: `1px solid ${a.color}33`, color: a.color }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M3.5 1.5L7.5 5.5L3.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Jump to my archetype button */}
      {selected !== currentArchetypeId && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setSelected(currentArchetypeId)}
          style={{
            fontSize: "0.5rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: archetypes[currentArchetypeId].color,
            background: `${archetypes[currentArchetypeId].color}12`,
            border: `1px solid ${archetypes[currentArchetypeId].color}30`,
            borderRadius: 999,
            padding: "4px 12px",
            cursor: "pointer",
          }}
        >
          ↩ Back to my archetype
        </motion.button>
      )}
    </div>
  );
}
