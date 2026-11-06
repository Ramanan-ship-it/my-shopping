import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Boxes,
  Scissors,
  CreditCard,
  Users,
  Wallet,
  Truck,
  BarChart3,
  ShieldCheck,
  Settings,
  Sparkles,
  Lock,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export type ActiveTab =
  | 'dashboard'
  | 'business_overview'
  | 'pos'
  | 'bills'
  | 'inventory'
  | 'tailors'
  | 'credit'
  | 'customers'
  | 'expenses'
  | 'suppliers'
  | 'reports'
  | 'users'
  | 'settings';

interface SidebarProps {
  currentTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  // If Tailor role: show tailored focused navigation (Read-only watch board as requested)
  if (user?.role === 'TAILOR') {
    return (
      <aside className="w-64 glass-panel border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between py-6 px-4 no-print min-h-[calc(100vh-4rem)]">
        <div className="space-y-6">
          <div className="px-3.5 py-3 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-2xl shadow-sm">
            <span className="text-[11px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider block">
              {t('tailor_portal', 'Tailor Portal')}
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-1">
              Code: {user?.tailor_code || user?.user_id}
            </span>
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => onTabChange('tailors')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm ${
                currentTab === 'tailors'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-600/25'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Scissors className="w-4 h-4" />
              <span>{t('tailor_portal', 'My Stitching Watch Board')}</span>
            </button>
          </nav>
        </div>

        <div className="px-3.5 py-3.5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-xs text-purple-900 dark:text-purple-300">
          <div className="font-bold flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>View-Only Watch Mode</span>
          </div>
          <p className="text-[11px] mt-1 text-slate-500 dark:text-slate-400 leading-relaxed">
            {t('tailor_watch_only', 'All work orders and piece counts are managed exclusively by the Shop Owner.')}
          </p>
        </div>
      </aside>
    );
  }

  const p = user?.permissions || {
    can_billing: 0,
    can_credit: 0,
    can_inventory: 0,
    can_stock_transfer: 0,
    can_tailors: 0,
    can_salary: 0,
    can_expenses: 0,
    can_suppliers: 0,
    can_reports: 0,
    can_profit_view: 0,
    can_settings: 0,
    can_users: 0,
  };

  const isOwner = user?.role === 'OWNER';

  interface NavSection {
    sectionTitle: string;
    items: {
      id: ActiveTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      visible: boolean;
      badge?: string;
    }[];
  }

  const navSections: NavSection[] = [
    {
      sectionTitle: 'MAIN OPERATIONS',
      items: [
        {
          id: 'dashboard',
          label: t('dashboard', 'Dashboard'),
          icon: LayoutDashboard,
          visible: true,
        },
        {
          id: 'business_overview',
          label: t('business_overview', 'Business Overview'),
          icon: Building2,
          visible: isOwner,
          badge: 'Owner',
        },
        {
          id: 'pos',
          label: t('pos', 'POS Billing'),
          icon: ShoppingCart,
          visible: isOwner || p.can_billing === 1,
          badge: 'F2',
        },
        {
          id: 'bills',
          label: t('bills', 'Bills & Invoices'),
          icon: Receipt,
          visible: isOwner || p.can_billing === 1,
        },
        {
          id: 'inventory',
          label: t('inventory', 'Inventory & Stock'),
          icon: Boxes,
          visible: isOwner || p.can_inventory === 1 || p.can_stock_transfer === 1,
        },
      ],
    },
    {
      sectionTitle: 'WORKSHOP & CUSTOMERS',
      items: [
        {
          id: 'tailors',
          label: t('tailors', 'Tailors Hub'),
          icon: Scissors,
          visible: isOwner || p.can_tailors === 1 || p.can_salary === 1,
          badge: 'Workshop',
        },
        {
          id: 'credit',
          label: t('credit', 'Customer Khata (Credit)'),
          icon: CreditCard,
          visible: isOwner || p.can_credit === 1,
        },
        {
          id: 'customers',
          label: t('customers', 'Customers Directory'),
          icon: Users,
          visible: isOwner || p.can_billing === 1,
        },
      ],
    },
    {
      sectionTitle: 'ADMINISTRATION',
      items: [
        {
          id: 'expenses',
          label: t('expenses', 'Expenses Ledger'),
          icon: Wallet,
          visible: isOwner || p.can_expenses === 1,
        },
        {
          id: 'suppliers',
          label: t('suppliers', 'Suppliers & Mills'),
          icon: Truck,
          visible: isOwner || p.can_suppliers === 1,
        },
        {
          id: 'reports',
          label: t('reports', 'Analytics & P&L'),
          icon: BarChart3,
          visible: isOwner || p.can_reports === 1 || p.can_profit_view === 1,
        },
        {
          id: 'users',
          label: t('users', 'Staff & Permissions'),
          icon: ShieldCheck,
          visible: isOwner || p.can_users === 1,
          badge: isOwner ? 'Admin' : undefined,
        },
        {
          id: 'settings',
          label: t('settings', 'System Settings'),
          icon: Settings,
          visible: isOwner || p.can_settings === 1,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between py-5 px-3.5 no-print min-h-[calc(100vh-4rem)]">
      <div className="space-y-5 overflow-y-auto pr-1">
        {navSections.map(section => {
          const visibleItems = section.items.filter(item => item.visible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.sectionTitle} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.sectionTitle}
              </div>

              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all duration-150 ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Role Console Footer Card */}
      <div className="mt-4 px-3.5 py-3 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
            {isOwner ? 'Owner Console' : 'Staff Access'}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <p className="text-[10px] mt-1 text-slate-400 leading-snug">
          {isOwner
            ? 'Full store oversight & role permission controls'
            : 'Restricted to modules permitted by Owner'}
        </p>
      </div>
    </aside>
  );
};
