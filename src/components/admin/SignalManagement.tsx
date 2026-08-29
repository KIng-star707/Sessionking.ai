import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { collection, query, orderBy, limit, deleteDoc, doc, onSnapshot, updateDoc, addDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Trash2, Edit, Play, Pause, AlertCircle, X, Save, Plus } from "lucide-react";
import { logAdminAction } from "../../lib/audit";

export default function SignalManagement() {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [editingSignal, setEditingSignal] = useState<any | null>(null);
  const [creatingSignal, setCreatingSignal] = useState(false);
  const [newSignal, setNewSignal] = useState<any>({
    pair: "EUR/USD",
    type: "BUY",
    entry: "",
    stopLoss: "",
    takeProfit1: "",
    takeProfit2: "",
    confidence: 85,
    strategy: "Manual Admin Setup",
    reason: "Signal broadcasted from Admin Panel."
  });

  const [isEngineActive, setIsEngineActive] = useState(true);

  useEffect(() => {
    // Listen to Engine Config
    const unsubConfig = onSnapshot(doc(db, "system", "engineConfig"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().isEngineActive !== undefined) {
        setIsEngineActive(docSnap.data().isEngineActive);
      }
    });

    const q = query(collection(db, "liveSignals"), orderBy("createdAt", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSignals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching signals:", err);
      if(err.message.includes("index")) {
        setError("Index needed: " + err.message);
      } else {
        setError("Unable to load data");
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubConfig();
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (true) {
      await deleteDoc(doc(db, "liveSignals", id));
      await logAdminAction("DELETE_SIGNAL", null, { signalId: id });
    }
  };

  const handleEditSave = async () => {
    if (!editingSignal) return;
    try {
      const { id, ...data } = editingSignal;
      const ref = doc(db, "liveSignals", id);
      await updateDoc(ref, {
        ...data,
        action: data.type || data.action,
        price: data.entry || data.price,
        updatedAt: new Date().toISOString()
      });
      await logAdminAction("EDIT_SIGNAL", null, { signalId: id });
      setEditingSignal(null);
    } catch (err) {
      console.error("Error saving signal:", err);
      toast.error("Failed to save signal updates.");
    }
  };
  
  const handleToggleEngine = async () => {
    try {
      const newState = !isEngineActive;
      await setDoc(doc(db, "system", "engineConfig"), {
        isEngineActive: newState,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await logAdminAction("TOGGLE_ENGINE", null, { isEngineActive: newState });
    } catch(err) {
      console.error(err);
      toast.error("Failed to toggle engine");
    }
  };

  const handleCreateSignal = async () => {
    if (!newSignal.entry || !newSignal.stopLoss || !newSignal.takeProfit1) {
      toast.error("Please fill out entry, SL, and TP1");
      return;
    }
    try {
      const signalData = {
        ...newSignal,
        action: newSignal.type,
        price: newSignal.entry,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        source: "Admin Panel",
        userEmail: "Admin"
      };
      await addDoc(collection(db, "liveSignals"), signalData);
      
      const { getDocs, writeBatch } = await import("firebase/firestore");
      const usersSnap = await getDocs(collection(db, "users"));
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;
      
      usersSnap.docs.forEach((userDoc) => {
        const notifRef = doc(collection(db, `users/${userDoc.id}/notifications`));
        currentBatch.set(notifRef, {
          userId: userDoc.id,
          type: 'SIGNAL',
          title: `New ${newSignal.type} Signal: ${newSignal.pair}`,
          message: `Entry: ${newSignal.entry} | SL: ${newSignal.stopLoss} | TP: ${newSignal.takeProfit1}`,
          priority: "MEDIUM",
          isRead: false,
          timestamp: new Date().toISOString()
        });
        
        operationCount++;
        if (operationCount === 500) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });
      
      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }
      await Promise.all(batches);

      try {
        const auth = await import("firebase/auth").then(m => m.getAuth());
        const token = await auth.currentUser?.getIdToken();
        await fetch("/api/notify-users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            title: `New ${newSignal.type} Signal: ${newSignal.pair}`,
            body: `Entry: ${newSignal.entry} | SL: ${newSignal.stopLoss} | TP: ${newSignal.takeProfit1}`,
            route: "/dashboard"
          })
        });
      } catch (e) {
        console.error("Failed to trigger FCM push", e);
      }

      toast.success("Signal broadcasted to all users!");
      await logAdminAction("CREATE_MANUAL_SIGNAL", null, { pair: newSignal.pair });
      setCreatingSignal(false);
    } catch(err) {
      console.error(err);
      toast.error("Failed to create signal");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-white">Signal Management</h2>
        <div className="flex gap-4">
          <button onClick={() => setCreatingSignal(true)} className="px-4 py-2 bg-gold text-matte-black hover:bg-gold/90 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> Broadcast Signal
          </button>
          <button 
            onClick={handleToggleEngine}
            className={`px-4 py-2 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors flex items-center gap-2 ${
              isEngineActive ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : "bg-green-500/20 text-green-500 hover:bg-green-500/30"
            }`}
          >
            {isEngineActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} 
            {isEngineActive ? "Stop All Signals" : "Start Signals"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 border-b border-white/5 text-xs uppercase tracking-widest text-gray-400">
                <th className="p-4 font-medium">Pair</th>
                <th className="p-4 font-medium">Action</th>
                <th className="p-4 font-medium">Entry</th>
                <th className="p-4 font-medium">Metrics (Conf/RR)</th>
                <th className="p-4 font-medium">User/Source</th>
                <th className="p-4 font-medium">Time</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Loading signals...</td></tr>
              ) : signals.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">No signals found.</td></tr>
              ) : (
                signals.map(signal => {
                  const actionType = signal.type || signal.action;
                  const price = signal.entry || signal.price;
                  return (
                  <tr key={signal.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold text-white">{signal.pair}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                        actionType === 'BUY' ? 'bg-green-500/20 text-green-400' : 
                        actionType === 'WAIT' ? 'bg-gray-500/20 text-gray-400' : 
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {actionType}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300 font-mono">{price}</td>
                    <td className="p-4 text-sm text-gray-400">
                      <div>Conf: <span className="text-gold font-mono">{signal.confidence || 0}%</span></div>
                      <div>RR: <span className="text-white font-mono">{signal.riskReward || 'N/A'}</span></div>
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      <div>{signal.userEmail || signal.source || 'AI Engine'}</div>
                      {signal.strategy && <div className="text-xs text-gold mt-1">{signal.strategy}</div>}
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {new Date(signal.timestamp || signal.createdAt || Date.now()).toLocaleString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setEditingSignal(signal)}
                          className="p-2 text-gold hover:text-white hover:bg-gold/20 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(signal.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(editingSignal || creatingSignal) && (() => {
        const target = editingSignal ? editingSignal : newSignal;
        const setTarget = editingSignal ? setEditingSignal : setNewSignal;

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-matte-black border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase tracking-widest text-white">{editingSignal ? "Edit Generated Signal" : "Broadcast New Signal"}</h3>
              <button 
                onClick={() => { setEditingSignal(null); setCreatingSignal(false); }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Pair</label>
                  <input 
                    type="text" 
                    value={target.pair || ""}
                    onChange={(e) => setTarget({...target, pair: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Direction (Action)</label>
                  <select
                    value={target.type || target.action || "BUY"}
                    onChange={(e) => setTarget({...target, type: e.target.value, action: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                    <option value="WAIT">WAIT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Entry Price</label>
                  <input 
                    type="text" 
                    value={target.entry || target.price || ""}
                    onChange={(e) => setTarget({...target, entry: e.target.value, price: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:border-gold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Stop Loss</label>
                  <input 
                    type="text" 
                    value={target.stopLoss || ""}
                    onChange={(e) => setTarget({...target, stopLoss: e.target.value})}
                    className="w-full bg-black/50 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 font-mono focus:border-red-500 outline-none"
                  />
                </div>
                {editingSignal && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Result Status</label>
                  <select
                    value={target.result || "pending"}
                    onChange={(e) => setTarget({...target, result: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="win">Win (TP Hit)</option>
                    <option value="loss">Loss (SL Hit)</option>
                  </select>
                </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gold uppercase tracking-widest mb-2">Confidence %</label>
                  <input 
                    type="number" 
                    value={target.confidence || 0}
                    onChange={(e) => setTarget({...target, confidence: parseInt(e.target.value)})}
                    className="w-full bg-black/50 border border-gold/30 rounded-xl px-4 py-3 text-gold font-mono focus:border-gold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-green-400 uppercase tracking-widest mb-2">Take Profit 1</label>
                  <input 
                    type="text" 
                    value={target.takeProfit1 || ""}
                    onChange={(e) => setTarget({...target, takeProfit1: e.target.value})}
                    className="w-full bg-black/50 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 font-mono focus:border-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-green-400 uppercase tracking-widest mb-2">Take Profit 2</label>
                  <input 
                    type="text" 
                    value={target.takeProfit2 || ""}
                    onChange={(e) => setTarget({...target, takeProfit2: e.target.value})}
                    className="w-full bg-black/50 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 font-mono focus:border-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-green-400 uppercase tracking-widest mb-2">Take Profit 3</label>
                  <input 
                    type="text" 
                    value={target.takeProfit3 || ""}
                    onChange={(e) => setTarget({...target, takeProfit3: e.target.value})}
                    className="w-full bg-black/50 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 font-mono focus:border-green-500 outline-none placeholder:text-gray-600"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Strategy Details</label>
                <input 
                  type="text" 
                  value={target.strategy || ""}
                  onChange={(e) => setTarget({...target, strategy: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">AI Reasoning / Logic</label>
                <textarea 
                  rows={3}
                  value={target.reason || (Array.isArray(target.reasoning) ? target.reasoning[0] : "")}
                  onChange={(e) => setTarget({
                    ...target, 
                    reason: e.target.value,
                    reasoning: [e.target.value]
                  })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-gold outline-none resize-none"
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-white/10 flex justify-end gap-4">
              <button 
                onClick={() => { setEditingSignal(null); setCreatingSignal(false); }}
                className="px-6 py-2 rounded-xl text-white hover:bg-white/5 font-bold tracking-widest uppercase text-sm transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={editingSignal ? handleEditSave : handleCreateSignal}
                className="px-6 py-2 bg-gold text-matte-black hover:bg-gold/90 rounded-xl flex items-center gap-2 font-bold tracking-widest uppercase text-sm transition-colors"
              >
                <Save className="w-4 h-4" /> {editingSignal ? "Save Setup" : "Broadcast Setup"}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
