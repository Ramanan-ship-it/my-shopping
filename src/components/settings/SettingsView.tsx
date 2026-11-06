import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Download,
  ShieldCheck,
  History,
  CheckCircle2,
  Languages,
  Sun,
  Moon,
  Laptop,
  Check,
  Store,
  FileText,
  Clock,
  Database,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { AuditLog } from '../../types';
import { Badge } from '../common/Badge';
import { useLanguage, LanguageCode } from '../../context/LanguageContext';
import { useTheme, ThemeMode } from '../../context/ThemeContext';

export const SettingsView: React.FC = () => {
  const { language, setLanguage, languages, t } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [settings, setSettings] = useState<Record<string, string>>({
    business_name: 'SMART DRESS SHOP',
    business_subtitle: 'Smart Retail & Wholesale Management System',
    currency_symbol: '₹',
    default_language: language,
    reminder_days_before: '2',
    invoice_footer: 'Thank you for shopping at Smart Dress Shop! Exchange within 7 days with bill.',
    allow_negative_stock: '0',
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  const fetchSettingsAndLogs = async () => {
    try {
      setLoading(true);
      const [setRes, logsRes] = await Promise.all([
        api.settings.getSettings(),
        api.users.getAuditLogs(),
      ]);
      if (setRes.settings) {
        setSettings(prev => ({
          ...prev,
          ...setRes.settings,
        }));
      }
      setAuditLogs(logsRes.logs || []);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndLogs();
  }, []);

  const handleSelectLanguage = (code: LanguageCode) => {
    setLanguage(code);
    setSettings(prev => ({ ...prev, default_language: code }));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);

    try {
      setSaving(true);
      await api.settings.saveSettings(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    window.open(api.settings.getBackupUrl(), '_blank');
  };

  const themeOptions: { id: ThemeMode; labelKey: string; defaultLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'light', labelKey: 'theme_light', defaultLabel: 'Light Mode', icon: Sun },
    { id: 'dark', labelKey: 'theme_dark', defaultLabel: 'Dark Mode', icon: Moon },
    { id: 'system', labelKey: 'theme_system', defaultLabel: 'System Default', icon: Laptop },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fade-in-slide">
      {/* Top Banner */}
      <div className="glass-card p-6 sm:p-7 border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t('settings_title', 'System Settings & Appearance')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t('settings_subtitle', 'Configure display themes, regional languages, store identity, and backups.')}
          </p>
        </div>

        <button
          onClick={handleDownloadBackup}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
        >
          <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{t('download_db', 'Download Database Backup')}</span>
        </button>
      </div>

      {/* TASK 1: MULTI-LANGUAGE SELECTION */}
      <div className="glass-card p-6 sm:p-7 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('language_selection', 'Multi-Language Selection')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t('language_selection_desc', 'Select your preferred language. All buttons, labels, dashboard and billing update immediately.')}
              </p>
            </div>
          </div>
          <Badge variant="emerald" size="sm" dot>
            6 Languages Active
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {languages.map(l => {
            const isSelected = language === l.code;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => handleSelectLanguage(l.code)}
                className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-200 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
                <span className="text-2xl mb-1.5">{l.flag}</span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white block">
                  {l.nativeName}
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  {l.label}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mt-1">
                  {l.region}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TASK 2: THEME & APPEARANCE */}
      <div className="glass-card p-6 sm:p-7 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('theme_setting', 'Appearance & Theme')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Switch between high-contrast Dark Mode for evening POS shifts or crisp Light Mode.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          {themeOptions.map(opt => {
            const isSelected = theme === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      isSelected
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">
                      {t(opt.labelKey, opt.defaultLabel)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {opt.id === 'system' ? 'Follow device OS' : `${opt.id} color scheme`}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* STORE DETAILS & INVOICE CONFIGURATION */}
      <form onSubmit={handleSaveSettings} className="glass-card p-6 sm:p-7 border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('store_details', 'Store Details & Invoice Configuration')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customize trade name, receipt headers, invoice terms, and stock rules.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              {t('business_name', 'Store / Business Name')}
            </label>
            <input
              type="text"
              value={settings.business_name}
              onChange={e => setSettings({ ...settings, business_name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              {t('currency_symbol', 'Currency Symbol')}
            </label>
            <input
              type="text"
              value={settings.currency_symbol}
              onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              {t('invoice_footer', 'Invoice Footer Policy Note')}
            </label>
            <textarea
              rows={2}
              value={settings.invoice_footer}
              onChange={e => setSettings({ ...settings, invoice_footer: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Printed at the bottom of 80mm thermal receipts and WhatsApp digital bills.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              {t('due_reminder_days', 'Automated Due Reminder (Days Before)')}
            </label>
            <input
              type="number"
              min="0"
              max="14"
              value={settings.reminder_days_before}
              onChange={e => setSettings({ ...settings, reminder_days_before: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center pt-2 sm:pt-6">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.allow_negative_stock === '1'}
                onChange={e =>
                  setSettings({ ...settings, allow_negative_stock: e.target.checked ? '1' : '0' })
                }
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-700 focus:ring-emerald-500"
              />
              <span>{t('allow_negative_stock', 'Allow Negative Stock in Emergency (Disabled by default)')}</span>
            </label>
          </div>
        </div>

        {success && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center gap-2.5 border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="font-semibold">{t('saved_successfully', 'Settings saved successfully!')}</span>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : t('save_settings', 'Save Settings')}</span>
          </button>
        </div>
      </form>

      {/* SECURITY AUDIT TRAIL */}
      <div className="glass-card p-6 sm:p-7 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('audit_trail', 'Security Audit Logs & History')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Immutable ledger recording logins, billing actions, stock changes, and permissions.
              </p>
            </div>
          </div>
          <Badge variant="purple" size="sm">
            {auditLogs.length} Events Logged
          </Badge>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No audit records found.</p>
          ) : (
            auditLogs.map(log => (
              <div
                key={log.id}
                className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs hover:bg-slate-100/60 dark:hover:bg-slate-800/70 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {log.actor_name}
                    </span>
                    <Badge variant="slate" size="sm">
                      {log.action}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {log.details}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 font-mono-numbers">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
