import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../AppShell';

export function Scene7() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[#0B131E]" // cinematic dark mode
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <AppShell activeTab="Grades">
        {/* We'll override the AppShell styles locally for dark mode effect inside this tab */}
        <div className="absolute inset-0 bg-[#0B131E] text-white z-50 flex flex-col p-10">
          <div className="max-w-4xl mx-auto w-full h-full flex flex-col justify-center">
            
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center mb-12"
            >
              <div className="text-sm font-mono text-white/50 mb-2 uppercase tracking-widest">Assessment Graded</div>
              <h2 className="text-4xl font-display font-bold text-white">Nano Evolutionary Psychology</h2>
            </motion.div>

            <div className="flex gap-8 items-center">
              {/* Score Box */}
              <motion.div 
                className="w-64 h-64 shrink-0 rounded-2xl border border-white/10 bg-[#121B27] flex flex-col items-center justify-center shadow-2xl relative overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
              >
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-t from-[#10B981]/20 to-transparent"
                  initial={{ y: '100%' }}
                  animate={phase >= 1 ? { y: 0 } : { y: '100%' }}
                  transition={{ duration: 1 }}
                />
                <div className="text-[5rem] font-mono font-bold leading-none text-white z-10 relative">94<span className="text-3xl text-white/50">%</span></div>
                <div className="text-3xl font-display font-bold text-[#10B981] mt-2 z-10 relative">Grade: A</div>
              </motion.div>

              <div className="flex-1 flex flex-col gap-6">
                {/* Rationale */}
                <motion.div 
                  className="p-6 rounded-xl border border-white/10 bg-[#121B27]"
                  initial={{ x: 20, opacity: 0 }}
                  animate={phase >= 1 ? { x: 0, opacity: 1 } : { x: 20, opacity: 0 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-[#E76E50] flex items-center justify-center"><span className="text-white text-xs font-bold">AI</span></div>
                    <span className="font-bold text-sm uppercase tracking-wider text-white/70">Grader Rationale</span>
                  </div>
                  <p className="text-white/80 leading-relaxed text-lg">
                    Strong use of the evidence. You distinguished an evolutionary hypothesis from a deterministic claim and compared plausible alternatives. Minor deduction on question 4 for not addressing cultural variation.
                  </p>
                </motion.div>

                {/* Integrity Detection */}
                <motion.div 
                  className="p-4 rounded-xl border border-[#10B981]/30 bg-[#10B981]/5 flex items-center gap-4"
                  initial={{ x: 20, opacity: 0 }}
                  animate={phase >= 2 ? { x: 0, opacity: 1 } : { x: 20, opacity: 0 }}
                >
                  <div className="w-10 h-10 rounded-full bg-[#10B981]/20 flex items-center justify-center shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
                  </div>
                  <div>
                    <div className="font-bold text-[#10B981]">Human-written response • High Confidence</div>
                    <div className="text-sm text-white/50 font-mono mt-1">Verified via text classifier & keystroke pattern analysis</div>
                  </div>
                </motion.div>
              </div>
            </div>
            
          </div>
        </div>
      </AppShell>
    </motion.div>
  );
}
