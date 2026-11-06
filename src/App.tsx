import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ShopProvider } from './context/ShopContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { LoginView } from './components/auth/LoginView';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { BusinessOverviewView } from './components/dashboard/BusinessOverviewView';
import { PosScreen } from './components/billing/PosScreen';
import { BillsHistoryView } from './components/billing/BillsHistoryView';
import { ProductList } from './components/inventory/ProductList';
import { TailorAdminView } from './components/tailors/TailorAdminView';
import { TailorPortalView } from './components/tailors/TailorPortalView';
import { CreditLedger } from './components/credit/CreditLedger';
import { CustomerList } from './components/customers/CustomerList';
import { ExpenseManager } from './components/expenses/ExpenseManager';
import { SupplierManager } from './components/suppliers/SupplierManager';
import { ReportsDashboard } from './components/reports/ReportsDashboard';
import { UserManager } from './components/users/UserManager';
import { SettingsView } from './components/settings/SettingsView';
import { Lock } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();
  const [currentTab, setCurrentTab] = useState<ActiveTab>('dashboard');

  // Global Keyboard Shortcuts (F2 for POS Billing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setCurrentTab('pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-400">Loading Smart Dress Shop ERP...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

  // Tailor Role: Render dedicated Tailor Portal directly (Read-Only watch board as requested)
  if (user.role === 'TAILOR') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex">
          <Sidebar currentTab="tailors" onTabChange={() => {}} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <TailorPortalView />
          </main>
        </div>
      </div>
    );
  }

  // Check if current user has permission to view this tab
  const hasAccessToTab = (tab: ActiveTab): boolean => {
    if (user?.role === 'OWNER') return true;
    if (tab === 'dashboard') return true;
    if (tab === 'business_overview') return false; // Owner only, already checked above
    const p = user?.permissions;
    if (!p) return false;

    switch (tab) {
      case 'pos':
      case 'bills':
      case 'customers':
        return p.can_billing === 1;
      case 'inventory':
        return p.can_inventory === 1 || p.can_stock_transfer === 1;
      case 'tailors':
        return p.can_tailors === 1 || p.can_salary === 1;
      case 'credit':
        return p.can_credit === 1;
      case 'expenses':
        return p.can_expenses === 1;
      case 'suppliers':
        return p.can_suppliers === 1;
      case 'reports':
        return p.can_reports === 1 || p.can_profit_view === 1;
      case 'users':
        return p.can_users === 1;
      case 'settings':
        return p.can_settings === 1;
      default:
        return true;
    }
  };

  // General Staff & Owner Workspace
  const renderActiveTab = () => {
    if (!hasAccessToTab(currentTab)) {
      return (
        <div className="glass-card p-10 text-center max-w-md mx-auto my-12 border-rose-200 dark:border-rose-900/50 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Access Restricted by Owner
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            The shop owner has not granted your account permission to view this section.
          </p>
          <button
            onClick={() => setCurrentTab('dashboard')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    switch (currentTab) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentTab} />;
      case 'business_overview':
        return <BusinessOverviewView />;
      case 'pos':
        return <PosScreen onNavigateToHistory={() => setCurrentTab('bills')} />;
      case 'bills':
        return <BillsHistoryView />;
      case 'inventory':
        return <ProductList />;
      case 'tailors':
        return <TailorAdminView />;
      case 'credit':
        return <CreditLedger />;
      case 'customers':
        return <CustomerList />;
      case 'expenses':
        return <ExpenseManager />;
      case 'suppliers':
        return <SupplierManager />;
      case 'reports':
        return <ReportsDashboard />;
      case 'users':
        return <UserManager />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar />
      <div className="flex-1 flex">
        <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {renderActiveTab()}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ShopProvider>
            <AppContent />
          </ShopProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
