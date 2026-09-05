import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '../AppShell';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000), // type answer
      setTimeout(() => setPhase(2), 2500), // submit
      setTimeout(() => setPhase(3), 3500), // difficulty up
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[#FDFCFB]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <AppShell activeTab="Assignments">
        <div className="p-10 w-full h-full flex flex-col max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-display font-bold text-[#1A2B3D]">Practice: Kin Selection</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#718096]">Streak: 3</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
                <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
                <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
              </div>
            </div>
          </div>

          <motion.div className="flex-1 bg-white rounded-lg border border-[#E2E8F0] shadow-sm p-8 relative">
            <AnimatePresence>
              {phase === 3 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute -top-4 right-8 bg-[#10B981] text-white px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                  Difficulty Level ↑
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-lg text-[#1A2B3D] font-medium mb-6">
              In what conditions might helping a relative increase inclusive fitness? Explain the relevant factors.
            </div>

            <div className="border border-[#1A2B3D] rounded-md p-4 mb-4 min-h-[150px] relative bg-[#FDFCFB]">
              <div className="font-mono text-[#1A2B3D]">
                {phase >= 1 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    Kin selection may favor costly helping when relatedness and the recipient's benefit<br/>
                    are sufficiently large relative to the helper's cost; context still matters.
                  </motion.div>
                ) : (
                  <span className="text-[#718096] opacity-50">Type your answer here...</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                {['{ }', '[ ]', '< >', '</>', '""', '=>', '||'].map((sym, i) => (
                  <button key={i} className="w-8 h-8 rounded bg-[#EFECE6] hover:bg-[#E2E8F0] text-[#1A2B3D] font-mono text-sm flex items-center justify-center">
                    {sym}
                  </button>
                ))}
              </div>
              <motion.button 
                className={`px-6 py-2 rounded-md font-medium text-white transition-colors ${phase >= 2 ? 'bg-[#10B981]' : 'bg-[#E76E50]'}`}
                animate={phase >= 2 ? { scale: [1, 1.05, 1] } : {}}
              >
                {phase >= 2 ? 'Correct!' : 'Submit'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </AppShell>
    </motion.div>
  );
}
