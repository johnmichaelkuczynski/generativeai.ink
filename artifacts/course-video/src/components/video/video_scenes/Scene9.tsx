import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene9() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#1A2B3D]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1 } : {}}
        transition={{ type: "spring", duration: 1 }}
        className="flex items-center gap-4 mb-6"
      >
        <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shadow-xl">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A2B3D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <span className="font-display font-bold text-4xl text-white">Nano Evolutionary Psychology</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="text-center space-y-2 mt-4"
      >
        <p className="text-xl text-white/80 font-medium tracking-wide">
          The curriculum, the tutor, the grader, and the integrity check.
        </p>
        <p className="text-[#E76E50] text-2xl font-display font-bold">
          All in one room.
        </p>
      </motion.div>

      {/* Ambient background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[-1]">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/5"
            style={{
              width: Math.random() * 100 + 20,
              height: Math.random() * 100 + 20,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.random() * 20 - 10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: Math.random() * 5 + 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
