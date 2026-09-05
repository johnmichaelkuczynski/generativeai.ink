import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Search, LayoutDashboard, PenTool, Scale, GraduationCap, BarChart3 } from 'lucide-react';

export function AppShell({ children, activeTab = 'Dashboard' }: { children: ReactNode, activeTab?: string }) {
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Assignments', icon: PenTool },
    { name: 'Assessments', icon: Scale },
    { name: 'Grades', icon: GraduationCap },
    { name: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="w-full h-full bg-[#FDFCFB] flex text-[#1A2B3D] font-body text-left">
      {/* Sidebar */}
      <div className="w-64 border-r border-[#E2E8F0] bg-[#FFFFFF] flex flex-col p-6 h-full shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 rounded-md bg-[#1A2B3D] flex items-center justify-center">
            <Search className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg">Nano Evolutionary Psychology</span>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => (
            <div 
              key={item.name}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === item.name 
                  ? 'bg-[#EFECE6] text-[#1A2B3D]' 
                  : 'text-[#4A5568] hover:bg-slate-50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
