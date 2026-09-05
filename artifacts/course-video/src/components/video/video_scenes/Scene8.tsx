import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../AppShell';

export function Scene8() {
  const topicsList = [
    { name: 'Evolution and adaptation', acc: '98%', status: 'Strong', color: 'text-[#10B981]', bg: 'bg-[#10B981]/10' },
    { name: 'Cooperation and kin selection', acc: '85%', status: 'Proficient', color: 'text-[#10B981]', bg: 'bg-[#10B981]/10' },
  ];

  return (
    <motion.div 
      className="absolute inset-0 bg-[#FDFCFB]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <AppShell activeTab="Analytics">
        <div className="p-10 w-full h-full flex flex-col max-w-6xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-display font-bold text-[#1A2B3D] mb-8"
          >
            Performance Analytics
          </motion.h2>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { l: 'Course Average', v: '91%' },
              { l: 'Practice Accuracy', v: '87%' },
              { l: 'Total Attempts', v: '243' },
              { l: 'Current Streak', v: '12 Days' },
            ].map((kpi, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-sm text-center"
              >
                <div className="text-sm font-medium text-[#718096] mb-2">{kpi.l}</div>
                <div className="text-3xl font-display font-bold text-[#1A2B3D]">{kpi.v}</div>
              </motion.div>
            ))}
          </div>

          {/* Mastery List */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex-1 bg-white rounded-lg border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-[#E2E8F0] bg-[#FDFCFB] font-bold text-[#1A2B3D]">
              Topic Mastery
            </div>
            <div className="flex-1 p-2">
              {topicsList.map((t, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  className="flex items-center justify-between p-4 border-b border-[#E2E8F0] last:border-0"
                >
                  <div className="font-medium text-[#1A2B3D] w-1/3">{t.name}</div>
                  
                  <div className="flex-1 px-8">
                    <div className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full ${t.bg.replace('/10', '')}`}
                        initial={{ width: 0 }}
                        animate={{ width: t.acc }}
                        transition={{ delay: 1 + i * 0.1, duration: 0.8, type: "spring" }}
                      />
                    </div>
                  </div>

                  <div className="w-16 text-right font-mono font-bold text-[#1A2B3D]">{t.acc}</div>
                  <div className="w-32 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${t.bg} ${t.color}`}>{t.status}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

        </div>
      </AppShell>
    </motion.div>
  );
}
