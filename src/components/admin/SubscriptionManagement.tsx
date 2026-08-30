import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Search, CreditCard, Download, AlertCircle, XCircle, RefreshCw, ShieldCheck, CheckCircle2, Edit3, Sparkles } from "lucide-react";
import { collection, onSnapshot, query, limit, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import SubscriptionPlanModal from "./SubscriptionPlanModal";

export default function SubscriptionManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>("ALL");
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [stats, setStats] = useState({ active: 0, mrr: 0, totalUsers: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeUser, setConfirmRevokeUser] = useState<any | null>(null);
  const [editingPlanUser, setEditingPlanUser] = useState<any | null>(null);
  const [isProcessingCycle, setIsProcessingCycle] = useState(false);

  const handleRunExpirationCheck = async () => {
    setIsProcessingCycle(true);
    try {
      const auth = await import("firebase/auth").then(m => m.getAuth());
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/subscriptions/process-expirations`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process cycle");
      toast.success(data.message || "Subscription cycle check completed");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to run expiration check");
    } finally {
      setIsProcessingCycle(false);
    }
  };

  useEffect(() => {
    // Read users directly without strict orderBy in query to prevent index failures on missing fields
    const q = query(collection(db, "users"), limit(1000));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let activeCount = 0;
      let totalMrr = 0;
      const subs: any[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const plan = (data.currentPlan || data.plan || 'free').toLowerCase();
        const isActive = data.subscriptionActive === true;
        
        let amount = 0;
        let pName = 'Free';
        if (plan === 'starter') { amount = 15; pName = 'Starter'; }
        else if (plan === 'pro') { amount = 30; pName = 'Pro'; }
        else if (plan === 'premium') { amount = 60; pName = 'Premium'; }
        else if (plan === 'institutional') { amount = 100; pName = 'Institutional'; }

        if (amount > 0 && isActive) {
          activeCount++;
          totalMrr += amount;
        }

        subs.push({
          id: doc.id,
          user: data.displayName || data.name || data.email || "Anonymous User",
          email: data.email || "No email",
          plan: pName,
          planKey: plan,
          status: data.suspended ? 'suspended' : isActive ? 'active' : 'expired',
          amount: amount,
          subscriptionStartDate: data.subscriptionStartDate || null,
          rawExpiry: data.subscriptionExpiryDate || null,
          nextBilling: data.subscriptionExpiryDate ? new Date(data.subscriptionExpiryDate).toLocaleDateString() : "Lifetime / None",
        });
      });

      setStats({ active: activeCount, mrr: totalMrr, totalUsers: snapshot.size });
      setSubscriptions(subs);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching subscriptions", err);
      setError("Unable to load data");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRevoke = async (uid: string) => {
    setRevokingId(uid);
    try {
      const auth = await import("firebase/auth").then(m => m.getAuth());
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/subscriptions/${uid}/revoke`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Revocation failed");
      }
      toast.success("Subscription revoked successfully");
      setConfirmRevokeUser(null);
    } catch(e: any) {
      console.error(e);
      toast.error(e.message || "Error revoking subscription");
    } finally {
      setRevokingId(null);
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ["User ID", "Name", "Email", "Plan", "Status", "Amount", "Expiration Date"];
      const rows = subscriptions.map(s => [
        `"${s.id}"`,
        `"${s.user.replace(/"/g, '""')}"`,
        `"${s.email.replace(/"/g, '""')}"`,
        `"${s.plan}"`,
        `"${s.status}"`,
        `"$${s.amount}"`,
        `"${s.nextBilling}"`
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `sessionking_subscriptions_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV export downloaded");
    } catch (e) {
      console.error("Export error:", e);
      toast.error("Failed to generate CSV export");
    }
  };

  const filteredSubs = subscriptions.filter(sub => {
    const matchesSearch = 
      sub.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.plan.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPlan = 
      selectedPlanFilter === "ALL" ||
      (selectedPlanFilter === "ACTIVE_PAID" && sub.status === 'active' && sub.amount > 0) ||
      (selectedPlanFilter === "FREE" && sub.planKey === 'free') ||
      (selectedPlanFilter === "PRO" && sub.planKey === 'pro') ||
      (selectedPlanFilter === "PREMIUM" && sub.planKey === 'premium') ||
      (selectedPlanFilter === "INSTITUTIONAL" && sub.planKey === 'institutional');

    return matchesSearch && matchesPlan;
  });

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-gold" /> Subscription Management
          </h2>
          <p className="text-gray-400 text-sm mt-1">Monitor recurring revenue, member tiers & active billing cycles.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search user or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-gold"
            />
          </div>
          <select
            value={selectedPlanFilter}
            onChange={e => setSelectedPlanFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-gold appearance-none cursor-pointer"
          >
            <option value="ALL" className="bg-matte-black text-white">All Users</option>
            <option value="ACTIVE_PAID" className="bg-matte-black text-white">Active Paid Only</option>
            <option value="PRO" className="bg-matte-black text-white">Pro Tier ($30)</option>
            <option value="PREMIUM" className="bg-matte-black text-white">Premium Tier ($60)</option>
            <option value="INSTITUTIONAL" className="bg-matte-black text-white">Institutional ($100)</option>
            <option value="FREE" className="bg-matte-black text-white">Free Tier</option>
          </select>
          <button 
            onClick={handleRunExpirationCheck}
            disabled={isProcessingCycle}
            className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 text-amber-400 hover:text-amber-300 disabled:opacity-50"
            title="Check all users, send reminders for expiring plans, and reset expired 30-day accounts to Free tier"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessingCycle ? "animate-spin" : ""}`} /> 
            <span>{isProcessingCycle ? "Checking..." : "Sync 30-Day Expirations"}</span>
          </button>
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2 text-white"
          >
            <Download className="w-3.5 h-3.5 text-gold" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-5 h-5 text-gold" />
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Active Paid Members</h3>
          </div>
          <p className="text-3xl font-bold text-white mt-1">{isLoading ? "..." : stats.active}</p>
          <p className="text-xs text-gray-500 mt-1">Across Pro, Premium & Institutional</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="w-5 h-5 text-green-400" />
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">MRR (Monthly Run-Rate)</h3>
          </div>
          <p className="text-3xl font-bold text-green-400 mt-1">{isLoading ? "..." : `$${stats.mrr.toLocaleString()}`}</p>
          <p className="text-xs text-gray-500 mt-1">Based on active billable plans</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Total Registered Accounts</h3>
          </div>
          <p className="text-3xl font-bold text-white mt-1">{isLoading ? "..." : stats.totalUsers}</p>
          <p className="text-xs text-gray-500 mt-1">Total user records in database</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 border-b border-white/5 text-xs uppercase tracking-widest text-gray-400">
                <th className="p-4 font-medium">User Profile</th>
                <th className="p-4 font-medium">Current Plan</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Value</th>
                <th className="p-4 font-medium">Expiration / Renewal</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading subscriptions...</td></tr>
              ) : filteredSubs.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">No subscriptions matching filter.</td></tr>
              ) : (
                filteredSubs.map(sub => (
                  <tr key={sub.id} className="hover:bg-white/5 transition-colors text-sm">
                    <td className="p-4">
                      <div className="font-medium text-white">{sub.user}</div>
                      <div className="text-xs text-gray-500 font-mono">{sub.email}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        sub.plan === 'Institutional' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        sub.plan === 'Premium' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                        sub.plan === 'Pro' ? 'bg-gold/20 text-gold border border-gold/30' :
                        'bg-white/10 text-gray-400'
                      }`}>
                        {sub.plan}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        sub.status === 'active' ? 'bg-green-500/10 text-green-400' :
                        sub.status === 'suspended' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {sub.status === 'active' && <CheckCircle2 className="w-3 h-3" />}
                        {sub.status}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-medium text-white">
                      {sub.amount > 0 ? `$${sub.amount}/mo` : "$0 (Free)"}
                    </td>
                    <td className="p-4 text-gray-400 font-mono text-xs">
                      {sub.nextBilling}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingPlanUser(sub)}
                          className="px-2.5 py-1.5 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                          title="Change tier or renew"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Plan</span>
                        </button>
                        {sub.status === 'active' && sub.amount > 0 && (
                          <button 
                            onClick={() => setConfirmRevokeUser(sub)}
                            className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                            title="Revoke subscription immediately"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Subscription Plan Modal */}
      {editingPlanUser && (
        <SubscriptionPlanModal
          user={editingPlanUser}
          onClose={() => setEditingPlanUser(null)}
        />
      )}

      {/* Revoke Confirmation Modal */}
      {confirmRevokeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-matte-black border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <XCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold uppercase tracking-wider">Confirm Revocation</h3>
            </div>
            <p className="text-sm text-gray-300">
              Are you sure you want to revoke the <span className="text-gold font-bold">{confirmRevokeUser.plan}</span> subscription for <span className="text-white font-mono">{confirmRevokeUser.user}</span>?
            </p>
            <p className="text-xs text-gray-500">
              This will immediately revert their account to the Free tier.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmRevokeUser(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(confirmRevokeUser.id)}
                disabled={revokingId === confirmRevokeUser.id}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
              >
                {revokingId === confirmRevokeUser.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Revoking...
                  </>
                ) : (
                  "Confirm Revoke"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
