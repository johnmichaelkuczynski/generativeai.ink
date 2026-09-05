import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../AppShell';

export function Scene5() {
  const [phase, setPhase] = useState(0);
  const question = "What evidence would support an adaptation hypothesis?";
  const answer = "A useful test derives specific predictions and compares them with alternatives. Converging evidence may support the hypothesis, but it does not show that a behavior is inevitable or universal.";
  const [typedQ, setTypedQ] = useState("");
  const [typedA, setTypedA] = useState("");

  useEffect(() => {
    let qIdx = 0;
    const qInterval = setInterval(() => {
      setTypedQ(question.slice(0, qIdx + 1));
      qIdx++;
      if (qIdx === question.length) {
        clearInterval(qInterval);
        setTimeout(() => setPhase(1), 500); // start answering
      }
    }, 40); // typing speed

    return () => clearInterval(qInterval);
  }, []);

  useEffect(() => {
    if (phase >= 1) {
      let aIdx = 0;
      const aInterval = setInterval(() => {
        // Stream by words to look more like AI generating
        const words = answer.split(' ');
        setTypedA(words.slice(0, aIdx + 1).join(' '));
        aIdx++;
        if (aIdx === words.length) clearInterval(aInterval);
      }, 150); // streaming speed
      return () => clearInterval(aInterval);
    }
    return undefined;
  }, [phase]);

  return (
    <motion.div 
      className="absolute inset-0 bg-[#FDFCFB]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <AppShell activeTab="Assignments">
        <div className="flex h-full w-full">
          {/* Left Column: Lecture (Static background context) */}
          <div className="flex-[3] flex flex-col border-r border-[#E2E8F0] bg-white h-full opacity-50 pointer-events-none grayscale-[0.2]">
            <div className="p-4 border-b border-[#E2E8F0]"><div className="w-1/2 h-4 bg-slate-200 rounded"></div></div>
            <div className="p-10"><div className="w-3/4 h-8 bg-slate-200 rounded mb-6"></div><div className="w-full h-4 bg-slate-200 rounded mb-2"></div><div className="w-5/6 h-4 bg-slate-200 rounded"></div></div>
          </div>
          
          {/* Right Column: AI Tutor focus */}
          <motion.div 
            className="flex-[2] bg-[#FDFCFB] flex flex-col p-6 border-l-4 border-[#E76E50]"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-[#1A2B3D] flex items-center justify-center text-white text-xs font-bold">AI</div>
              <div className="text-sm font-bold text-[#1A2B3D]">TUTOR CHAT</div>
            </div>
            
            <div className="flex-1 bg-white border border-[#E2E8F0] rounded-lg flex flex-col overflow-hidden shadow-sm">
              <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                {/* User message */}
                <div className="self-end max-w-[85%]">
                  <div className="bg-[#EFECE6] text-[#1A2B3D] rounded-2xl rounded-tr-none px-4 py-2 text-sm">
                    {typedQ}
                    {phase === 0 && <span className="animate-pulse">|</span>}
                  </div>
                </div>

                {/* AI response */}
                {phase >= 1 && (
                  <div className="self-start max-w-[85%] flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#1A2B3D] shrink-0 mt-1" />
                    <div className="bg-white border border-[#E2E8F0] text-[#1A2B3D] rounded-2xl rounded-tl-none px-4 py-2 text-sm leading-relaxed shadow-sm">
                      {typedA}
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#E76E50] animate-pulse"></span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-3 border-t border-[#E2E8F0] bg-[#FDFCFB]">
                <div className="bg-white border border-[#E2E8F0] rounded-full px-4 py-2 text-sm text-[#718096] flex items-center justify-between">
                  <span>Ask a question...</span>
                  <div className="w-6 h-6 rounded-full bg-[#E76E50] flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </AppShell>
    </motion.div>
  );
}
