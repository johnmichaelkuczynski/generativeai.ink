import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../AppShell';

export function Scene2() {
  return (
    <motion.div 
      className="absolute inset-0 bg-[#FDFCFB]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <AppShell activeTab="Dashboard">
        <div className="p-10 w-full h-full flex flex-col max-w-6xl mx-auto overflow-hidden">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-display font-bold text-[#1A2B3D] mb-8"
          >
            Welcome back, Student
          </motion.h2>

          <div className="grid grid-cols-3 gap-6 mb-8">
            {[
              { label: 'Assignments', val: '2/14', sub: 'Course in progress' },
              { label: 'Practice Problems', val: '124', sub: '92% accuracy' },
              { label: 'Current Streak', val: '5 Days', sub: 'Keep it up!' }
            ].map((kpi, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="bg-white p-6 rounded-lg border border-[#E2E8F0] shadow-sm"
              >
                <div className="text-sm font-medium text-[#4A5568] mb-2">{kpi.label}</div>
                <div className="text-3xl font-display font-bold text-[#1A2B3D]">{kpi.val}</div>
                <div className="text-xs text-[#718096] mt-2">{kpi.sub}</div>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-6 flex-1 min-h-0">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex-1 bg-white p-6 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-col"
            >
              <h3 className="font-display font-bold text-lg mb-4">Current Course</h3>
              <div className="bg-[#1A2B3D] text-white p-6 rounded-md mb-4">
                <div className="text-xs font-mono mb-2 opacity-80">4–6 HOURS</div>
                <div className="text-xl font-display font-bold">Nano Evolutionary Psychology</div>
                <div className="mt-6 flex justify-between items-end">
                  <div className="w-2/3">
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="w-[15%] h-full bg-[#E76E50]" />
                    </div>
                  </div>
                  <button className="bg-[#E76E50] text-white px-4 py-2 rounded-md text-sm font-medium">Continue</button>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="w-1/3 bg-white p-6 rounded-lg border border-[#E2E8F0] shadow-sm"
            >
              <h3 className="font-display font-bold text-lg mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full bg-[#10B981] mt-1.5" />
                    <div>
                      <div className="text-sm font-medium text-[#1A2B3D]">Practice: Kin Selection</div>
                      <div className="text-xs text-[#718096]">Score: 10/10 • 2h ago</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </AppShell>
    </motion.div>
  );
}
