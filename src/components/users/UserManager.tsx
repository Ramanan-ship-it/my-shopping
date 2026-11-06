import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  KeyRound,
  CheckCircle2,
  Lock,
  User as UserIcon,
  RefreshCw,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { User } from '../../types';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

const PERMISSION_KEYS = [
  { key: 'can_billing', label: 'POS Billing' },
  { key: 'can_credit', label: 'Credit (Khata)' },
  { key: 'can_inventory', label: 'Inventory Catalog' },
  { key: 'can_stock_transfer', label: 'Stock Transfer' },
  { key: 'can_tailors', label: 'Tailors Hub' },
  { key: 'can_salary', label: 'Tailor Salaries' },
  { key: 'can_expenses', label: 'Operating Expenses' },
  { key: 'can_suppliers', label: 'Suppliers Ledger' },
  { key: 'can_reports', label: 'Sales Reports' },
  { key: 'can_profit_view', label: 'Profit & Loss (P&L)' },
];

export const UserManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Password reset modal
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState<string>('NewPass@123');
  const [resetting, setResetting] = useState<boolean>(false);

  // New User modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>('EMP003');
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPassword, setUserPassword] = useState<string>('Employee@123');
  const [userRole, setUserRole] = useState<'EMPLOYEE' | 'OWNER'>('EMPLOYEE');
  const [assignedShop, setAssignedShop] = useState<'retail' | 'wholesale' | 'all'>('retail');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.users.getAll();
      setUsers(res.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleTogglePermission = async (targetUser: User, permKey: string) => {
    if (targetUser.role === 'OWNER') return; // Owner always has all permissions

    const currentVal = targetUser.permissions ? (targetUser.permissions as any)[permKey] : 0;
    const newVal = currentVal === 1 ? 0 : 1;

    const updatedPermissions = {
      ...targetUser.permissions,
      [permKey]: newVal,
    };

    try {
      await api.users.updatePermissions(targetUser.id, updatedPermissions);
      setUsers(prev =>
        prev.map(u =>
          u.id === targetUser.id ? { ...u, permissions: updatedPermissions } : u
        )
      );
    } catch (err) {
      console.error('Failed to toggle permission:', err);
      alert('Failed to update permission.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;

    try {
      setResetting(true);
      await api.auth.resetPassword(resetTargetUser.user_id, newPassword);
      alert(`Password updated successfully for ${resetTargetUser.name}.`);
      setResetTargetUser(null);
    } catch (err: any) {
      alert(err.message || 'Password reset failed.');
    } finally {
      setResetting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userName.trim() || !userEmail.trim()) {
      setError('Name and email are required.');
      return;
    }

    try {
      setSubmitting(true);
      await api.users.createUser({
        user_id: userId.trim(),
        name: userName.trim(),
        email: userEmail.trim(),
        password: userPassword,
        role: userRole,
        assigned_shop: assignedShop,
      });

      setShowAddModal(false);
      setUserName('');
      setUserEmail('');
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Staff Accounts & Access Permissions
            </h2>
            <Badge variant="emerald" size="sm">
              Owner Security Admin
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure employee shop assignments, granular module permissions, and reset staff passwords.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
          <button
            onClick={fetchUsers}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Staff User Cards */}
      <div className="space-y-4">
        {users.map(u => (
          <div
            key={u.id}
            className="glass-card p-5 border-slate-200 dark:border-slate-800 space-y-4"
          >
            {/* User Meta Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                  {u.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {u.name}
                    </span>
                    <Badge variant={u.role === 'OWNER' ? 'emerald' : u.role === 'TAILOR' ? 'purple' : 'blue'} size="sm">
                      {u.role}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    ID: <strong className="font-mono text-slate-700 dark:text-slate-300">{u.user_id}</strong> • {u.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="slate" size="sm">
                  Shop: {u.assigned_shop.toUpperCase()}
                </Badge>
                <button
                  onClick={() => setResetTargetUser(u)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  Reset Password
                </button>
              </div>
            </div>

            {/* Granular Permissions Matrix */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Module Access Permissions
              </span>

              {u.role === 'OWNER' ? (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Owner account possesses unrestricted administrative authorization over all store operations.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {PERMISSION_KEYS.map(perm => {
                    const isGranted = (u.permissions as any)?.[perm.key] === 1;
                    return (
                      <button
                        key={perm.key}
                        onClick={() => handleTogglePermission(u, perm.key)}
                        className={`p-2 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                          isGranted
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 font-semibold shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <span className="truncate mr-1">{perm.label}</span>
                        {isGranted ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Password Reset Modal */}
      <Modal
        isOpen={!!resetTargetUser}
        onClose={() => setResetTargetUser(null)}
        title="Reset User Password"
        subtitle={`Set a new login password for ${resetTargetUser?.name}`}
        maxWidth="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              New Password (min 6 characters)
            </label>
            <input
              type="text"
              required
              minLength={6}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setResetTargetUser(null)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
            >
              {resetting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Employee Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Staff Employee"
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Employee User ID *
              </label>
              <input
                type="text"
                required
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="EMP003"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="Suresh Krishna"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                placeholder="suresh@smartdress.com"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Initial Password *
              </label>
              <input
                type="text"
                required
                value={userPassword}
                onChange={e => setUserPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Assigned Shop
              </label>
              <select
                value={assignedShop}
                onChange={e => setAssignedShop(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              >
                <option value="retail">Retail Showroom (RET)</option>
                <option value="wholesale">Wholesale Warehouse (WHO)</option>
                <option value="all">All Shops Combined</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Account Role
              </label>
              <select
                value={userRole}
                onChange={e => setUserRole(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              >
                <option value="EMPLOYEE">Store Employee</option>
                <option value="OWNER">Store Owner (Admin)</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
            >
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
