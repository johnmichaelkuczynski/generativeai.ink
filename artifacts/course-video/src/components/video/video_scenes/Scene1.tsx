import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '../AppShell';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[#FDFCFB]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8 }}
    >
      <AnimatePresence mode="wait">
        {phase < 3 ? (
          <motion.div 
            key="intro"
            className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center z-20"
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            transition={{ duration: 0.6 }}
          >
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.8 }}
              className="text-[4vw] font-display font-bold text-[#1A2B3D] leading-tight"
            >
              Nano Evolutionary Psychology
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.8 }}
              className="text-[1.5vw] text-[#4A5568] max-w-2xl mt-6"
            >
              A foundational course on evidence and evolutionary approaches to behavior. <br/>
              Taught, tutored, and graded by AI.
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full h-full"
          >
            <AppShell activeTab="Dashboard">
              <div className="p-12 w-full h-full flex flex-col justify-center items-center opacity-50">
                <div className="text-2xl font-display text-[#1A2B3D]">Loading Dashboard...</div>
              </div>
            </AppShell>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

