import React, { useState } from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';
import { Tailor } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tailors: Tailor[];
  onSuccess: () => void;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  onClose,
  tailors,
  onSuccess,
}) => {
  const [selectedTailorId, setSelectedTailorId] = useState<string>(tailors[0]?.id || '');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<string>('present');
  const [notes, setNotes] = useState<string>('Regular shift');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const targetId = selectedTailorId || tailors[0]?.id;
    if (!targetId) {
      setError('Please select a tailor.');
      return;
    }

    try {
      setSubmitting(true);
      await api.tailors.markAttendance({
        tailor_id: targetId,
        date,
        status,
        notes,
      });

      alert('Attendance marked successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mark Tailor Daily Attendance"
      subtitle="Record presence, half-day, or leaves for workshop staff"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Tailor Master
          </label>
          <select
            value={selectedTailorId || tailors[0]?.id}
            onChange={e => setSelectedTailorId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
          >
            {tailors.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.tailor_code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Attendance Status
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            {[
              { id: 'present', label: 'Present' },
              { id: 'half_day', label: 'Half Day' },
              { id: 'leave', label: 'Approved Leave' },
              { id: 'absent', label: 'Absent' },
            ].map(s => (
              <button
                type="button"
                key={s.id}
                onClick={() => setStatus(s.id)}
                className={`py-2 px-3 rounded-lg border text-center transition-all ${
                  status === s.id
                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. On-time morning shift"
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
          />
        </div>

        {error && (
          <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
          >
            {submitting ? 'Recording...' : 'Mark Attendance'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
