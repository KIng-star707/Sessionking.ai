import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Settings, Sliders, AlertTriangle, Save, Power } from "lucide-react";
import { logAdminAction } from "../../lib/audit";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";

export default function EngineControl() {
  const [weights, setWeights] = useState({
    marketStructure: 80,
    liquidity: 70,
    momentum: 60,
    newsImpact: 90
  });

  const [modes, setModes] = useState({
    scalping: true,
    dayTrading: true,
    swing: false
  });

  const [limits, setLimits] = useState({
    maxTradeDistance: 15,
    minRRRatio: 2.0,
    maxDailySignals: 20
  });

  const [isEngineActive, setIsEngineActive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "engineConfig"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.weights) setWeights(data.weights);
        if (data.modes) setModes(data.modes);
        if (data.limits) setLimits(data.limits);
        if (data.isEngineActive !== undefined) setIsEngineActive(data.isEngineActive);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    try {
      await setDoc(doc(db, "system", "engineConfig"), {
        weights,
        modes,
        limits,
        isEngineActive,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await logAdminAction("UPDATE_ENGINE_CONFIG", null, { weights, modes, limits, isEngineActive });
      toast.success("Configuration saved successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save config");
    }
  };

  if (loading) return <div className="text-gray-400">Loading Engine Config...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-white">Trading Engine Control</h2>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsEngineActive(!isEngineActive)}
            className={`px-4 py-2 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors flex items-center gap-2 ${
              isEngineActive ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : "bg-green-500/20 text-green-500 hover:bg-green-500/30"
            }`}
          >
            <Power className="w-4 h-4" /> {isEngineActive ? "Stop Engine" : "Start Engine"}
          </button>
          <button onClick={handleSave} className="px-6 py-2 bg-gold text-matte-black hover:bg-gold/90 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Configuration
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Weights */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <Sliders className="w-5 h-5 text-gold" />
            <h3 className="text-lg font-bold uppercase tracking-widest text-white">AI Confidence Weights</h3>
          </div>
          
          <div className="space-y-6">
            {Object.entries(weights).map(([key, value]) => (
              <div key={key}>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                    {key.replace(/([A-Z])/g, ' ').trim()}
                  </label>
                  <span className="text-gold font-bold">{value}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={value}
                  onChange={(e) => setWeights({...weights, [key]: parseInt(e.target.value)})}
                  className="w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-gold"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Trading Modes */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <Settings className="w-5 h-5 text-gold" />
            <h3 className="text-lg font-bold uppercase tracking-widest text-white">Active Trading Modes</h3>
          </div>
          
          <div className="space-y-4">
            {Object.entries(modes).map(([key, isActive]) => (
              <div key={key} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                <div>
                  <div className="font-bold text-white uppercase tracking-wider">{key.replace(/([A-Z])/g, ' ').trim()}</div>
                  <div className="text-xs text-gray-400">Enable/disable signals for this style</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={isActive}
                    onChange={() => setModes({...modes, [key]: !isActive})}
                  />
                  <div className="w-11 h-6 bg-black/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold"></div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Limits */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <AlertTriangle className="w-5 h-5 text-gold" />
            <h3 className="text-lg font-bold uppercase tracking-widest text-white">Risk Parameters & Limits</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Max Trade Distance (Pips)</label>
              <input type="number" value={limits.maxTradeDistance} onChange={(e)=>setLimits({...limits, maxTradeDistance: parseFloat(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Min R:R Ratio</label>
              <input type="number" step="0.1" value={limits.minRRRatio} onChange={(e)=>setLimits({...limits, minRRRatio: parseFloat(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Max Daily Signals</label>
              <input type="number" value={limits.maxDailySignals} onChange={(e)=>setLimits({...limits, maxDailySignals: parseFloat(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
