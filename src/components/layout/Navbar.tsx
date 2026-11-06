import React, { useState } from 'react';
import {
  Store,
  Bell,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Check,
  Sparkles,
  Sun,
  Moon,
  Laptop,
  Languages,
} from 'lucide-react';
import { useAuth, DEMO_USERS } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage, LanguageCode } from '../../context/LanguageContext';
import { Badge } from '../common/Badge';
import { NotificationDrawer } from '../common/NotificationDrawer';

export const Navbar: React.FC = () => {
  const { user, logout, quickLoginAs } = useAuth();
  const { activeShop, setActiveShop, shops } = useShop();
  const { theme, setTheme, isDark } = useTheme();
  const { language, setLanguage, languages, t } = useLanguage();

  const [showShopDropdown, setShowShopDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showDemoDropdown, setShowDemoDropdown] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(2);

  const canSwitchShop = user?.role === 'OWNER' || user?.assigned_shop === 'all';

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'OWNER':
        return 'emerald';
      case 'EMPLOYEE':
        return 'blue';
      case 'TAILOR':
        return 'purple';
      default:
        return 'slate';
    }
  };

  const currentLang = languages.find(l => l.code === language) || languages[0];

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-200/80 dark:border-slate-800/80 no-print">
        <div className="px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white font-bold">
              <img src="/logo.svg" alt="Smart Dress Shop" className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-base sm:text-lg">
                  {t('app_title', 'SMART DRESS SHOP')}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  ERP
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                {t('tagline', 'Retail & Wholesale Apparel Management')}
              </p>
            </div>
          </div>

          {/* Center / Right: Shop, Language, Theme, Role Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Shop Scope Switcher */}
            {user?.role !== 'TAILOR' && (
              <div className="relative">
                <button
                  onClick={() => canSwitchShop && setShowShopDropdown(!showShopDropdown)}
                  disabled={!canSwitchShop}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                    canSwitchShop
                      ? 'bg-slate-100 hover:bg-slate-200/80 text-slate-800 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 cursor-pointer shadow-sm'
                      : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 cursor-default'
                  }`}
                >
                  <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden md:inline">Shop:</span>
                  <span className="font-bold text-slate-900 dark:text-white max-w-[100px] sm:max-w-none truncate">
                    {activeShop === 'all'
                      ? 'All Shops'
                      : shops.find(s => s.id === activeShop)?.name || 'Retail'}
                  </span>
                  {canSwitchShop && <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />}
                </button>

                {showShopDropdown && canSwitchShop && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Switch Active Entity
                    </div>
                    {shops.map(shop => (
                      <button
                        key={shop.id}
                        onClick={() => {
                          setActiveShop(shop.id);
                          setShowShopDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                          activeShop === shop.id ? 'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{shop.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{shop.code} • {shop.type}</span>
                        </div>
                        {activeShop === shop.id && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Language Selector (Compulsory: Tamil, English, Hindi, Malayalam, Telugu) */}
            <div className="relative">
              <button
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all"
                title="Change Language"
              >
                <Languages className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold">{currentLang.nativeName}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showLangDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Language
                  </div>
                  {languages.map(l => (
                    <button
                      key={l.code}
                      onClick={() => {
                        setLanguage(l.code);
                        setShowLangDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                        language === l.code
                          ? 'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{l.flag}</span>
                        <div>
                          <div className="font-medium">{l.nativeName}</div>
                          <div className="text-[10px] text-slate-400">{l.label}</div>
                        </div>
                      </div>
                      {language === l.code && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme Selector (Dark / Light / System) */}
            <div className="relative">
              <button
                onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
                title={`Theme: ${theme}`}
              >
                {theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-indigo-400" />
                ) : theme === 'light' ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : (
                  <Laptop className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                )}
              </button>

              {showThemeDropdown && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1 z-50 text-xs font-semibold">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Theme Mode
                  </div>
                  {[
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark Mode', icon: Moon },
                    { id: 'system', label: 'System Default', icon: Laptop },
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setTheme(item.id as any);
                        setShowThemeDropdown(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 ${
                        theme === item.id ? 'text-emerald-600 font-bold bg-emerald-50/50 dark:bg-emerald-950/20' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </div>
                      {theme === item.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Demo Switcher */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowDemoDropdown(!showDemoDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-all shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Switch Role</span>
                <ChevronDown className="w-3 h-3 text-amber-600" />
              </button>

              {showDemoDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50">
                  <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Instant Demo Switcher
                  </div>
                  {DEMO_USERS.map(demo => (
                    <button
                      key={demo.id}
                      onClick={async () => {
                        setShowDemoDropdown(false);
                        await quickLoginAs(demo.role, demo.id);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {demo.label}
                          {user?.user_id === demo.id && (
                            <Badge variant="emerald" size="sm">Active</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {demo.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications Button */}
            <button
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* User Profile & Logout */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                  {user?.name?.charAt(0) || <UserIcon className="w-4 h-4" />}
                </div>
                <div className="text-left hidden lg:block">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[120px]">
                    {user?.name}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Badge variant={getRoleBadgeVariant(user?.role)} size="sm">
                      {user?.role}
                    </Badge>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50">
                  <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Shop:</span>
                      <span className="text-[10px] font-semibold text-emerald-600 uppercase">
                        {user?.assigned_shop}
                      </span>
                    </div>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={logout}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t('logout', 'Sign Out')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Notification Drawer */}
      <NotificationDrawer isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </>
  );
};
