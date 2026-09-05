import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '../AppShell';

export function Scene3() {
  const topics = [
    "Evolution by natural selection",
    "Adaptation and evolutionary inference",
    "Sexual selection and mating",
    "Parental investment and families",
    "Kin selection and inclusive fitness",
    "Cooperation and reciprocity",
    "Social cognition, status, and groups",
    "Culture, development, and critical methods"
  ];

  return (
    <motion.div 
      className="absolute inset-0 bg-[#FDFCFB]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <AppShell activeTab="Assignments">
        <div className="p-10 w-full h-full flex flex-col max-w-5xl mx-auto overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="text-sm font-medium text-[#718096] mb-1">4–6 HOUR COURSE</div>
            <h2 className="text-3xl font-display font-bold text-[#1A2B3D]">Nano Evolutionary Psychology</h2>
            <p className="text-[#4A5568] mt-2">8 evolutionary psychology topic areas</p>
          </motion.div>

          <div className="flex-1 bg-white rounded-lg border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col relative">
            <div className="absolute inset-0 overflow-y-auto p-2">
              {topics.map((topic, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center p-4 hover:bg-slate-50 border-b border-[#E2E8F0] last:border-0 group cursor-default"
                >
                  <div className="w-8 h-8 rounded-full bg-[#EFECE6] text-[#1A2B3D] flex items-center justify-center font-mono text-xs font-bold mr-4 shrink-0">
                    {i+1}
                  </div>
                  <div className="flex-1 font-medium text-[#1A2B3D]">{topic}</div>
                  <div className="w-20 text-right">
                    {i === 0 ? (
                      <span className="text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-2 py-1 rounded">DONE</span>
                    ) : i === 1 ? (
                      <span className="text-xs font-bold text-[#E76E50] bg-[#E76E50]/10 px-2 py-1 rounded">START</span>
                    ) : (
                      <span className="text-xs text-[#718096]">0%</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Overlay cursor to show clicking the 2nd topic */}
            <motion.div 
              className="absolute z-50 w-6 h-6"
              initial={{ x: '80vw', y: '80vh' }}
              animate={{ x: '40vw', y: '25vh' }}
              transition={{ delay: 1.5, duration: 0.8, ease: "easeInOut" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A2B3D" strokeWidth="2" className="drop-shadow-md">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" fill="white" />
              </svg>
            </motion.div>
          </div>
        </div>
      </AppShell>
    </motion.div>
  );
}
