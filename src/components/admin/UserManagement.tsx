import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { collection, doc, updateDoc, deleteDoc, onSnapshot, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { Search, Ban, Trash2, Edit, ChevronDown, ChevronUp, Activity, MapPin, Smartphone, TrendingUp, Target, Clock, AlertCircle, Eye, Users, RefreshCcw, Loader2, Copy, Check, Shield, Calendar, CreditCard } from "lucide-react";
import { logAdminAction } from "../../lib/audit";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import UserEditModal from "./UserEditModal";

function UserExpandedDetails({ 
  user, 
  onEdit, 
  onSuspend, 
  onDelete, 
  isAdmin 
}: { 
  user: any; 
  onEdit: () => void; 
  onSuspend: () => void; 
  onDelete: () => void; 
  isAdmin: boolean;
}) {
  const [dailyUsage, setDailyUsage] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const usageRef = doc(db, "users", user.id, "usage", today);
        const usageSnap = await getDoc(usageRef);
        if (usageSnap.exists()) {
          setDailyUsage(usageSnap.data().signalCount || 0);
        } else {
          setDailyUsage(0);
        }
      } catch (err) {
        console.error("Error fetching usage for user", user.id, err);
        setDailyUsage(0);
      }
    }
    fetchUsage();
  }, [user.id]);

  const copyUserId = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    toast.success("User ID copied to clipboard");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const planName = (user.currentPlan || user.plan || "free").toUpperCase();

  return (
    <div className="p-6 space-y-6 bg-black/40 border-t border-white/5">
      {/* Overview Metadata Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gold/10 text-gold rounded-xl border border-gold/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">User Unique Identifier</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-mono text-white font-bold">{user.id}</span>
              <button 
                onClick={copyUserId} 
                className="p-1 text-gray-400 hover:text-gold transition-colors"
                title="Copy UID"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Action Controls in Details */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onEdit}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit Profile
          </button>

          {!isAdmin && (
            <button
              onClick={onSuspend}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                user.suspended 
                  ? "bg-green-500/20 text-green-400 border-green-500/40 hover:bg-green-500/30" 
                  : "bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30"
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              {user.suspended ? "Unsuspend User" : "Suspend User"}
            </button>
          )}

          <button
            onClick={onDelete}
            className="px-3.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Grid of User Telemetry and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Identity & Contact */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-gold">
            <Users className="w-4 h-4" />
            <h4 className="font-bold uppercase tracking-widest text-xs">Profile & Style</h4>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Display Name:</span>
              <span className="text-white font-medium">{user.displayName || user.name || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Role:</span>
              <span className="text-gold font-bold uppercase">{user.role || (isAdmin ? "Admin" : "User")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Trading Style:</span>
              <span className="text-white">{user.tradingMode || "Day Trader"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Currency / Base:</span>
              <span className="text-white font-mono">{user.baseCurrency || "USD"}</span>
            </div>
          </div>
        </div>

        {/* Device & Connection */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-blue-400">
            <Smartphone className="w-4 h-4" />
            <h4 className="font-bold uppercase tracking-widest text-xs">Device & Client</h4>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Device Platform:</span>
              <span className="text-white">{user.deviceType || "Web Browser"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">IP Address:</span>
              <span className="text-white font-mono">{user.lastIp || "Direct Connection"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Origin / Loc:</span>
              <span className="text-white">{user.lastLoginLocation || "Web App"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Phone:</span>
              <span className="text-white">{user.phoneNumber || "Not provided"}</span>
            </div>
          </div>
        </div>

        {/* Activity & Signals */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-purple-400">
            <Activity className="w-4 h-4" />
            <h4 className="font-bold uppercase tracking-widest text-xs">Signal Activity</h4>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Daily Usage:</span>
              <span className="text-white font-bold">{dailyUsage !== null ? `${dailyUsage} signals` : "Loading..."}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Generated:</span>
              <span className="text-white">{user.totalSignals || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Push Alerts:</span>
              <span className={user.notificationsEnabled ? "text-green-400" : "text-gray-500"}>
                {user.notificationsEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Volatility Alerts:</span>
              <span className={user.volatilityAlertsEnabled ? "text-green-400" : "text-gray-500"}>
                {user.volatilityAlertsEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Timestamps & Performance */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-green-400">
            <Clock className="w-4 h-4" />
            <h4 className="font-bold uppercase tracking-widest text-xs">Timestamps</h4>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Created:</span>
              <span className="text-white">
                {user.createdAt ? new Date(user.createdAt.seconds ? user.createdAt.seconds * 1000 : user.createdAt).toLocaleDateString() : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last Login:</span>
              <span className="text-white">
                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Win Rate:</span>
              <span className="text-green-400 font-bold">{user.winRate != null ? `${user.winRate}%` : "78% (Avg)"}</span>
            </div>
            {user.suspended && (
              <div className="flex justify-between text-red-400 font-bold">
                <span>Suspended:</span>
                <span>{user.suspendedReason || "Active Block"}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "suspended">("all");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ type: 'suspend' | 'delete', userId: string, userEmail?: string, isSuspended?: boolean, message: string } | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());

  const handleSyncAuth = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/users/sync", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      const msg = data.message || "Sync successful";
      setSyncResult(msg);
      toast.success(msg);
    } catch (e: any) {
      console.error(e);
      setSyncResult("Error: " + e.message);
      toast.error("Sync error: " + e.message);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snap) => {
      const usersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching users:", err);
      setError("Unable to load data");
      setLoading(false);
    });

    const unsubscribeAdmins = onSnapshot(collection(db, "admins"), (snap) => {
      const ids = new Set(snap.docs.map(doc => doc.id));
      setAdminIds(ids);
    }, (err) => {
      console.error("Error fetching admins:", err);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeAdmins();
    };
  }, []);

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.displayName || u.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.phoneNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.id || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const isSuspended = !!u.suspended;
    const matchesStatus = filterStatus === "all" ? true : (filterStatus === "suspended" ? isSuspended : !isSuspended);

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => !u.suspended).length,
    suspended: users.filter(u => u.suspended).length,
    verified: users.filter(u => u.emailVerified || u.phoneNumber).length
  };

  const handleUpdatePlan = async (userId: string, newPlan: string) => {
    try {
      const isUpgrading = newPlan !== 'free';
      const now = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(now.getFullYear() + 1); // 1 year of access

      await updateDoc(doc(db, "users", userId), { 
        plan: newPlan,
        currentPlan: newPlan,
        subscriptionActive: isUpgrading,
        subscriptionStartDate: isUpgrading ? now.toISOString() : null,
        subscriptionExpiryDate: isUpgrading ? expiryDate.toISOString() : null,
        paymentStatus: isUpgrading ? 'successful' : 'none',
        updatedAt: now.toISOString()
      });
      await logAdminAction("PLAN_CHANGE", userId, { newPlan });
      toast.success(`User plan updated to ${newPlan.toUpperCase()}`);
    } catch (error: any) {
      console.error("Error updating plan:", error);
      toast.error(error.message || "Failed to update plan");
    }
  };

  const handleToggleSuspend = (user: any) => {
    const isSuspended = !!user.suspended;
    setSuspensionReason(user.suspendedReason || "Violating platform guidelines");
    setConfirmModal({
      type: 'suspend',
      userId: user.id,
      userEmail: user.email || user.displayName || user.id,
      isSuspended,
      message: isSuspended 
        ? `Are you sure you want to restore account access for ${user.email || user.displayName || user.id}?`
        : `Are you sure you want to suspend ${user.email || user.displayName || user.id}? Suspended users will be immediately logged out and barred from signals.`
    });
  };

  const handleDelete = (user: any) => {
    setConfirmModal({
      type: 'delete',
      userId: user.id,
      userEmail: user.email || user.displayName || user.id,
      message: `Are you sure you want to permanently delete user ${user.email || user.displayName || user.id}? This will remove all their data from Firestore and Authentication.`
    });
  };

  const confirmAction = async () => {
    if (!confirmModal) return;
    
    if (confirmModal.type === 'suspend' && !confirmModal.isSuspended && !suspensionReason.trim()) {
      toast.error("A reason is required to suspend a user.");
      return;
    }

    setActionLoading(true);
    
    try {
      const token = await auth.currentUser?.getIdToken();
      if (confirmModal.type === 'suspend') {
         const suspend = !confirmModal.isSuspended;
         const res = await fetch(`/api/admin/users/${confirmModal.userId}/suspend`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
              suspend, 
              reason: suspend ? suspensionReason : null,
              suspendedBy: auth.currentUser?.email || 'Admin'
            })
         });
         
         const data = await res.json();
         if (!res.ok) throw new Error(data.error || "Failed to update suspension");
         
         // Direct Firestore update for immediate UI reactivity
         await updateDoc(doc(db, "users", confirmModal.userId), {
           suspended: suspend,
           suspendedAt: suspend ? new Date().toISOString() : null,
           suspendedReason: suspend ? suspensionReason : null,
           suspendedBy: suspend ? (auth.currentUser?.email || 'Admin') : null,
           suspensionLiftedAt: suspend ? null : new Date().toISOString()
         });

         await logAdminAction(confirmModal.isSuspended ? "UNSUSPEND_USER" : "SUSPEND_USER", confirmModal.userId, { reason: suspensionReason });
         toast.success(suspend ? "User suspended successfully" : "User restored successfully");
      } else if (confirmModal.type === 'delete') {
        const res = await fetch(`/api/admin/users/${confirmModal.userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete user");

        // Direct Firestore delete
        try {
          await deleteDoc(doc(db, "users", confirmModal.userId));
        } catch (fErr) {
          console.warn("Direct Firestore delete completed or handled by API:", fErr);
        }

        await logAdminAction("DELETE_USER", confirmModal.userId, { email: confirmModal.userEmail });
        toast.success("User permanently deleted");
      }
      setConfirmModal(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleExpand = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span className="font-bold">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-black border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-3">
                {confirmModal.type === 'delete' ? (
                  <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
                    <Trash2 className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                    <Ban className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold uppercase tracking-wider text-white">
                    {confirmModal.type === 'delete' ? 'Delete User Account' : confirmModal.isSuspended ? 'Restore User Account' : 'Suspend User Account'}
                  </h3>
                  <p className="text-xs text-gray-400 font-mono">{confirmModal.userEmail}</p>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                {confirmModal.message}
              </p>

              {confirmModal.type === 'suspend' && !confirmModal.isSuspended && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Suspension Reason (Required)
                  </label>
                  <textarea
                    value={suspensionReason}
                    onChange={(e) => setSuspensionReason(e.target.value)}
                    placeholder="Enter reason for suspension (e.g. Terms violation, multiple sessions abuse)..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-gold focus:ring-1 focus:ring-gold outline-none resize-none h-20"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setConfirmModal(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction}
                  disabled={actionLoading}
                  className={cn(
                    "px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg",
                    confirmModal.type === 'delete'
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : confirmModal.isSuspended 
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-amber-500 hover:bg-amber-600 text-black font-extrabold"
                  )}
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {confirmModal.type === 'delete' ? 'Delete Permanently' : confirmModal.isSuspended ? 'Restore Account' : 'Suspend User'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-white">User Management & Accounts</h2>
          <p className="text-xs text-gray-400 mt-1">Manage all registered traders, subscriptions, access controls, and suspensions.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {syncResult && (
            <span className={cn(
              "text-xs font-bold px-3 py-1.5 rounded-lg",
              syncResult.includes("Error") ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"
            )}>
              {syncResult}
            </span>
          )}
          <button
            onClick={handleSyncAuth}
            disabled={syncing}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all uppercase tracking-wider shadow-md hover:border-gold/50"
            title="Synchronize user profiles with Firebase Auth"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin text-gold" /> : <RefreshCcw className="w-4 h-4 text-gold" />}
            Sync with Auth
          </button>
        </div>
      </div>

      {/* Quick Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Total Accounts</p>
            <p className="text-2xl font-bold text-white mt-0.5">{stats.total}</p>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Active Traders</p>
            <p className="text-2xl font-bold text-green-400 mt-0.5">{stats.active}</p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-xl text-green-400 border border-green-500/20">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Verified Contact</p>
            <p className="text-2xl font-bold text-gold mt-0.5">{stats.verified}</p>
          </div>
          <div className="p-3 bg-gold/10 rounded-xl text-gold border border-gold/20">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Suspended</p>
            <p className="text-2xl font-bold text-red-400 mt-0.5">{stats.suspended}</p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-xl text-red-400 border border-red-500/20">
            <Ban className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-black/40 p-3.5 rounded-2xl border border-white/10">
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-gold text-xs font-bold uppercase tracking-wider"
          >
            <option value="all">Status: All Traders</option>
            <option value="active">Status: Active Only</option>
            <option value="suspended">Status: Suspended Only</option>
          </select>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name, email, phone, UID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white focus:outline-none focus:border-gold w-full text-xs"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/60 border-b border-white/10 text-[11px] uppercase tracking-widest text-gray-400">
                <th className="p-4 font-bold">User Identity</th>
                <th className="p-4 font-bold">Contact / Phone</th>
                <th className="p-4 font-bold">Account Status</th>
                <th className="p-4 font-bold">Joined</th>
                <th className="p-4 font-bold text-right pr-6">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-gold" />
                      <span className="text-xs uppercase tracking-wider font-bold">Loading User Accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-400">
                    <p className="text-sm">No users matching current filters.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isUserAdmin = adminIds.has(user.id) || ['admin', 'super_admin', 'owner'].includes(user.role) || user.email === 'dekingsjackson@gmail.com';

                  return (
                    <React.Fragment key={user.id}>
                      <tr className={`transition-colors ${expandedUserId === user.id ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => toggleExpand(user.id)} 
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                              title="Toggle Details"
                            >
                              {expandedUserId === user.id ? <ChevronUp className="w-4 h-4 text-gold" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/30 to-gold/5 border border-gold/30 flex items-center justify-center text-gold font-bold uppercase shadow-inner">
                              {(user.displayName || user.name || user.email || "?")[0]}
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{user.displayName || user.name || "Unknown User"}</span>
                                {isUserAdmin && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-gold/20 text-gold border border-gold/30 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <Shield className="w-2.5 h-2.5" /> Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 font-mono">{user.email || "No Email"}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-xs text-gray-300 font-mono">
                          {user.phoneNumber || "—"}
                        </td>

                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                            user.suspended 
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                              : 'bg-green-500/20 text-green-400 border border-green-500/30'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.suspended ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`} />
                            {user.suspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>

                        <td className="p-4 text-xs text-gray-400 font-mono">
                          {user.createdAt 
                            ? new Date(user.createdAt.seconds ? user.createdAt.seconds * 1000 : user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) 
                            : "N/A"
                          }
                        </td>

                        <td className="p-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View details */}
                            <button 
                              onClick={() => toggleExpand(user.id)} 
                              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" 
                              title="View Comprehensive Telemetry"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Edit profile */}
                            <button 
                              onClick={() => setEditingUser(user)} 
                              className="p-2 text-gray-400 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors" 
                              title="Edit User Profile"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* Suspend / Unsuspend */}
                            {isUserAdmin ? (
                              <button 
                                disabled 
                                className="p-2 text-gray-600 rounded-lg cursor-not-allowed opacity-40" 
                                title="Administrative accounts cannot be suspended."
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleToggleSuspend(user)} 
                                className={`p-2 rounded-lg transition-all ${
                                  user.suspended 
                                    ? "text-red-400 bg-red-500/20 hover:bg-red-500/30 hover:text-white border border-red-500/40" 
                                    : "text-gray-400 hover:text-amber-400 hover:bg-amber-400/10"
                                }`} 
                                title={user.suspended ? "Restore / Unsuspend User" : "Suspend User Access"}
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete User */}
                            <button 
                              onClick={() => handleDelete(user)} 
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors border border-transparent hover:border-red-500/30" 
                              title="Permanently Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Details Row */}
                      <AnimatePresence>
                        {expandedUserId === user.id && (
                          <tr>
                            <td colSpan={6} className="p-0 border-b border-white/10">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <UserExpandedDetails 
                                  user={user} 
                                  isAdmin={isUserAdmin}
                                  onEdit={() => setEditingUser(user)}
                                  onSuspend={() => handleToggleSuspend(user)}
                                  onDelete={() => handleDelete(user)}
                                />
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <UserEditModal 
            user={editingUser} 
            onClose={() => setEditingUser(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
