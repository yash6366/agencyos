// Shared small UI pieces for enterprise screens across AgencyOS.
import React from 'react';

export const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1738]/20 focus:border-[#0B1738] dark:focus:border-blue-500 transition-all shadow-xs';
const btn = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:translate-y-px';
export const btnPrimary = `${btn} bg-[#0B1738] hover:bg-[#142754] text-white border border-[#0B1738]`;
export const btnGhost = `${btn} border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-slate-300`;
export const btnGood = `${btn} bg-[#0D7A53] hover:bg-[#0a6343] text-white border border-[#0D7A53]`;
export const btnBad = `${btn} bg-rose-50 dark:bg-rose-950/50 text-[#B91C1C] border border-rose-200 dark:border-rose-900 hover:bg-rose-100`;
export const card = 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-all duration-150';
export const th = 'px-3.5 py-2.5 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800';
export const td = 'px-3.5 py-3 text-xs text-slate-700 dark:text-slate-300 align-middle border-b border-slate-100 dark:border-slate-800/60';

export const Badge: React.FC<{ v: string }> = ({ v }) => {
  const good = ['completed', 'approved', 'paid', 'active', 'accepted', 'converted', 'signed', 'inside', 'not_required', 'granted', 'on time', 'won'];
  const warn = ['pending', 'in_progress', 'sent', 'partially_paid', 'draft', 'viewed', 'planned', 'due_soon', 'review', 'open', 'interview'];
  const isGood = good.includes(v.toLowerCase().trim());
  const isWarn = warn.includes(v.toLowerCase().trim());
  
  const cls = isGood 
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    : isWarn 
      ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
      : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize whitespace-nowrap border ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-85" aria-hidden="true" />
      <span>{v.replace(/_/g, ' ')}</span>
    </span>
  );
};

export const Field: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => (
  <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
    <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</span>
    {children}
  </label>
);

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto animate-in fade-in duration-150" onMouseDown={onClose}>
    <div className="w-full max-w-3xl mt-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
        <h3 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">{title}</h3>
        <button onClick={onClose} className={btnGhost}>Close</button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

export const Tabs: React.FC<{ tabs: [string, string][]; value: string; onChange: (v: string) => void }> = ({ tabs, value, onChange }) => (
  <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800 mb-5">
    {tabs.map(([k, l]) => {
      const active = value === k;
      return (
        <button 
          key={k} 
          onClick={() => onChange(k)} 
          className={`px-3.5 py-2 text-xs font-semibold cursor-pointer border-b-2 -mb-px transition-all ${
            active 
              ? 'border-[#0B1738] text-[#0B1738] dark:border-blue-400 dark:text-blue-400 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {l}
        </button>
      );
    })}
  </div>
);

export const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="py-10 text-center">
    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{text}</p>
  </div>
);
