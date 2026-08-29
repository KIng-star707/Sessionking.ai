import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, AlertCircle, Ban, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { logAdminAction } from '../../lib/audit';

interface UserEditModalProps {
  user: any;
  onClose: () => void;
  onUserUpdated?: () => void;
  onUserDeleted?: (userId: string) => void;
}

const toDatetimeLocal = (isoString?: string) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const offset = d.getTimezoneOffset();
    const localTime = new Date(d.getTime() - offset * 60 * 1000);
    return localTime.toISOString().slice(0, 16);
  } catch {
    return '';
  }
};

export default function UserEditModal({ user, onClose, onUserUpdated, onUserDeleted }: UserEditModalProps) {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    phoneNumber: '',
    tradingMode: 'Day Trader',
    notificationsEnabled: false,
    volatilityAlertsEnabled: false,
    suspended: false,
    suspendedReason: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [suspensionReasonInput, setSuspensionReasonInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        displayName: user.displayName || user.name || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        tradingMode: user.tradingMode || 'Day Trader',
        notificationsEnabled: user.notificationsEnabled === true,
        volatilityAlertsEnabled: user.volatilityAlertsEnabled === true,
        suspended: !!user.suspended,
        suspendedReason: user.suspendedReason || ''
      });
      setSuspensionReasonInput(user.suspendedReason || 'Violating platform guidelines');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const now = new Date();
      
      const updatePayload: any = {
        displayName: formData.displayName,
        name: formData.displayName,
        email: formData.email,
        phoneNumber: formData.phoneNumber || null,
        tradingMode: formData.tradingMode,
        notificationsEnabled: formData.notificationsEnabled,
        volatilityAlertsEnabled: formData.volatilityAlertsEnabled,
        updatedAt: now.toISOString()
      };

      await updateDoc(doc(db, 'users', user.id), updatePayload);
      await logAdminAction("USER_UPDATE_PROFILE", user.id, updatePayload);
      toast.success("User profile updated successfully");
      if (onUserUpdated) onUserUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError(err.message || 'Failed to update user profile.');
      toast.error('Failed to update user profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSuspend = async () => {
    const willSuspend = !formData.suspended;
    if (willSuspend && !suspensionReasonInput.trim()) {
      toast.error("Please provide a suspension reason");
      return;
    }

    setActionLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/users/${user.id}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          suspend: willSuspend,
          reason: willSuspend ? suspensionReasonInput : null,
          suspendedBy: auth.currentUser?.email || 'Admin'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update suspension status");

      // Also ensure Firestore local update
      await updateDoc(doc(db, 'users', user.id), {
        suspended: willSuspend,
        suspendedAt: willSuspend ? new Date().toISOString() : null,
        suspendedReason: willSuspend ? suspensionReasonInput : null,
        suspendedBy: willSuspend ? (auth.currentUser?.email || 'Admin') : null,
        suspensionLiftedAt: willSuspend ? null : new Date().toISOString()
      });

      await logAdminAction(willSuspend ? "SUSPEND_USER" : "UNSUSPEND_USER", user.id, { reason: suspensionReasonInput });
      
      setFormData(prev => ({
        ...prev,
        suspended: willSuspend,
        suspendedReason: willSuspend ? suspensionReasonInput : ''
      }));

      toast.success(willSuspend ? "User suspended successfully" : "User restored successfully");
      setShowSuspendConfirm(false);
      if (onUserUpdated) onUserUpdated();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to change user suspension");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setActionLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");

      // Also delete from Firestore
      try {
        await deleteDoc(doc(db, 'users', user.id));
      } catch (fErr) {
        console.warn("Direct Firestore delete completed or handled by API:", fErr);
      }

      await logAdminAction("DELETE_USER", user.id, { email: user.email });
      toast.success("User permanently deleted");
      if (onUserDeleted) onUserDeleted(user.id);
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to delete user");
    } finally {
      setActionLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const isUserAdmin = ['admin', 'super_admin', 'owner'].includes(user.role) || user.email === 'dekingsjackson@gmail.com';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card w-full max-w-lg bg-matte-black border border-white/10 overflow-hidden shadow-2xl rounded-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold font-bold text-base">
              {(formData.displayName || formData.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider text-white">Edit User Account</h2>
              <p className="text-xs text-gray-400 font-mono">ID: {user.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="bg-black/40 px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Account State:</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${formData.suspended ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
              {formData.suspended ? 'Suspended' : 'Active'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Role:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gold/10 text-gold border border-gold/20">
              {isUserAdmin ? "Admin" : "User"}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {formData.suspended && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs">
              <span className="font-bold uppercase tracking-wider block mb-1">Reason for Suspension:</span>
              <span>{formData.suspendedReason || "Violating platform guidelines"}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Display Name</label>
              <input 
                type="text" 
                value={formData.displayName}
                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:border-gold outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Email Address</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:border-gold outline-none text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Phone Number</label>
              <input 
                type="text" 
                placeholder="+1..."
                value={formData.phoneNumber}
                onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:border-gold outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Trading Mode</label>
              <select 
                value={formData.tradingMode}
                onChange={e => setFormData({ ...formData, tradingMode: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:border-gold outline-none text-sm"
              >
                <option value="Scalp Trader">Scalp Trader</option>
                <option value="Day Trader">Day Trader</option>
                <option value="Swing Trader">Swing Trader</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2.5 p-3 bg-black/40 border border-white/5 rounded-xl cursor-pointer hover:border-white/10 transition-colors">
              <input 
                type="checkbox" 
                checked={formData.notificationsEnabled}
                onChange={e => setFormData({ ...formData, notificationsEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-black/40 text-gold focus:ring-gold"
              />
              <span className="text-xs text-gray-300 font-medium">Push Notifications</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 bg-black/40 border border-white/5 rounded-xl cursor-pointer hover:border-white/10 transition-colors">
              <input 
                type="checkbox" 
                checked={formData.volatilityAlertsEnabled}
                onChange={e => setFormData({ ...formData, volatilityAlertsEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-black/40 text-gold focus:ring-gold"
              />
              <span className="text-xs text-gray-300 font-medium">Volatility Alerts</span>
            </label>
          </div>

          {/* Quick Dangerous Actions Section */}
          <div className="border-t border-white/10 pt-4 mt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Administrative Controls</h4>
            <div className="flex flex-wrap gap-2.5">
              {!isUserAdmin && (
                <button
                  type="button"
                  onClick={() => setShowSuspendConfirm(true)}
                  className={`flex-1 min-w-[140px] px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                    formData.suspended 
                      ? "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  {formData.suspended ? "Unsuspend User" : "Suspend User"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 min-w-[140px] px-3.5 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Account
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3 border-t border-white/5">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="bg-gold text-matte-black hover:bg-gold/90 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50 shadow-lg"
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        {/* Suspend Confirmation Modal */}
        <AnimatePresence>
          {showSuspendConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md p-6 z-20 flex flex-col justify-center"
            >
              <h3 className="text-lg font-bold uppercase tracking-wider text-white mb-2">
                {formData.suspended ? "Restore Account" : "Suspend User"}
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                {formData.suspended
                  ? "This will remove the restriction and allow the user to access SessionKing features immediately."
                  : "Suspending this user will immediately revoke active sessions and prevent signal generation."}
              </p>

              {!formData.suspended && (
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Reason for Suspension (Required)
                  </label>
                  <textarea
                    value={suspensionReasonInput}
                    onChange={(e) => setSuspensionReasonInput(e.target.value)}
                    placeholder="Enter reason..."
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white text-xs focus:border-gold outline-none h-20 resize-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSuspendConfirm(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleToggleSuspend}
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
                    formData.suspended ? "bg-green-500 text-white" : "bg-amber-500 text-black font-extrabold"
                  }`}
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {formData.suspended ? "Confirm Restore" : "Confirm Suspension"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md p-6 z-20 flex flex-col justify-center"
            >
              <h3 className="text-lg font-bold uppercase tracking-wider text-red-400 mb-2">
                Permanently Delete User
              </h3>
              <p className="text-xs text-gray-300 mb-6">
                Are you sure you want to permanently delete <strong>{user.email || user.displayName || user.id}</strong>? All profile data, records, and access credentials will be removed. This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Permanent Deletion
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
