import React, { useState, useEffect, useCallback } from 'react';
import {
  Scissors,
  Plus,
  Calendar,
  IndianRupee,
  UserCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Eye,
  Package,
  ArrowRight,
  Edit3,
  User,
  Phone,
  Hash,
  ChevronDown,
  FileText,
  RotateCcw,
  Shirt,
  AlertTriangle,
  X,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Layers,
  PlusCircle,
  Filter,
  ClipboardList,
} from 'lucide-react';
import { Tailor, TailorWorkOrder } from '../../types';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { StatCard } from '../common/StatCard';
import { AttendanceModal } from './AttendanceModal';
import { SalaryPaymentModal } from './SalaryPaymentModal';
import { Modal } from '../common/Modal';

// =============== SUB-VIEW TYPE ================
type TailorSubView = 'roster' | 'profile';

export const TailorAdminView: React.FC = () => {
  const { activeShop, currency } = useShop();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isOwner = user?.role === 'OWNER';

  // ------- State -------
  const [tailors, setTailors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTailorForPay, setSelectedTailorForPay] = useState<Tailor | null>(null);

  const [showAddTailorModal, setShowAddTailorModal] = useState(false);
  const [showEditTailorModal, setShowEditTailorModal] = useState(false);
  const [editingTailor, setEditingTailor] = useState<any>(null);

  const [showAssignWorkModal, setShowAssignWorkModal] = useState(false);
  const [showRecordReturnModal, setShowRecordReturnModal] = useState(false);

  // Sub-view: roster (default) or tailor profile
  const [subView, setSubView] = useState<TailorSubView>('roster');
  const [profileTailorId, setProfileTailorId] = useState<string>('');
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTimeRange, setProfileTimeRange] = useState<string>('all');
  const [profileDressType, setProfileDressType] = useState<string>('all');

  // Work orders & Dress types (shared for modals)
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [workOrderSummary, setWorkOrderSummary] = useState<any>({});
  const [dressTypes, setDressTypes] = useState<any[]>([]);
  const [returnsHistory, setReturnsHistory] = useState<any[]>([]);

  // ------- Fetch Tailors -------
  const fetchTailors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.tailors.getAll({ status: statusFilter !== 'all' ? statusFilter : undefined });
      setTailors(res.tailors || []);
    } catch (err) {
      console.error('Failed to load tailors:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchDressTypes = async () => {
    try {
      const res = await api.tailors.getDressTypes();
      setDressTypes(res.dress_types || []);
    } catch (err) {
      console.error('Failed to load dress types:', err);
    }
  };

  const fetchWorkOrders = async (tailorId?: string) => {
    try {
      const res = await api.tailors.getWorkOrders({ tailor_id: tailorId || 'all' });
      setWorkOrders(res.work_orders || []);
      setWorkOrderSummary(res.summary || {});
    } catch (err) {
      console.error('Failed to load work orders:', err);
    }
  };

  const fetchProfile = async (tailorId: string) => {
    try {
      setProfileLoading(true);
      const res = await api.tailors.getProfile(tailorId, {
        time_range: profileTimeRange,
        dress_type: profileDressType,
      });
      setProfileData(res);
    } catch (err) {
      console.error('Failed to load tailor profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    fetchTailors();
    fetchDressTypes();
    fetchWorkOrders();
  }, [fetchTailors]);

  useEffect(() => {
    if (subView === 'profile' && profileTailorId) {
      fetchProfile(profileTailorId);
    }
  }, [subView, profileTailorId, profileTimeRange, profileDressType]);

  // ------- Filters -------
  const filteredTailors = tailors.filter(t => {
    return (
      search === '' ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.tailor_code || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  // ------- KPI Summaries -------
  const activeTailors = tailors.filter(t => t.account_status === 'active').length;
  const totalAssigned = tailors.reduce((s, t) => s + (Number(t.total_work_assigned) || 0), 0);
  const totalCompleted = tailors.reduce((s, t) => s + (Number(t.total_work_completed) || 0), 0);
  const totalPending = tailors.reduce((s, t) => s + (Number(t.total_work_pending) || 0), 0);

  // ------- Navigation -------
  const openProfile = (tailorId: string) => {
    setProfileTailorId(tailorId);
    setProfileTimeRange('all');
    setProfileDressType('all');
    setSubView('profile');
  };

  const handlePay = (tailor: Tailor) => {
    setSelectedTailorForPay(tailor);
    setShowPaymentModal(true);
  };

  const handleEditTailor = (tailor: any) => {
    setEditingTailor(tailor);
    setShowEditTailorModal(true);
  };

  // =========================================================================
  // RENDER: INDIVIDUAL TAILOR PROFILE (MODULE 3.E)
  // =========================================================================
  if (subView === 'profile' && profileData) {
    const p = profileData;
    const tai = p.tailor || {};
    const kpis = p.kpis || {};
    const dtBreakdown = p.dress_types_breakdown || [];
    const assignments = p.assignments || [];
    const returns = p.returns || [];
    const financials = p.financials || {};

    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-fade-in-slide">
        {/* Back Navigation */}
        <button
          onClick={() => setSubView('roster')}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Back to Tailors Roster
        </button>

        {/* Profile Header */}
        <div className="glass-card p-6 border-slate-200 dark:border-slate-800 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 z-10 relative">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-purple-600/30">
                {tai.name?.charAt(0) || '?'}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {tai.name}
                </h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-lg">
                    {tai.tailor_code}
                  </span>
                  <Badge variant={tai.account_status === 'active' ? 'emerald' : 'rose'} size="sm" dot>
                    {tai.account_status?.toUpperCase()}
                  </Badge>
                  {tai.phone && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {tai.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={profileTimeRange}
                onChange={(e) => setProfileTimeRange(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
              </select>

              <select
                value={profileDressType}
                onChange={(e) => setProfileDressType(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
              >
                <option value="all">All Dress Types</option>
                {dressTypes.map(dt => (
                  <option key={dt.id} value={dt.name}>{dt.name}</option>
                ))}
              </select>

              <button
                onClick={() => fetchProfile(profileTailorId)}
                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${profileLoading ? 'animate-spin text-emerald-500' : ''}`} />
              </button>
            </div>
          </div>

          <div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Assigned" value={`${kpis.total_assigned} Pieces`} subtitle={`${kpis.total_assignments} work orders`} icon={Package} color="blue" />
          <StatCard title="Total Completed" value={`${kpis.total_completed} Pieces`} subtitle={`${kpis.completed_jobs} orders fully done`} icon={CheckCircle2} color="emerald" />
          <StatCard title="Pending Work" value={`${kpis.total_pending} Pieces`} subtitle={`${kpis.active_jobs} active jobs`} icon={Clock} color="amber" />
          <StatCard title="Total Earned" value={`₹ ${Number(kpis.total_earned || 0).toLocaleString('en-IN')}`} subtitle="Piece-rate stitching wages" icon={IndianRupee} color="purple" />
        </div>

        {/* Dress-Type-Wise Breakdown Cards (MODULE 3.D) */}
        {dtBreakdown.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Shirt className="w-4 h-4 text-purple-500" />
              Dress-Type Wise Breakdown
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {dtBreakdown.map((dt: any) => {
                const completionPct = dt.assigned_qty > 0 ? Math.round((dt.completed_qty / dt.assigned_qty) * 100) : 0;
                return (
                  <div key={dt.dress_type} className="glass-card p-4 border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                        {dt.dress_type}
                      </span>
                      <Badge variant={dt.pending_qty === 0 ? 'emerald' : 'amber'} size="sm">
                        {dt.pending_qty === 0 ? 'DONE' : `${dt.pending_qty} pending`}
                      </Badge>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          completionPct === 100
                            ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                            : completionPct > 50
                            ? 'bg-gradient-to-r from-blue-500 to-blue-400'
                            : 'bg-gradient-to-r from-amber-500 to-amber-400'
                        }`}
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                      <div>
                        <div className="font-extrabold text-blue-600 dark:text-blue-400">{dt.assigned_qty}</div>
                        <div className="text-slate-500">Assigned</div>
                      </div>
                      <div>
                        <div className="font-extrabold text-emerald-600 dark:text-emerald-400">{dt.completed_qty}</div>
                        <div className="text-slate-500">Done</div>
                      </div>
                      <div>
                        <div className="font-extrabold text-amber-600 dark:text-amber-400">{dt.pending_qty}</div>
                        <div className="text-slate-500">Remaining</div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>{dt.order_count} order(s)</span>
                      <span className="font-bold text-emerald-600">₹{Number(dt.earned_amount).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Assignment History Table */}
        <div className="glass-card overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-500" />
              Stitching Assignment History
            </h3>
            <span className="text-xs text-slate-500">{assignments.length} assignments</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Order #</th>
                  <th className="py-2.5 px-3">Dress Type</th>
                  <th className="py-2.5 px-3 text-right">Given</th>
                  <th className="py-2.5 px-3 text-right">Stitched</th>
                  <th className="py-2.5 px-3 text-right">Remaining</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-3 text-right">Earned</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {assignments.length === 0 ? (
                  <tr><td colSpan={9} className="py-6 text-center text-slate-400">No assignments found for this filter.</td></tr>
                ) : assignments.map((a: any) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">{a.order_number}</td>
                    <td className="py-2.5 px-3 font-semibold">{a.item_type}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-blue-600">{a.given_qty}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{a.stitched_qty}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-600">{a.remaining_qty}</td>
                    <td className="py-2.5 px-3 text-right font-mono">₹{a.rate_per_piece}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">₹{Number(a.current_earned || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={a.status === 'completed' ? 'emerald' : a.status === 'in_progress' ? 'blue' : 'slate'} size="sm">
                        {a.status?.toUpperCase().replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{a.created_at?.split('T')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Return History Table (Permanent Transaction Log) */}
        <div className="glass-card overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-500" />
              Completed Work Return History (Permanent Log)
            </h3>
            <span className="text-xs text-slate-500">{returns.length} return transactions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Return #</th>
                  <th className="py-2.5 px-3">Assignment</th>
                  <th className="py-2.5 px-3">Dress Type</th>
                  <th className="py-2.5 px-3 text-right">Returned Qty</th>
                  <th className="py-2.5 px-3 text-right">Earned</th>
                  <th className="py-2.5 px-3">Return Date</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {returns.length === 0 ? (
                  <tr><td colSpan={7} className="py-6 text-center text-slate-400">No return transactions yet.</td></tr>
                ) : returns.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">{r.return_number}</td>
                    <td className="py-2.5 px-3 font-mono text-blue-600">{r.order_number}</td>
                    <td className="py-2.5 px-3 font-semibold">{r.dress_type}</td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-emerald-600">{r.completed_qty}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600">₹{Number(r.earned_amount).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 text-slate-500">{r.return_date}</td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-[120px] truncate">{r.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financials Summary */}
        <div className="glass-card p-5 border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-emerald-500" />
            Payment & Salary Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Salary</div>
              <div className="text-lg font-extrabold text-emerald-600">₹{Number(financials.total_salary || 0).toLocaleString('en-IN')}</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Paid</div>
              <div className="text-lg font-extrabold text-blue-600">₹{Number(financials.total_paid || 0).toLocaleString('en-IN')}</div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-center">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Pending Balance</div>
              <div className="text-lg font-extrabold text-amber-600">₹{Number(financials.pending_salary || 0).toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: MAIN ROSTER VIEW (MODULE 3.A)
  // =========================================================================
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-fade-in-slide">
      {/* Top Banner */}
      <div className="glass-card p-6 border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 bg-gradient-to-tr from-purple-600 to-indigo-500 rounded-xl text-white shadow-md shadow-purple-600/20">
              <Scissors className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('tailors_hub', 'Tailors Hub')}
            </h2>
            <Badge variant="purple" size="sm" dot>
              {activeTailors} Active Tailors
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            Comprehensive stitching work management — assign garments, track partial returns, monitor dress-type breakdowns, and manage tailor profiles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 z-10">
          {isOwner && (
            <>
              <button
                onClick={() => setShowAssignWorkModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 active:scale-95 transition-all"
              >
                <Package className="w-4 h-4" />
                Assign Work
              </button>
              <button
                onClick={() => setShowRecordReturnModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Record Return
              </button>
              <button
                onClick={() => setShowAddTailorModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-all border border-slate-200 dark:border-slate-700"
              >
                <Plus className="w-4 h-4" />
                Add Tailor
              </button>
            </>
          )}
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-all border border-slate-200 dark:border-slate-700"
          >
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Attendance
          </button>
          <button
            onClick={() => { fetchTailors(); fetchWorkOrders(); }}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>

        <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Tailors" value={`${activeTailors} Masters`} subtitle="Across all shops" icon={Scissors} color="purple" />
        <StatCard title="Total Work Assigned" value={`${totalAssigned} Pieces`} subtitle={`${workOrderSummary.active_jobs || 0} active jobs`} icon={Package} color="blue" />
        <StatCard title="Total Completed" value={`${totalCompleted} Pieces`} subtitle={`${workOrderSummary.completed_jobs || 0} orders done`} icon={CheckCircle2} color="emerald" />
        <StatCard
          title="Pending Stitching"
          value={`${totalPending} Pieces`}
          subtitle="Remaining across all tailors"
          icon={Clock}
          color={totalPending > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="glass-card p-4 border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search tailor name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="text-xs text-slate-500 font-semibold">
            {filteredTailors.length} tailor(s)
          </span>
        </div>
      </div>

      {/* Tailor Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTailors.map(tailor => (
          <div key={tailor.id} className="glass-card p-5 border-slate-200 dark:border-slate-800 space-y-4 hover:shadow-lg transition-all duration-200 group relative overflow-hidden">
            {/* Status indicator */}
            <div className={`absolute top-0 right-0 w-2 h-16 rounded-bl-xl ${tailor.account_status === 'active' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />

            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-extrabold text-sm shadow-lg ${
                tailor.account_status === 'active'
                  ? 'bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-purple-600/20'
                  : 'bg-gradient-to-tr from-slate-500 to-slate-400 shadow-slate-500/20'
              }`}>
                {tailor.name?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 dark:text-white text-sm truncate">{tailor.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-purple-400">{tailor.tailor_code}</span>
                  <Badge variant={tailor.account_status === 'active' ? 'emerald' : 'slate'} size="sm">
                    {tailor.account_status?.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Work order stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400">{Number(tailor.total_work_assigned) || 0}</div>
                <div className="text-[10px] text-slate-500 font-semibold">Assigned</div>
              </div>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{Number(tailor.total_work_completed) || 0}</div>
                <div className="text-[10px] text-slate-500 font-semibold">Completed</div>
              </div>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
                <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{Number(tailor.total_work_pending) || 0}</div>
                <div className="text-[10px] text-slate-500 font-semibold">Pending</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => openProfile(tailor.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl text-xs font-bold transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                View Profile
              </button>

              <div className="flex items-center gap-1">
                {isOwner && (
                  <>
                    <button
                      onClick={() => handleEditTailor(tailor)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                      title="Edit Tailor"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handlePay(tailor as Tailor)}
                      className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"
                      title="Disburse Pay"
                    >
                      <IndianRupee className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTailors.length === 0 && !loading && (
        <div className="glass-card p-10 text-center border-slate-200 dark:border-slate-800">
          <Scissors className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-semibold">No tailors found matching your search.</p>
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Add Tailor Modal */}
      <AddTailorModal
        isOpen={showAddTailorModal}
        onClose={() => setShowAddTailorModal(false)}
        onSuccess={() => { fetchTailors(); setShowAddTailorModal(false); }}
      />

      {/* Edit Tailor Modal */}
      <EditTailorModal
        isOpen={showEditTailorModal}
        onClose={() => { setShowEditTailorModal(false); setEditingTailor(null); }}
        tailor={editingTailor}
        onSuccess={() => { fetchTailors(); setShowEditTailorModal(false); setEditingTailor(null); }}
      />

      {/* Assign Work Modal */}
      <AssignWorkModal
        isOpen={showAssignWorkModal}
        onClose={() => setShowAssignWorkModal(false)}
        tailors={tailors}
        dressTypes={dressTypes}
        onSuccess={() => { fetchTailors(); fetchWorkOrders(); setShowAssignWorkModal(false); }}
        onAddDressType={fetchDressTypes}
      />

      {/* Record Return Modal */}
      <RecordReturnModal
        isOpen={showRecordReturnModal}
        onClose={() => setShowRecordReturnModal(false)}
        tailors={tailors}
        onSuccess={() => { fetchTailors(); fetchWorkOrders(); setShowRecordReturnModal(false); }}
      />

      {/* Attendance Modal */}
      <AttendanceModal
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        tailors={tailors as Tailor[]}
        onSuccess={fetchTailors}
      />

      {/* Salary Payment Modal */}
      <SalaryPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        tailor={selectedTailorForPay}
        onSuccess={fetchTailors}
      />
    </div>
  );
};

// =========================================================================
// ADD TAILOR MODAL (MODULE 3.A)
// =========================================================================
const AddTailorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ isOpen, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    assigned_shop: 'retail',
    salary_type: 'per_piece',
    shirt_rate: 50,
    pant_rate: 70,
    blouse_rate: 60,
    other_rate: 40,
    login_user_id: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      await api.tailors.createTailor(form);
      setForm({ name: '', phone: '', assigned_shop: 'retail', salary_type: 'per_piece', shirt_rate: 50, pant_rate: 70, blouse_rate: 60, other_rate: 40, login_user_id: '', password: '' });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create tailor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Tailor" subtitle="Create a new tailor profile with login credentials" maxWidth="xl">
      <div className="space-y-4">
        {error && <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-800">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Tailor Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ramanan" className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Phone *</label>
            <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 9876543210" className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Assigned Shop</label>
            <select value={form.assigned_shop} onChange={e => setForm({ ...form, assigned_shop: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Salary Type</label>
            <select value={form.salary_type} onChange={e => setForm({ ...form, salary_type: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              <option value="per_piece">Per Piece</option>
              <option value="monthly">Monthly</option>
              <option value="daily">Daily</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Login ID (optional)</label>
            <input type="text" value={form.login_user_id} onChange={e => setForm({ ...form, login_user_id: e.target.value })} placeholder="Auto-generated if blank" className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Password (default: Tailor@123)</label>
            <input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Tailor@123" className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Shirt Rate</label>
            <input type="number" value={form.shirt_rate} onChange={e => setForm({ ...form, shirt_rate: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pant Rate</label>
            <input type="number" value={form.pant_rate} onChange={e => setForm({ ...form, pant_rate: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Blouse Rate</label>
            <input type="number" value={form.blouse_rate} onChange={e => setForm({ ...form, blouse_rate: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Other Rate</label>
            <input type="number" value={form.other_rate} onChange={e => setForm({ ...form, other_rate: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition-all">
            {submitting ? 'Creating...' : 'Create Tailor'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// =========================================================================
// EDIT TAILOR MODAL (MODULE 3.A - Edit / Deactivate)
// =========================================================================
const EditTailorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tailor: any;
  onSuccess: () => void;
}> = ({ isOpen, onClose, tailor, onSuccess }) => {
  const [form, setForm] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tailor) {
      setForm({
        name: tailor.name || '',
        phone: tailor.phone || '',
        assigned_shop: tailor.assigned_shop || 'retail',
        salary_type: tailor.salary_type || 'per_piece',
        shirt_rate: tailor.shirt_rate || 50,
        pant_rate: tailor.pant_rate || 70,
        blouse_rate: tailor.blouse_rate || 60,
        other_rate: tailor.other_rate || 40,
        account_status: tailor.account_status || 'active',
      });
    }
  }, [tailor]);

  const handleSubmit = async () => {
    if (!tailor?.id) return;
    try {
      setSubmitting(true);
      setError('');
      await api.tailors.updateTailor(tailor.id, form);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update tailor.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!tailor) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Tailor: ${tailor?.name}`} subtitle="Update profile details or deactivate without deleting records" maxWidth="xl">
      <div className="space-y-4">
        {error && <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-800">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Tailor Name</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Phone</label>
            <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Account Status</label>
            <select value={form.account_status} onChange={e => setForm({ ...form, account_status: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              <option value="active">Active</option>
              <option value="inactive">Inactive (Preserve History)</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Assigned Shop</label>
            <select value={form.assigned_shop} onChange={e => setForm({ ...form, assigned_shop: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </div>
        </div>

        {form.account_status === 'inactive' && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Deactivating will disable the tailor's login. All historical records (work orders, returns, salary) will be preserved permanently.</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition-all">
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// =========================================================================
// ASSIGN WORK MODAL (MODULE 3.B)
// =========================================================================
const AssignWorkModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tailors: any[];
  dressTypes: any[];
  onSuccess: () => void;
  onAddDressType: () => void;
}> = ({ isOpen, onClose, tailors, dressTypes, onSuccess, onAddDressType }) => {
  const [form, setForm] = useState({
    tailor_id: '',
    item_type: 'Skirts',
    given_qty: 0,
    rate_per_piece: 50,
    due_date: '',
    notes: '',
    shop_id: 'shop_retail',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showNewDressType, setShowNewDressType] = useState(false);
  const [newDressTypeName, setNewDressTypeName] = useState('');
  const [newDressTypeRate, setNewDressTypeRate] = useState(50);

  const totalAmount = (form.given_qty || 0) * (form.rate_per_piece || 0);
  const activeTailors = tailors.filter(t => t.account_status === 'active');

  const handleDressTypeChange = (name: string) => {
    const dt = dressTypes.find(d => d.name === name);
    setForm({ ...form, item_type: name, rate_per_piece: dt?.default_rate || form.rate_per_piece });
  };

  const handleAddNewDressType = async () => {
    if (!newDressTypeName.trim()) return;
    try {
      await api.tailors.addDressType({ name: newDressTypeName.trim(), default_rate: newDressTypeRate });
      setShowNewDressType(false);
      setNewDressTypeName('');
      onAddDressType();
      setForm({ ...form, item_type: newDressTypeName.trim() });
    } catch (err: any) {
      setError(err.message || 'Failed to add dress type.');
    }
  };

  const handleSubmit = async () => {
    if (!form.tailor_id) { setError('Select a tailor.'); return; }
    if (!form.given_qty || form.given_qty <= 0) { setError('Quantity must be greater than zero.'); return; }
    try {
      setSubmitting(true);
      setError('');
      await api.tailors.createWorkOrder(form);
      setForm({ tailor_id: '', item_type: 'Skirts', given_qty: 0, rate_per_piece: 50, due_date: '', notes: '', shop_id: 'shop_retail' });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to assign work.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign New Stitching Work" subtitle="Give garments to a tailor for stitching" maxWidth="xl">
      <div className="space-y-4">
        {error && <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-800">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Select Tailor *</label>
            <select value={form.tailor_id} onChange={e => setForm({ ...form, tailor_id: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold">
              <option value="">— Choose Tailor —</option>
              {activeTailors.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.tailor_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Dress Type *</label>
            <div className="flex gap-1">
              <select value={form.item_type} onChange={e => handleDressTypeChange(e.target.value)} className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold">
                {dressTypes.map(dt => (
                  <option key={dt.id} value={dt.name}>{dt.name} (₹{dt.default_rate})</option>
                ))}
              </select>
              <button onClick={() => setShowNewDressType(!showNewDressType)} className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 rounded-xl transition-colors" title="Add new dress type">
                <PlusCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showNewDressType && (
            <div className="sm:col-span-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 space-y-2">
              <div className="text-xs font-bold text-purple-700 dark:text-purple-300">Add Custom Dress Type</div>
              <div className="flex gap-2">
                <input type="text" value={newDressTypeName} onChange={e => setNewDressTypeName(e.target.value)} placeholder="e.g. Palazzo Pants" className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                <input type="number" value={newDressTypeRate} onChange={e => setNewDressTypeRate(Number(e.target.value))} placeholder="Rate" className="w-20 px-3 py-1.5 text-xs rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
                <button onClick={handleAddNewDressType} className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg">Add</button>
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Quantity Given *</label>
            <input type="number" value={form.given_qty || ''} onChange={e => setForm({ ...form, given_qty: Number(e.target.value) })} placeholder="e.g. 100" min={1} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Rate Per Piece (₹)</label>
            <input type="number" value={form.rate_per_piece} onChange={e => setForm({ ...form, rate_per_piece: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Expected Completion Date</label>
            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Shop</label>
            <select value={form.shop_id} onChange={e => setForm({ ...form, shop_id: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              <option value="shop_retail">Retail Shop</option>
              <option value="shop_wholesale">Wholesale Shop</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Optional instructions..." className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
        </div>

        {/* Auto-computed total */}
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Total Stitching Amount (Auto):</span>
          <span className="text-lg font-extrabold text-emerald-600">₹{totalAmount.toLocaleString('en-IN')}</span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition-all">
            {submitting ? 'Assigning...' : 'Assign Work'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// =========================================================================
// RECORD RETURN MODAL (MODULE 3.C - Partial Returns with Validation)
// =========================================================================
const RecordReturnModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tailors: any[];
  onSuccess: () => void;
}> = ({ isOpen, onClose, tailors, onSuccess }) => {
  const [selectedTailor, setSelectedTailor] = useState('');
  const [tailorWorkOrders, setTailorWorkOrders] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [completedQty, setCompletedQty] = useState<number>(0);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const activeTailors = tailors.filter(t => t.account_status === 'active');

  // Fetch work orders for selected tailor (only in_progress)
  useEffect(() => {
    if (selectedTailor) {
      api.tailors.getWorkOrders({ tailor_id: selectedTailor, status: 'in_progress' })
        .then(res => setTailorWorkOrders(res.work_orders || []))
        .catch(() => setTailorWorkOrders([]));
    } else {
      setTailorWorkOrders([]);
    }
    setSelectedAssignment('');
    setCompletedQty(0);
  }, [selectedTailor]);

  const selectedWo = tailorWorkOrders.find(w => w.id === selectedAssignment);
  const remaining = selectedWo ? (selectedWo.given_qty - selectedWo.stitched_qty) : 0;
  const earnedPreview = completedQty * (selectedWo?.rate_per_piece || 0);

  const handleSubmit = async () => {
    if (!selectedAssignment) { setError('Select a work assignment.'); return; }
    if (!completedQty || completedQty <= 0) { setError('Completed quantity must be a positive number.'); return; }
    if (completedQty > remaining) { setError(`Cannot exceed remaining quantity (${remaining}).`); return; }

    try {
      setSubmitting(true);
      setError('');
      setSuccessMsg('');
      const res = await api.tailors.recordReturn({
        assignment_id: selectedAssignment,
        completed_qty: completedQty,
        return_date: returnDate,
        notes,
      });
      setSuccessMsg(res.message);
      setCompletedQty(0);
      setNotes('');
      setSelectedAssignment('');
      // Refresh work orders for this tailor
      const updated = await api.tailors.getWorkOrders({ tailor_id: selectedTailor, status: 'in_progress' });
      setTailorWorkOrders(updated.work_orders || []);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to record return.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Completed Stitching Work" subtitle="Record partial or full return of stitched garments" maxWidth="xl">
      <div className="space-y-4">
        {error && <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-800">{error}</div>}
        {successMsg && <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-xs font-semibold rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{successMsg}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Select Tailor *</label>
            <select value={selectedTailor} onChange={e => setSelectedTailor(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold">
              <option value="">— Choose Tailor —</option>
              {activeTailors.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.tailor_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Select Active Assignment *</label>
            <select value={selectedAssignment} onChange={e => setSelectedAssignment(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold">
              <option value="">— Choose Work Order —</option>
              {tailorWorkOrders.map(wo => (
                <option key={wo.id} value={wo.id}>
                  {wo.order_number} • {wo.item_type} (Remaining: {wo.given_qty - wo.stitched_qty})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedWo && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 grid grid-cols-4 gap-2 text-center text-xs">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Originally Assigned</div>
              <div className="font-extrabold text-blue-600 text-sm">{selectedWo.given_qty}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Already Completed</div>
              <div className="font-extrabold text-emerald-600 text-sm">{selectedWo.stitched_qty}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Remaining Pending</div>
              <div className="font-extrabold text-amber-600 text-sm">{remaining}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Rate / Piece</div>
              <div className="font-extrabold text-slate-900 dark:text-white text-sm">₹{selectedWo.rate_per_piece}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
              Completed Quantity * <span className="text-amber-600">(Max: {remaining})</span>
            </label>
            <input type="number" value={completedQty || ''} onChange={e => setCompletedQty(Number(e.target.value))} min={1} max={remaining} placeholder={`1 to ${remaining}`} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Return Date</label>
            <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Quality notes, batch info..." className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
        </div>

        {completedQty > 0 && selectedWo && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              Earned for this return: {completedQty} × ₹{selectedWo.rate_per_piece} =
            </span>
            <span className="text-lg font-extrabold text-emerald-600">₹{earnedPreview.toLocaleString('en-IN')}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !selectedAssignment || completedQty <= 0} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition-all">
            {submitting ? 'Recording...' : 'Record Return'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
