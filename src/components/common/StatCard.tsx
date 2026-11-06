import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  color?: 'emerald' | 'blue' | 'amber' | 'rose' | 'indigo' | 'purple';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'emerald',
  onClick,
}) => {
  const colorMap = {
    emerald: {
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'hover:border-emerald-300 dark:hover:border-emerald-700',
      gradient: 'from-emerald-500/5 to-transparent',
    },
    blue: {
      bg: 'bg-blue-500/10 dark:bg-blue-500/20',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'hover:border-blue-300 dark:hover:border-blue-700',
      gradient: 'from-blue-500/5 to-transparent',
    },
    amber: {
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'hover:border-amber-300 dark:hover:border-amber-700',
      gradient: 'from-amber-500/5 to-transparent',
    },
    rose: {
      bg: 'bg-rose-500/10 dark:bg-rose-500/20',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'hover:border-rose-300 dark:hover:border-rose-700',
      gradient: 'from-rose-500/5 to-transparent',
    },
    indigo: {
      bg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'hover:border-indigo-300 dark:hover:border-indigo-700',
      gradient: 'from-indigo-500/5 to-transparent',
    },
    purple: {
      bg: 'bg-purple-500/10 dark:bg-purple-500/20',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'hover:border-purple-300 dark:hover:border-purple-700',
      gradient: 'from-purple-500/5 to-transparent',
    },
  };

  const scheme = colorMap[color];

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden glass-card p-5 border border-slate-200 dark:border-slate-800 transition-all ${
        scheme.border
      } ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''}`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${scheme.gradient} rounded-bl-full pointer-events-none`} />

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2.5 rounded-xl ${scheme.bg} ${scheme.text}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono-numbers tracking-tight">
          {value}
        </div>
        
        {(subtitle || trend) && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            {trend && (
              <span
                className={`font-semibold ${
                  trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {trend.value}
              </span>
            )}
            {subtitle && (
              <span className="text-slate-500 dark:text-slate-400 truncate">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
