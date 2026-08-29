import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { ShieldAlert, Save, Globe, Database, Sliders, RefreshCw, CheckCircle2, AlertTriangle, Radio } from "lucide-react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { logAdminAction } from "../../lib/audit";

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    activeSessions: "All Sessions (24/5)",
    newsFilterSensitivity: "Medium (Pause 30m before/after)",
    maintenanceMode: false,
    intelligenceMaintenance: false,
    minRiskRewardRatio: 2.0,
    maxDailySignalsPerPair: 3,
    autoBroadcastEnabled: true,
    platformStatus: "Operational"
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "settings"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings(prev => ({
          ...prev,
          ...data
        }));
      }
      setLoading(false);
    }, (err) => {
      console.warn("Could not load system settings:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, "system", "settings"), {
        ...settings,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await logAdminAction("SETTINGS_UPDATE", "system/settings", {
        maintenanceMode: settings.maintenanceMode,
        activeSessions: settings.activeSessions,
        newsFilterSensitivity: settings.newsFilterSensitivity
      });

      toast.success("System settings updated successfully!");
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMaintenance = async () => {
    const newStatus = !settings.maintenanceMode;
    const updated = { ...settings, maintenanceMode: newStatus };
    setSettings(updated);
    try {
      await setDoc(doc(db, "system", "settings"), {
        ...updated,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Synchronize killSwitch across system/config and engineConfig
      await setDoc(doc(db, "system", "config"), {
        killSwitch: newStatus,
        maintenanceReason: newStatus ? "Platform undergoing scheduled maintenance." : "",
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, "system", "engineConfig"), {
        maintenanceMode: newStatus,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await logAdminAction("MAINTENANCE_TOGGLE", "system", { enabled: newStatus });
      toast.success(`Maintenance mode ${newStatus ? 'ENABLED' : 'DISABLED'}`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to toggle maintenance mode");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-gold" /> System Settings
          </h2>
          <p className="text-gray-400 text-sm mt-1">Platform-wide engine policies, session filters and operations.</p>
        </div>
        <button 
          onClick={() => handleSave()}
          disabled={saving || loading}
          className="px-6 py-2.5 bg-gold text-matte-black hover:bg-gold/90 rounded-xl font-bold text-sm uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg hover:scale-105"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Global Trading Engine Parameters */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
            <Globe className="w-5 h-5 text-gold" />
            <h3 className="text-lg font-bold uppercase tracking-widest text-white">Global Trading Engine Parameters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Active Trading Sessions</label>
              <select 
                value={settings.activeSessions}
                onChange={e => setSettings({ ...settings, activeSessions: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold appearance-none"
              >
                <option value="All Sessions (24/5)">All Sessions (24/5)</option>
                <option value="London & New York Only">London & New York Only</option>
                <option value="London Only">London Only</option>
                <option value="New York Only">New York Only</option>
                <option value="Asian & London Only">Asian & London Only</option>
              </select>
              <p className="text-xs text-gray-500 mt-1.5">Defines the active signal scanning window for the algorithmic engines.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">News Filter Sensitivity</label>
              <select 
                value={settings.newsFilterSensitivity}
                onChange={e => setSettings({ ...settings, newsFilterSensitivity: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold appearance-none"
              >
                <option value="High (Pause 1hr before/after High Impact)">High (Pause 1hr before/after High Impact)</option>
                <option value="Medium (Pause 30m before/after)">Medium (Pause 30m before/after)</option>
                <option value="Low (Trade through news)">Low (Trade through news)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1.5">Auto-suspends signal generation during scheduled red-folder economic releases.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Minimum Risk/Reward Threshold</label>
              <input 
                type="number"
                step="0.1"
                min="1.0"
                max="10.0"
                value={settings.minRiskRewardRatio}
                onChange={e => setSettings({ ...settings, minRiskRewardRatio: parseFloat(e.target.value) || 1.5 })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold font-mono"
              />
              <p className="text-xs text-gray-500 mt-1.5">Signals with R:R below this threshold will be flagged as low-quality.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Max Signals Per Pair / Day</label>
              <input 
                type="number"
                min="1"
                max="20"
                value={settings.maxDailySignalsPerPair}
                onChange={e => setSettings({ ...settings, maxDailySignalsPerPair: parseInt(e.target.value, 10) || 3 })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold font-mono"
              />
              <p className="text-xs text-gray-500 mt-1.5">Cap the frequency of broadcast setups per currency pair.</p>
            </div>
          </div>
        </div>

        {/* Webhook Endpoint & Integration Status */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
            <Radio className="w-5 h-5 text-gold" />
            <h3 className="text-lg font-bold uppercase tracking-widest text-white">Signal Webhook Ingestion</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">TradingView / MT5 Webhook URL</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}/api/signal`} 
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-gold font-mono text-sm select-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/api/signal`);
                    toast.success("Webhook URL copied to clipboard");
                  }}
                  className="px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Send POST payloads containing: <code className="text-gray-300 font-mono">{"{ pair, action, price, tp, sl }"}</code> to broadcast setups directly.</p>
            </div>
          </div>
        </div>

        {/* Maintenance Mode & Danger Zone */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6 border-b border-red-500/20 pb-4">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-bold uppercase tracking-widest text-red-500">Platform Maintenance & Safety</h3>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-white uppercase tracking-wider">System Maintenance Mode</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${settings.maintenanceMode ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                  {settings.maintenanceMode ? 'Active (Locked)' : 'Normal Operation'}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">Suspend non-admin access for database migrations, updates or security operations.</p>
            </div>
            <button 
              type="button"
              onClick={handleToggleMaintenance}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors ${
                settings.maintenanceMode 
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
              }`}
            >
              {settings.maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
