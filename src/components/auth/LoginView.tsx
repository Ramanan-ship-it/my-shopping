import React, { useState } from 'react';
import { Lock, User, ArrowRight, Sparkles, Shield, Scissors, Store, Briefcase } from 'lucide-react';
import { useAuth, DEMO_USERS } from '../../context/AuthContext';
import { Badge } from '../common/Badge';

export const LoginView: React.FC = () => {
  const { login, quickLoginAs, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState<string>('OWNER01');
  const [password, setPassword] = useState<string>('Owner@123');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Please provide User ID or Email, and Password.');
      return;
    }

    try {
      setSubmitting(true);
      await login(identifier.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const roleIcons = {
    OWNER: Shield,
    EMPLOYEE: Briefcase,
    TAILOR: Scissors,
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Logo & Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/25 p-3">
            <img src="/logo.svg" alt="Smart Dress Shop Logo" className="w-full h-full" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
            SMART DRESS SHOP
          </h1>
          <p className="text-xs text-slate-400">
            Retail & Wholesale Apparel Management ERP System
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-2xl space-y-5 bg-slate-900/90 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                User ID or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="e.g. OWNER01 or EMP001"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || isLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-emerald-600/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <span>{submitting ? 'Authenticating...' : 'Sign In to Store ERP'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick 1-Click Role Switcher */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Instant Role Sign-In
              </span>
              <span className="text-[10px] text-slate-500">1-Click Access</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_USERS.map(demo => {
                const Icon = roleIcons[demo.role] || User;
                return (
                  <button
                    key={demo.id}
                    onClick={() => {
                      setIdentifier(demo.id);
                      setPassword(demo.pass);
                      quickLoginAs(demo.role, demo.id);
                    }}
                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800/80 hover:border-emerald-500/50 text-left transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-xs text-white truncate">
                        {demo.label.split(' ')[0]}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 line-clamp-1">
                      {demo.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500">
          Smart Dress Shop • Dual Shop (Retail & Wholesale) Management System
        </div>
      </div>
    </div>
  );
};
