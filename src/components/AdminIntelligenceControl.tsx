import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Brain, Database, Activity, Users, Settings, Search, RefreshCw, BarChart2, Shield, Eye, Trash2, Plus, Minus, History, ArrowLeft, X, Sparkles, AlertCircle, CheckCircle2, Play } from 'lucide-react';
import { collection, getDocs, getCountFromServer, query, orderBy, limit, doc, updateDoc, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import SystemHealthWidget from './SystemHealthWidget';
import { runAllPhase2Tests, type TestResult } from '../services/tests/runPhase2Tests';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  intelligenceCredits: number;
  lastActive?: any;
  purchasedCredits?: number;
  usedCredits?: number;
  refundedCredits?: number;
  intelligenceActive?: boolean;
}

interface LogData {
  id: string;
  type: string;
  pair: string;
  timeframe: string;
  userEmail: string;
  confidenceScore: number;
  setupQualityPoor: boolean;
  createdAt: any;
  rawOutput?: string;
  diagnostic?: string[];
}

export default function AdminIntelligenceControl() {
  const [stats, setStats] = useState({
    totalGenerations: 2450,
    activeUsers: 142,
    totalCreditsSold: 12500,
    creditsRemaining: 3400,
    avgResponseTime: 1.2,
    errorRate: 0.8
  });
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'orchestrator' | 'users' | 'quality' | 'settings' | 'tests'>('overview');
  const [testResults, setTestResults] = useState<{ total: number; passed: number; failed: number; results: TestResult[] } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [userSearch, setUserSearch] = useState("");
  
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [addAmount, setAddAmount] = useState<string>("5");
  const [removeAmount, setRemoveAmount] = useState<string>("5");
  const [adjustAmountState, setAdjustAmountState] = useState<string>("10");
  
  const [systemConfig, setSystemConfig] = useState({
    blockNews: false,
    require3TF: false,
    strictLiquidity: false,
    packagePrice: 5,
    creditsPerPackage: 3,
    killSwitch: false
  });
  
  const [aiLogs, setAiLogs] = useState<LogData[]>([]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const fetchedUsers: UserData[] = [];
      let totalRemaining = 0;
      usersSnap.forEach(doc => {
        const data = doc.data();
        const remaining = data.intelligenceCredits || 0;
        totalRemaining += remaining;
        fetchedUsers.push({
          id: doc.id,
          email: data.email || "No Email",
          displayName: data.displayName || "Unknown",
          intelligenceCredits: remaining,
          lastActive: data.lastLoginAt || null,
          purchasedCredits: data.purchasedCredits || Math.max(remaining, 3),
          usedCredits: data.usedCredits || 0,
          refundedCredits: data.refundedCredits || 0,
          intelligenceActive: data.intelligenceActive !== undefined ? !!data.intelligenceActive : remaining > 0
        });
      });
      setUsers(fetchedUsers);
      
      const logsCountSnap = await getCountFromServer(collection(db, "aiLogs"));
      const totalGen = logsCountSnap.data().count;
      
      setStats(prev => ({ 
        ...prev, 
        activeUsers: fetchedUsers.length,
        creditsRemaining: totalRemaining,
        totalGenerations: totalGen,
        totalCreditsSold: totalGen + totalRemaining
      }));
    } catch (err) {
      console.error("Failed to fetch stats", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTransactions = async (userId: string) => {
    try {
      const q = query(
        collection(db, "intelligence_transactions"),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(q);
      const txs: any[] = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.uid === userId) {
          txs.push({
            id: doc.id,
            ...d
          });
        }
      });
      setUserTransactions(txs);
    } catch (err) {
      console.error("Failed to fetch user transactions", err);
    }
  };

  const selectUserForManagement = async (user: UserData) => {
    setSelectedUser(user);
    await fetchUserTransactions(user.id);
  };

  const handleAddCredits = async (userId: string, amount: number) => {
    if (amount <= 0) return toast.error("Please enter a positive amount");
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return toast.error("User not found");
      const current = userSnap.data()?.intelligenceCredits || 0;
      const currentPurchased = userSnap.data()?.purchasedCredits || 0;
      const newCredits = current + amount;
      const newPurchased = currentPurchased + amount;
      
      await updateDoc(userRef, {
        intelligenceCredits: newCredits,
        purchasedCredits: newPurchased,
        intelligenceActive: newCredits > 0
      });
      
      // Log transaction
      const lgId = crypto.randomUUID();
      await setDoc(doc(db, "intelligence_transactions", lgId), {
        uid: userId,
        action: "admin_add",
        creditsBefore: current,
        creditsAfter: newCredits,
        timestamp: new Date().toISOString(),
        analysisStatus: "success",
        result: `Admin added ${amount} credits`
      });

      toast.success(`Successfully added ${amount} credits`);
      fetchUsers();
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({
          ...selectedUser,
          intelligenceCredits: newCredits,
          purchasedCredits: newPurchased,
          intelligenceActive: newCredits > 0
        });
        fetchUserTransactions(userId);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add credits");
    }
  };

  const handleRemoveCredits = async (userId: string, amount: number) => {
    if (amount <= 0) return toast.error("Please enter a positive amount");
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return toast.error("User not found");
      const current = userSnap.data()?.intelligenceCredits || 0;
      const newCredits = Math.max(0, current - amount);
      
      await updateDoc(userRef, {
        intelligenceCredits: newCredits,
        intelligenceActive: newCredits > 0
      });
      
      // Log transaction
      const lgId = crypto.randomUUID();
      await setDoc(doc(db, "intelligence_transactions", lgId), {
        uid: userId,
        action: "admin_remove",
        creditsBefore: current,
        creditsAfter: newCredits,
        timestamp: new Date().toISOString(),
        analysisStatus: "success",
        result: `Admin removed ${amount} credits`
      });

      toast.success(`Successfully removed ${amount} credits`);
      fetchUsers();
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({
          ...selectedUser,
          intelligenceCredits: newCredits,
          intelligenceActive: newCredits > 0
        });
        fetchUserTransactions(userId);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove credits");
    }
  };

  const handleAdjustBalance = async (userId: string, balance: number) => {
    if (balance < 0) return toast.error("Balance cannot be negative");
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return toast.error("User not found");
      const current = userSnap.data()?.intelligenceCredits || 0;
      
      await updateDoc(userRef, {
        intelligenceCredits: balance,
        intelligenceActive: balance > 0
      });
      
      // Log transaction
      const lgId = crypto.randomUUID();
      await setDoc(doc(db, "intelligence_transactions", lgId), {
        uid: userId,
        action: "admin_adjust",
        creditsBefore: current,
        creditsAfter: balance,
        timestamp: new Date().toISOString(),
        analysisStatus: "success",
        result: `Admin adjusted balance to ${balance} credits`
      });

      toast.success(`Successfully adjusted balance to ${balance}`);
      fetchUsers();
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({
          ...selectedUser,
          intelligenceCredits: balance,
          intelligenceActive: balance > 0
        });
        fetchUserTransactions(userId);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to adjust balance");
    }
  };

  const handleRefundCredit = async (userId: string) => {
    try {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return toast.error("User not found");
      const current = userSnap.data()?.intelligenceCredits || 0;
      const refunded = userSnap.data()?.refundedCredits || 0;
      const newCredits = current + 1;
      
      await updateDoc(userRef, {
        intelligenceCredits: newCredits,
        refundedCredits: refunded + 1,
        intelligenceActive: true
      });
      
      // Log transaction
      const lgId = crypto.randomUUID();
      await setDoc(doc(db, "intelligence_transactions", lgId), {
        uid: userId,
        action: "admin_refund",
        creditsBefore: current,
        creditsAfter: newCredits,
        timestamp: new Date().toISOString(),
        analysisStatus: "success",
        result: `Admin refunded 1 credit`
      });

      toast.success("Successfully refunded 1 credit");
      fetchUsers();
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({
          ...selectedUser,
          intelligenceCredits: newCredits,
          refundedCredits: refunded + 1,
          intelligenceActive: true
        });
        fetchUserTransactions(userId);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to refund credit");
    }
  };
  
  const fetchLogs = async () => {
    try {
      const q = query(collection(db, "aiLogs"), orderBy("createdAt", "desc"), limit(20));
      const snapshot = await getDocs(q);
      const fetchedLogs: LogData[] = [];
      snapshot.forEach(doc => {
         const data = doc.data();
         fetchedLogs.push({
            id: doc.id,
            type: data.type || "UNKNOWN",
            pair: data.pair || "UNKNOWN",
            timeframe: data.timeframe || "Mix",
            userEmail: data.userEmail || "anonymous",
            confidenceScore: data.confidenceScore || 0,
            setupQualityPoor: !!data.setupQualityPoor,
            createdAt: data.createdAt,
            rawOutput: data.rawOutput,
            diagnostic: data.diagnostic || []
         });
      });
      setAiLogs(fetchedLogs);
      if (fetchedLogs.length > 0) {
         setStats(prev => ({...prev, totalGenerations: prev.totalGenerations + fetchedLogs.length}));
      }
    } catch (err) {
      console.error("Failed to fetch logs", err);
    }
  };

  const fetchConfig = async () => {
    try {
      const docRef = doc(db, "system", "config");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
         const data = docSnap.data();
         setSystemConfig({
            blockNews: data.blockNews || false,
            require3TF: data.require3TF || false,
            strictLiquidity: data.strictLiquidity || false,
            packagePrice: data.packagePrice || 5,
            creditsPerPackage: data.creditsPerPackage || 3,
            killSwitch: data.killSwitch || false
         });
      }
    } catch (err) {
      console.error("Failed to fetch config", err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchLogs();
    fetchConfig();
    
    // Mock chart data
    const data = [];
    for (let i = 0; i < 7; i++) {
      data.push({
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
        requests: Math.floor(Math.random() * 500) + 100,
        errors: Math.floor(Math.random() * 10)
      });
    }
    setChartData(data);
  }, []);

  const handleSaveConfig = async () => {
     try {
        await setDoc(doc(db, "system", "config"), systemConfig, { merge: true });
        toast.success("Configuration Saved!");
     } catch(err) {
        console.error("Failed to save config", err);
        toast.error("Failed to save configuration");
     }
  };

  const handleResetLimit = async (userId: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { intelligenceCredits: 3 });
      setUsers(users.map(u => u.id === userId ? { ...u, intelligenceCredits: 3 } : u));
    } catch (err) {
      console.error(err);
      toast.error("Failed to reset limit");
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { intelligenceCredits: 0 });
      setUsers(users.map(u => u.id === userId ? { ...u, intelligenceCredits: 0 } : u));
    } catch (err) {
      console.error(err);
      toast.error("Failed to revoke access");
    }
  };

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(userSearch.toLowerCase()) || u.displayName.toLowerCase().includes(userSearch.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 pb-4 border-b border-white/5">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 md:w-8 md:h-8 text-gold" />
            <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">SESSIONKING</span> AI CONTROL SYSTEM
          </h2>
          <p className="text-xs md:text-sm text-gray-400 mt-1 font-mono tracking-tight cursor-default">Enterprise Market Intelligence & Orchestration Core</p>
        </div>
        <div className="flex flex-wrap gap-2 bg-black/40 p-1 rounded-lg border border-white/5 shadow-inner">
          <button onClick={() => setActiveTab('overview')} className={cn("flex-1 whitespace-nowrap px-3 md:px-4 py-2 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all", activeTab === 'overview' ? "bg-gold text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]" : "text-gray-400 hover:text-white hover:bg-white/5")}>Live Overview</button>
          <button onClick={() => setActiveTab('orchestrator')} className={cn("flex-1 whitespace-nowrap px-3 md:px-4 py-2 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all", activeTab === 'orchestrator' ? "bg-gold text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]" : "text-gray-400 hover:text-white hover:bg-white/5")}>AI Orchestrator</button>
          <button onClick={() => setActiveTab('users')} className={cn("flex-1 whitespace-nowrap px-3 md:px-4 py-2 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all", activeTab === 'users' ? "bg-gold text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]" : "text-gray-400 hover:text-white hover:bg-white/5")}>Credit Analytics</button>
          <button onClick={() => setActiveTab('quality')} className={cn("flex-1 whitespace-nowrap px-3 md:px-4 py-2 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all", activeTab === 'quality' ? "bg-gold text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]" : "text-gray-400 hover:text-white hover:bg-white/5")}>Quality Review</button>
          <button onClick={() => setActiveTab('settings')} className={cn("flex-1 whitespace-nowrap px-3 md:px-4 py-2 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all", activeTab === 'settings' ? "bg-gold text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]" : "text-gray-400 hover:text-white hover:bg-white/5")}>Sys Controls</button>
          <button onClick={() => setActiveTab('tests')} className={cn("flex-1 whitespace-nowrap px-3 md:px-4 py-2 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all", activeTab === 'tests' ? "bg-gold text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]" : "text-gray-400 hover:text-white hover:bg-white/5")}>Engine Tests</button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Top Level Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/60 p-5 border border-white/5 rounded-xl">
               <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest block mb-1">Total Users (Live)</span>
               <span className="text-3xl font-bold font-mono text-white">{stats.activeUsers.toLocaleString()}</span>
            </div>
            <div className="bg-black/60 p-5 border border-white/5 rounded-xl">
               <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest block mb-1">Total AI Analyses</span>
               <span className="text-3xl font-bold font-mono text-gold">{stats.totalGenerations.toLocaleString()}</span>
            </div>
            <div className="bg-black/60 p-5 border border-white/5 rounded-xl">
               <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest block mb-1">Credits Sold ($)</span>
               <span className="text-3xl font-bold font-mono text-green-400">${(stats.totalCreditsSold * 5 / 3).toLocaleString()}</span>
            </div>
            <div className="bg-black/60 p-5 border border-white/5 rounded-xl">
               <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest block mb-1">API Health Status</span>
               <div className="flex items-center gap-2 mt-2">
                 <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                 <span className="text-sm font-bold font-mono text-green-400">OPTIMAL ({stats.avgResponseTime}s)</span>
               </div>
            </div>
          </div>

          <div className="mb-6"><SystemHealthWidget showTitle /></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="lg:col-span-2 bg-gradient-to-b from-[#0a0a0a] to-black border border-white/5 rounded-xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500"/> SYSTEM LOAD (7D)
                  </h3>
                  <div className="flex gap-4">
                     <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <div className="w-2 h-2 rounded bg-blue-500"></div> AI Engine Hits
                     </div>
                  </div>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#eab308" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" stroke="#333" fontSize={10} fontFamily="monospace" tickLine={false} axisLine={false} />
                      <YAxis stroke="#333" fontSize={10} fontFamily="monospace" tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontFamily: 'monospace', fontSize: '12px' }}
                        itemStyle={{ color: '#eab308' }}
                      />
                      <Area type="monotone" dataKey="requests" stroke="#eab308" strokeWidth={1} fillOpacity={1} fill="url(#colorReq)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
             </div>

             <div className="bg-gradient-to-b from-[#0a0a0a] to-black border border-white/5 rounded-xl p-6 shadow-2xl">
                 <h3 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                   <Shield className="w-4 h-4 text-red-500"/> RISK OBSERVABILITY
                 </h3>
                 <div className="space-y-6">
                    <div>
                       <div className="flex justify-between font-mono text-[10px] text-gray-500 mb-2">
                         <span>API RATE LIMITS</span>
                         <span className="text-green-500">22% USED</span>
                       </div>
                       <div className="w-full bg-black border border-white/10 rounded-full h-1">
                          <div className="bg-green-500 h-1 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" style={{width: '22%'}}></div>
                       </div>
                    </div>
                    <div>
                       <div className="flex justify-between font-mono text-[10px] text-gray-500 mb-2">
                         <span>GC FIRESTORE READS</span>
                         <span className="text-yellow-500">65% QUOTA</span>
                       </div>
                       <div className="w-full bg-black border border-white/10 rounded-full h-1">
                          <div className="bg-yellow-500 h-1 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]" style={{width: '65%'}}></div>
                       </div>
                    </div>
                    <div>
                       <div className="flex justify-between font-mono text-[10px] text-gray-500 mb-2">
                         <span>AI HALLUCINATION RATE</span>
                         <span className="text-blue-500">{stats.errorRate}%</span>
                       </div>
                       <div className="w-full bg-black border border-white/10 rounded-full h-1">
                          <div className="bg-blue-500 h-1 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{width: '0.8%'}}></div>
                       </div>
                    </div>
                 </div>

                 <div className="mt-8 pt-6 border-t border-white/5">
                    <h4 className="font-mono text-[10px] text-gray-500 mb-4">LIVE TERMINAL FEED</h4>
                    <div className="space-y-3 font-mono text-xs">
                       <div className="flex gap-2 items-center text-gray-400">
                          <span className="text-green-500">●</span> EUR/USD • NEW YORK SESSION
                       </div>
                       <div className="flex gap-2 items-center text-gray-400">
                          <span className="text-green-500">●</span> BTC/USD • OVERLAP
                       </div>
                       <div className="flex gap-2 items-center text-gray-400">
                          <span className="text-red-500">●</span> INVALID CHART DETECTED
                       </div>
                    </div>
                 </div>
             </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'orchestrator' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 space-y-6">
                 <div className="bg-black/60 border border-white/5 rounded-xl p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                       <h3 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-widest"><RefreshCw className="w-4 h-4 inline mr-2 text-gold"/> LIVE AI OBSERVABILITY PANEL</h3>
                       <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[10px] font-mono rounded self-start sm:self-auto">PROCESSING (EUR/USD)</span>
                    </div>

                    <div className="space-y-4">
                       {/* AI Modules */}
                       {[
                         { name: "STRUCTURE AI", status: "BULLISH", conf: 92, color: "text-green-400", bar: "bg-green-500" },
                         { name: "MOMENTUM AI", status: "NEUTRAL", conf: 45, color: "text-yellow-400", bar: "bg-yellow-500" },
                         { name: "LIQUIDITY AI", status: "BULLISH", conf: 88, color: "text-green-400", bar: "bg-green-500" },
                         { name: "NEWS AI", status: "HIGH RISK", conf: 99, color: "text-red-400", bar: "bg-red-500" },
                         { name: "VOLATILITY AI", status: "ELEVATED", conf: 75, color: "text-yellow-400", bar: "bg-yellow-500" }
                       ].map((ai, i) => (
                         <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 gap-4">
                            <div className="flex-1">
                               <div className="flex items-center justify-between mb-2">
                                  <span className="font-mono text-xs font-bold text-gray-300">{ai.name}</span>
                                  <span className={cn("font-mono text-[10px] font-bold", ai.color)}>{ai.status}</span>
                               </div>
                               <div className="w-full bg-black rounded-full h-1">
                                  <div className={cn("h-1 rounded-full", ai.bar)} style={{width: `${ai.conf}%`}}></div>
                               </div>
                            </div>
                            <div className="font-mono text-[10px] text-gray-500 md:w-24 text-right">
                               CONF. {ai.conf}%
                            </div>
                         </div>
                       ))}
                    </div>

                    <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                       <h4 className="font-mono text-[10px] text-yellow-500 font-bold mb-1">• KING ORCHESTRATOR DECISION:</h4>
                       <p className="font-mono text-xs text-yellow-400/80">⚠ WAIT — Quality insufficient. Structure is Bullish, but Momentum is Neural and News Risk is High. Setup rejected by risk filter.</p>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 {/* Feed Health */}
                 <div className="bg-black/60 border border-white/5 rounded-xl p-6">
                    <h3 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-widest mb-4">MARKET DATA FEED</h3>
                    
                    <div className="space-y-4">
                       <div className="flex justify-between items-center bg-black p-3 rounded border border-white/5">
                          <div>
                             <div className="font-mono text-[10px] text-white">TRADINGVIEW API</div>
                             <div className="font-mono text-[8px] text-gray-500">Latency: 12ms</div>
                          </div>
                          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                       </div>
                       <div className="flex justify-between items-center bg-black p-3 rounded border border-white/5">
                          <div>
                             <div className="font-mono text-[10px] text-white">ALPHA VANTAGE</div>
                             <div className="font-mono text-[8px] text-gray-500">Latency: 45ms</div>
                          </div>
                          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                       </div>
                       <div className="flex justify-between items-center bg-black p-3 rounded border border-white/5">
                          <div>
                             <div className="font-mono text-[10px] text-white">FINNHUB WEBHOOKS</div>
                             <div className="font-mono text-[8px] text-gray-500">Latency: 18ms</div>
                          </div>
                          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                       </div>
                    </div>
                 </div>

                 {/* Risk Config */}
                 <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
                    <h3 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-widest mb-4">ORCHESTRATOR FILTERS</h3>
                    
                    <div className="space-y-3">
                       <label className="flex items-center justify-between cursor-pointer group">
                          <span className="font-mono text-[10px] text-gray-400 group-hover:text-white transition-colors">BLOCK HIGH-IMPACT NEWS</span>
                          <input type="checkbox" className="sr-only" checked={systemConfig.blockNews} onChange={(e) => {
                             const n = {...systemConfig, blockNews: e.target.checked};
                             setSystemConfig(n); setDoc(doc(db, "system", "config"), n, {merge:true});
                          }} />
                          <div className={cn("w-8 h-4 rounded-full relative transition-colors", systemConfig.blockNews ? "bg-gold" : "bg-gray-800 border border-white/10")}>
                             <div className={cn("w-3 h-3 rounded-full absolute top-0.5 transition-all", systemConfig.blockNews ? "bg-black right-0.5" : "bg-gray-500 left-0.5")}></div>
                          </div>
                       </label>
                       <label className="flex items-center justify-between cursor-pointer group">
                          <span className="font-mono text-[10px] text-gray-400 group-hover:text-white transition-colors">REQUIRE 3-TIMEFRAME ALIGNMENT</span>
                          <input type="checkbox" className="sr-only" checked={systemConfig.require3TF} onChange={(e) => {
                             const n = {...systemConfig, require3TF: e.target.checked};
                             setSystemConfig(n); setDoc(doc(db, "system", "config"), n, {merge:true});
                          }} />
                          <div className={cn("w-8 h-4 rounded-full relative transition-colors", systemConfig.require3TF ? "bg-gold" : "bg-gray-800 border border-white/10")}>
                             <div className={cn("w-3 h-3 rounded-full absolute top-0.5 transition-all", systemConfig.require3TF ? "bg-black right-0.5" : "bg-gray-500 left-0.5")}></div>
                          </div>
                       </label>
                       <label className="flex items-center justify-between cursor-pointer group">
                          <span className="font-mono text-[10px] text-gray-400 group-hover:text-white transition-colors">STRICT LIQUIDITY FILTER</span>
                          <input type="checkbox" className="sr-only" checked={systemConfig.strictLiquidity} onChange={(e) => {
                             const n = {...systemConfig, strictLiquidity: e.target.checked};
                             setSystemConfig(n); setDoc(doc(db, "system", "config"), n, {merge:true});
                          }} />
                          <div className={cn("w-8 h-4 rounded-full relative transition-colors", systemConfig.strictLiquidity ? "bg-gold" : "bg-gray-800 border border-white/10")}>
                             <div className={cn("w-3 h-3 rounded-full absolute top-0.5 transition-all", systemConfig.strictLiquidity ? "bg-black right-0.5" : "bg-gray-500 left-0.5")}></div>
                          </div>
                       </label>
                    </div>
                 </div>
              </div>

           </div>
        </motion.div>
      )}
      {activeTab === 'users' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
           {!selectedUser ? (
              <div className="bg-[#0a0a0a] p-6 border border-white/5 rounded-xl space-y-6 shadow-2xl">
                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                   <div className="relative w-full sm:w-64">
                     <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                     <input 
                       type="text" 
                       placeholder="SEARCH USERS / UID..." 
                       value={userSearch}
                       onChange={(e) => setUserSearch(e.target.value)}
                       className="w-full bg-black border border-white/10 rounded font-mono text-xs pl-9 pr-4 py-2 text-white focus:border-gold outline-none uppercase tracking-widest placeholder:text-gray-600" 
                     />
                   </div>
                   <button onClick={fetchUsers} className="flex items-center justify-center gap-2 px-3 py-2 sm:py-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/5 text-[10px] text-white font-mono font-bold transition-colors uppercase tracking-widest">
                      POLLING
                   </button>
                 </div>
                 
                 <div className="overflow-x-auto border border-white/5 rounded-lg bg-black/60">
                    <table className="w-full text-left text-xs font-mono text-gray-300">
                      <thead className="bg-[#111] text-gray-500 uppercase text-[10px] font-bold tracking-widest border-b border-white/5">
                        <tr>
                          <th className="px-4 py-3">User Ident</th>
                          <th className="px-4 py-3">Credits</th>
                          <th className="px-4 py-3">Last Active</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-gray-600">NO DATA FOUND.</td>
                          </tr>
                        ) : filteredUsers.map(u => (
                          <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                            <td className="px-4 py-3 flex items-center gap-3">
                               <div className="w-8 h-8 rounded bg-[#1a1a1a] flex items-center justify-center font-bold text-gray-300 text-[10px] border border-white/10 group-hover:border-blue-500/30 transition-colors">
                                 {u.email.substring(0, 2).toUpperCase()}
                               </div>
                               <div>
                                  <div className="text-white font-bold tracking-wide">{u.email}</div>
                                  <div className="text-[9px] text-gray-500">{u.id}</div>
                               </div>
                            </td>
                            <td className="px-4 py-3">
                               <span className={cn("px-2 py-0.5 rounded font-bold text-[10px]", u.intelligenceCredits > 0 ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20")}>
                                 {u.intelligenceCredits} CRD
                               </span>
                            </td>
                            <td className="px-4 py-3 text-[10px] text-gray-400">
                               {u.lastActive ? new Date(u.lastActive.seconds * 1000).toLocaleString() : "OFFLINE"}
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                               <button onClick={() => selectUserForManagement(u)} className="px-2 py-1 bg-gold/10 text-gold hover:bg-gold/20 rounded text-[9px] font-bold uppercase tracking-widest transition-colors">MANAGE</button>
                               <button onClick={() => handleResetLimit(u.id)} className="px-2 py-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded text-[9px] font-bold uppercase tracking-widest transition-colors">GIVE 3 CRD</button>
                               <button onClick={() => handleRevokeAccess(u.id)} className="px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-[9px] font-bold uppercase tracking-widest transition-colors">TERMINATE</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </div>
           ) : (
              <div className="space-y-6 text-left">
                 {/* Back header */}
                 <div className="flex items-center justify-between">
                    <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded border border-white/5 text-[10px] text-white font-mono font-bold transition-colors uppercase tracking-widest">
                       <ArrowLeft className="w-3.5 h-3.5" /> BACK TO LIST
                    </button>
                    <div className="text-right">
                       <div className="text-white font-bold font-mono text-xs uppercase tracking-wider">{selectedUser.email}</div>
                       <div className="text-[9px] text-gray-500 font-mono">UID: {selectedUser.id}</div>
                    </div>
                 </div>

                 {/* Bento Stats Grid */}
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl text-center space-y-1">
                       <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Remaining Credits</div>
                       <div className="text-xl font-bold font-mono text-gold">{selectedUser.intelligenceCredits}</div>
                       <div className="text-[8px] text-gray-600 font-mono">Available for terminal use</div>
                    </div>
                    <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl text-center space-y-1">
                       <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Purchased Credits</div>
                       <div className="text-xl font-bold font-mono text-white">{selectedUser.purchasedCredits || 0}</div>
                       <div className="text-[8px] text-gray-600 font-mono">All-time lifetime purchased</div>
                    </div>
                    <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl text-center space-y-1">
                       <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Credits Used</div>
                       <div className="text-xl font-bold font-mono text-blue-400">{selectedUser.usedCredits || 0}</div>
                       <div className="text-[8px] text-gray-600 font-sans">Completed requests</div>
                    </div>
                    <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl text-center space-y-1">
                       <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Refunded Credits</div>
                       <div className="text-xl font-bold font-mono text-green-400">{selectedUser.refundedCredits || 0}</div>
                       <div className="text-[8px] text-gray-600 font-mono">Credits added via refunds</div>
                    </div>
                    <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl text-center space-y-1 col-span-2 md:col-span-1">
                       <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Access Status</div>
                       <div className="flex items-center justify-center h-7">
                          <span className={cn("px-2 py-0.5 rounded font-bold text-[10px] font-mono", selectedUser.intelligenceActive ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20")}>
                             {selectedUser.intelligenceActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                       </div>
                       <div className="text-[8px] text-gray-600 font-mono">Terminal capability state</div>
                    </div>
                 </div>

                 {/* Fine-grained Credit Adjustments Panel */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Controls */}
                    <div className="bg-[#0a0a0a] p-6 border border-white/5 rounded-xl space-y-5 shadow-2xl">
                       <h3 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
                          <Settings className="w-4 h-4 text-gold" /> CREDIT ADJUSTMENT CONTROLS
                       </h3>

                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                          {/* Add Credits */}
                          <div className="space-y-2 border border-white/5 p-3 rounded-lg bg-black/40">
                             <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">ADD CREDITS</div>
                             <input 
                                type="number" 
                                value={addAmount} 
                                onChange={(e) => setAddAmount(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded font-mono text-xs p-1.5 text-white outline-none" 
                             />
                             <button onClick={() => handleAddCredits(selectedUser.id, parseInt(addAmount) || 0)} className="w-full py-1.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-[9px] font-mono font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                                <Plus className="w-3 h-3" /> ADD
                             </button>
                          </div>

                          {/* Remove Credits */}
                          <div className="space-y-2 border border-white/5 p-3 rounded-lg bg-black/40">
                             <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">REMOVE CREDITS</div>
                             <input 
                                type="number" 
                                value={removeAmount} 
                                onChange={(e) => setRemoveAmount(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded font-mono text-xs p-1.5 text-white outline-none" 
                             />
                             <button onClick={() => handleRemoveCredits(selectedUser.id, parseInt(removeAmount) || 0)} className="w-full py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-[9px] font-mono font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                                <Minus className="w-3 h-3" /> REMOVE
                             </button>
                          </div>

                          {/* Direct Adjust */}
                          <div className="space-y-2 border border-white/5 p-3 rounded-lg bg-black/40">
                             <div className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">SET BALANCE</div>
                             <input 
                                type="number" 
                                value={adjustAmountState} 
                                onChange={(e) => setAdjustAmountState(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded font-mono text-xs p-1.5 text-white outline-none" 
                             />
                             <button onClick={() => handleAdjustBalance(selectedUser.id, parseInt(adjustAmountState) || 0)} className="w-full py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded text-[9px] font-mono font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1">
                                <Sparkles className="w-3 h-3" /> SET
                             </button>
                          </div>
                       </div>

                       <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <button onClick={() => handleRefundCredit(selectedUser.id)} className="flex-1 py-2 bg-green-500/15 text-green-400 hover:bg-green-500/20 rounded border border-green-500/10 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5">
                             <RefreshCw className="w-3.5 h-3.5" /> REFUND ONE CREDIT (ADMIN REFUND)
                          </button>
                          <button onClick={() => handleResetLimit(selectedUser.id)} className="flex-1 py-2 bg-blue-500/15 text-blue-400 hover:bg-blue-500/20 rounded border border-blue-500/10 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5">
                             <RefreshCw className="w-3.5 h-3.5" /> RESET TO 3 CREDITS
                          </button>
                       </div>
                       
                       <div className="border-t border-white/5 pt-4">
                          <button onClick={() => handleRevokeAccess(selectedUser.id)} className="w-full py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded border border-red-500/10 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors">
                             TERMINATE ALL ACCESS & SUSPEND TERMINAL
                          </button>
                       </div>
                    </div>

                    {/* Transaction History */}
                    <div className="bg-[#0a0a0a] p-6 border border-white/5 rounded-xl space-y-4 shadow-2xl flex flex-col h-[320px]">
                       <h3 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-3">
                          <History className="w-4 h-4 text-blue-400" /> RECENT AUDIT TRANSACTIONS
                       </h3>
                       
                       <div className="overflow-y-auto flex-1 pr-2 space-y-2.5 custom-scrollbar text-left">
                          {userTransactions.length === 0 ? (
                             <div className="text-center text-gray-600 py-12 text-xs font-mono">NO TRANSACTIONS RECORDED YET.</div>
                          ) : userTransactions.map((tx) => (
                             <div key={tx.id} className="p-3 bg-black/40 border border-white/5 rounded-lg space-y-1 hover:border-white/10 transition-colors">
                                <div className="flex justify-between items-center text-[10px]">
                                   <span className={cn("font-bold tracking-wider px-1.5 py-0.5 rounded text-[8px]", 
                                      tx.action === "usage" ? "bg-blue-500/10 text-blue-400 border border-blue-500/10" :
                                      tx.action === "admin_refund" || tx.action === "admin_add" ? "bg-green-500/10 text-green-400 border border-green-500/10" :
                                      tx.action === "admin_remove" ? "bg-red-500/10 text-red-400 border border-red-500/10" :
                                      "bg-purple-500/10 text-purple-400 border border-purple-500/10"
                                   )}>
                                      {tx.action?.toUpperCase()}
                                   </span>
                                   <span className="text-gray-500">{new Date(tx.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-white/5 mt-1.5">
                                   <div className="text-[9px] text-gray-400 font-mono">
                                      Credits: <span className="text-gray-500">{tx.creditsBefore}</span> → <span className="text-white font-bold">{tx.creditsAfter}</span>
                                   </div>
                                   <div className={cn("text-[9px] font-bold font-mono", tx.analysisStatus === "failed" ? "text-red-500" : "text-green-500")}>
                                      {tx.analysisStatus?.toUpperCase() || "SUCCESS"}
                                   </div>
                                </div>
                                {tx.result && (
                                   <div className="text-[8px] text-gray-500 font-mono truncate pt-1">{tx.result}</div>
                                )}
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
           )}
        </motion.div>
      )}

      {activeTab === 'quality' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
           <div className="grid grid-cols-1 gap-6">
              <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6 shadow-2xl">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-bold font-mono text-gray-400 uppercase tracking-widest flex items-center gap-2">
                       <Eye className="w-4 h-4 text-blue-500" /> AI QUALITY REVIEW SYSTEM
                    </h3>
                    <div className="flex gap-2">
                       <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-[10px] font-mono rounded">12 FLAG REQUIRED</span>
                    </div>
                 </div>

                 <div className="space-y-6">
                    {aiLogs.length === 0 ? (
                       <div className="p-8 text-center text-gray-500 font-mono text-xs border border-white/5 bg-white/5 rounded-xl">NO LOGS FOUND.</div>
                    ) : aiLogs.map(log => (
                       <div key={log.id} className="bg-black/60 border border-white/10 rounded-xl p-5">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                             <div>
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                   <span className={cn("px-2 py-0.5 text-[10px] font-mono rounded uppercase", log.type === 'CHART ENTRY' ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400")}>{log.type}</span>
                                   <span className="text-gray-400 font-mono text-[10px]">{log.pair} • {log.timeframe}</span>
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono">User: {log.userEmail} • Confidence: {log.confidenceScore}%</div>
                             </div>
                             <div className="flex flex-wrap gap-2">
                                <button className="px-3 py-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 text-[10px] font-bold font-mono rounded transition-colors uppercase">Approve</button>
                                <button className="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-[10px] font-bold font-mono rounded transition-colors uppercase">Reject & Retrain</button>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="bg-white/5 p-4 rounded-lg font-mono text-xs text-gray-300">
                                <div className="text-[10px] text-gray-500 mb-2">RAW AI OUTPUT</div>
                                <p>{log.rawOutput && log.rawOutput.length > 150 ? log.rawOutput.substring(0, 150) + "..." : log.rawOutput || "No narrative generated."}</p>
                             </div>
                             <div className={cn("border p-4 rounded-lg font-mono text-xs", log.setupQualityPoor ? "bg-red-500/5 border-red-500/10 text-gray-300" : "bg-green-500/5 border-green-500/10 text-gray-300")}>
                                <div className={cn("text-[10px] mb-2", log.setupQualityPoor ? "text-red-500" : "text-green-500")}>ORCHESTRATOR DIAGNOSTIC</div>
                                {log.diagnostic && log.diagnostic.length > 0 ? (
                                   <ul className={cn("list-disc pl-4 space-y-1", log.setupQualityPoor ? "text-red-400/80" : "text-green-400/80")}>
                                      {log.diagnostic.map((d, idx) => <li key={idx}>{d}</li>)}
                                   </ul>
                                ) : (
                                   <p className="text-green-400/80">Setup passed all quality checks.</p>
                                )}
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </motion.div>
      )}

      {activeTab === 'settings' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-[#0a0a0a] p-6 border border-white/5 rounded-xl space-y-6 shadow-2xl">
              <h3 className="text-xs font-bold font-mono text-white flex items-center gap-2 mb-4 uppercase tracking-widest"><Settings className="w-4 h-4 text-gray-400" /> System Controls</h3>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase font-mono tracking-widest mb-2 block">Credits Package Price (USD)</label>
                    <input type="number" value={systemConfig.packagePrice} onChange={(e) => setSystemConfig({...systemConfig, packagePrice: Number(e.target.value)})} className="w-full bg-black border border-white/10 rounded font-mono px-4 py-2 text-white focus:border-gold outline-none" />
                 </div>
                 
                 <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase font-mono tracking-widest mb-2 block">Credits Per Package</label>
                    <input type="number" value={systemConfig.creditsPerPackage} onChange={(e) => setSystemConfig({...systemConfig, creditsPerPackage: Number(e.target.value)})} className="w-full bg-black border border-white/10 rounded font-mono px-4 py-2 text-white focus:border-gold outline-none" />
                 </div>
                 
                 <div className="pt-4 border-t border-white/5">
                    <button onClick={handleSaveConfig} className="w-full py-2 bg-gold hover:bg-yellow-400 text-black font-bold font-mono rounded transition-colors uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                        Commit Configuration
                    </button>
                 </div>
              </div>
           </div>

           <div className="bg-[#0a0a0a] p-6 border border-white/5 rounded-xl space-y-6 shadow-2xl">
              <h3 className="text-xs font-bold font-mono text-white flex items-center gap-2 mb-4 uppercase tracking-widest"><Database className="w-4 h-4 text-red-500" /> Danger Zone</h3>
              
              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg">
                 <h4 className="text-[10px] font-mono text-red-500 mb-2 font-bold uppercase tracking-widest">Purge Market Cache</h4>
                 <p className="text-[10px] font-mono text-gray-500 mb-4">Clear all cached AI market analysis results. Forces regeneration.</p>
                 <button className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold font-mono rounded text-[10px] uppercase tracking-widest transition-colors">
                     Execute Purge
                 </button>
              </div>

              <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-lg">
                 <h4 className="text-[10px] font-mono text-yellow-500 mb-2 font-bold uppercase tracking-widest">Emergency Engine Stop</h4>
                 <p className="text-[10px] font-mono text-gray-500 mb-4">Instantly disable the Intelligence Terminal for all users.</p>
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={systemConfig.killSwitch} onChange={async (e) => {
                        const isKillSwitchOn = e.target.checked;
                        const n = {...systemConfig, killSwitch: isKillSwitchOn};
                        setSystemConfig(n); 
                        
                        try {
                           await setDoc(doc(db, "system", "config"), n, {merge:true});
                           
                           const { getDocs, writeBatch } = await import("firebase/firestore");
                            const usersSnap = await getDocs(collection(db, "users"));
                            const batches = [];
                            let currentBatch = writeBatch(db);
                            let operationCount = 0;
                            
                            usersSnap.docs.forEach((userDoc) => {
                              const notifRef = doc(collection(db, 'users/' + userDoc.id + '/notifications'));
                              currentBatch.set(notifRef, {
                                userId: userDoc.id,
                                type: 'ACCOUNT',
                                title: isKillSwitchOn ? 'System Maintenance Alert' : 'System Restored',
                                message: isKillSwitchOn 
                                  ? 'The Intelligence Terminal is temporarily offline for critical maintenance. AI analysis is currently suspended. We will notify you once systems are restored.'
                                  : 'The Intelligence Terminal is back online and fully operational. All AI capabilities have been restored.',
                                priority: "HIGH",
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
                            
                            if (isKillSwitchOn) {
                               toast.success("Maintenance notification broadcasted to all users.");
                            } else {
                               toast.success("Intelligence Terminal reactivated and notification broadcasted.");
                            }
                        } catch (error) {
                           console.error("Error setting kill switch:", error);
                           toast.error("Failed to toggle emergency stop");
                        }
                     }} />
                    <div className="w-8 h-4 bg-black border border-white/10 rounded-full peer peer-checked:bg-yellow-500 relative transition-colors">
                       <div className="w-3 h-3 bg-gray-500 peer-checked:bg-black rounded-full absolute left-0.5 top-0.5 transition-all peer-checked:left-4"></div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-gray-400 ml-2">Kill Switch</span>
                 </label>
              </div>
           </div>
        </motion.div>
      )}

      {activeTab === 'tests' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-[#0a0a0a] p-6 border border-white/5 rounded-xl space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10">
              <div>
                <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2 uppercase tracking-widest">
                  <Shield className="w-5 h-5 text-gold" /> Phase 2 & Regression Automated Test Harness
                </h3>
                <p className="text-xs text-gray-400 mt-1 font-mono">
                  Real-time validation of Market Regime, Strategy Weights, Evidence Scoring, News/Holiday, Correlation, Daily Loss, and 18-Point Decision Gate.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsRunningTests(true);
                  try {
                    const res = runAllPhase2Tests();
                    setTestResults(res);
                    if (res.failed === 0) {
                      toast.success(`All ${res.total} tests passed successfully!`);
                    } else {
                      toast.error(`${res.failed} tests failed`);
                    }
                  } catch (e: any) {
                    toast.error(`Test execution error: ${e.message}`);
                  } finally {
                    setIsRunningTests(false);
                  }
                }}
                disabled={isRunningTests}
                className="px-6 py-2.5 bg-gold hover:bg-yellow-400 text-black font-bold font-mono rounded-lg transition-all flex items-center gap-2 text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(250,204,21,0.3)] disabled:opacity-50 cursor-pointer"
              >
                {isRunningTests ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                {isRunningTests ? "Executing Tests..." : "Run Test Suite"}
              </button>
            </div>

            {testResults ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-black/60 p-4 border border-white/5 rounded-xl">
                    <span className="text-gray-500 font-mono text-[10px] uppercase block mb-1">Total Tests</span>
                    <span className="text-2xl font-bold font-mono text-white">{testResults.total}</span>
                  </div>
                  <div className="bg-green-500/10 p-4 border border-green-500/20 rounded-xl">
                    <span className="text-green-400 font-mono text-[10px] uppercase block mb-1">Passed</span>
                    <span className="text-2xl font-bold font-mono text-green-400">{testResults.passed}</span>
                  </div>
                  <div className={cn("p-4 border rounded-xl", testResults.failed > 0 ? "bg-red-500/10 border-red-500/20" : "bg-white/5 border-white/5")}>
                    <span className="text-gray-400 font-mono text-[10px] uppercase block mb-1">Failed</span>
                    <span className={cn("text-2xl font-bold font-mono", testResults.failed > 0 ? "text-red-400" : "text-gray-500")}>
                      {testResults.failed}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase font-mono tracking-wider">Test Suite Execution Log</h4>
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                    {testResults.results.map((res, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-3 rounded-lg border font-mono text-xs flex items-center justify-between gap-4",
                          res.passed ? "bg-white/5 border-white/5" : "bg-red-500/10 border-red-500/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {res.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          )}
                          <div>
                            <span className="text-[10px] text-gold font-bold uppercase tracking-wider block">{res.suite}</span>
                            <span className="text-gray-200">{res.test}</span>
                            {res.message && <p className="text-[10px] text-red-400 mt-1">{res.message}</p>}
                          </div>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider shrink-0",
                          res.passed ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        )}>
                          {res.passed ? "PASSED" : "FAILED"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 font-mono text-xs">
                Click "Run Test Suite" to execute Phase 2 Intelligence & Phase 1 Regression verification.
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
