import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { Search, Filter, RefreshCw, Activity, Calendar } from "lucide-react";

export default function ActivityLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users to map IDs to names/emails
      const usersSnap = await getDocs(collection(db, "users"));
      const map: Record<string, string> = {};
      usersSnap.docs.forEach(doc => {
        const data = doc.data();
        map[doc.id] = data.displayName || data.name || data.email || doc.id;
      });
      setUsersMap(map);

      // Fetch logs
      const snap = await getDocs(query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(200)));
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching logs data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatLogDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      if (typeof timestamp.toDate === "function") {
        return timestamp.toDate().toLocaleString();
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleString();
      }
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString();
      }
      return String(timestamp);
    } catch {
      return "N/A";
    }
  };

  const filteredLogs = logs.filter(log => {
    const actionStr = String(log.action || "").toUpperCase();
    const adminStr = String(usersMap[log.adminId] || log.adminId || "").toLowerCase();
    const targetStr = String(usersMap[log.targetUserId] || log.targetUserId || "").toLowerCase();
    const detailsStr = log.details ? JSON.stringify(log.details).toLowerCase() : "";
    const search = searchTerm.toLowerCase();

    const matchesSearch = 
      actionStr.toLowerCase().includes(search) ||
      adminStr.includes(search) ||
      targetStr.includes(search) ||
      detailsStr.includes(search);

    const matchesType = 
      filterType === "ALL" ||
      (filterType === "DELETE" && actionStr.includes("DELETE")) ||
      (filterType === "PLAN" && actionStr.includes("PLAN")) ||
      (filterType === "SUSPEND" && actionStr.includes("SUSPEND")) ||
      (filterType === "UPDATE" && actionStr.includes("UPDATE"));

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-gold" /> Activity Logs
          </h2>
          <p className="text-gray-400 text-sm mt-1">Audit log of all administrator actions & platform events.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search logs..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-gold"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-gold appearance-none cursor-pointer"
          >
            <option value="ALL" className="bg-matte-black text-white">All Events</option>
            <option value="PLAN" className="bg-matte-black text-white">Plan Changes</option>
            <option value="SUSPEND" className="bg-matte-black text-white">Suspensions</option>
            <option value="DELETE" className="bg-matte-black text-white">Deletions</option>
            <option value="UPDATE" className="bg-matte-black text-white">Updates</option>
          </select>
          <button 
            onClick={fetchData}
            className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl font-bold text-sm uppercase tracking-widest transition-colors flex items-center gap-2 text-white"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gold' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 border-b border-white/5 text-xs uppercase tracking-widest text-gray-400">
                <th className="p-4 font-medium">Timestamp</th>
                <th className="p-4 font-medium">Event Type</th>
                <th className="p-4 font-medium">Admin / Actor</th>
                <th className="p-4 font-medium">Action & Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400">Loading activity logs...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400">No activity logs match your filter.</td></tr>
              ) : (
                filteredLogs.map(log => {
                  const action = String(log.action || "EVENT");
                  return (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors text-sm">
                      <td className="p-4 text-gray-400 font-mono text-xs whitespace-nowrap">
                        {formatLogDate(log.timestamp)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          action.includes('DELETE') ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          action.includes('SUSPEND') ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          action.includes('PLAN') ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          action.includes('UPDATE') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          'bg-white/10 text-gray-300 border border-white/10'
                        }`}>
                          {action}
                        </span>
                      </td>
                      <td className="p-4 text-gray-300 font-medium">
                        {usersMap[log.adminId] || log.adminId || "System"}
                      </td>
                      <td className="p-4 text-white">
                        <div>
                          <span>{action}</span>
                          {log.targetUserId && (
                            <span className="text-gray-400 text-xs ml-1">
                              on <span className="text-gold font-mono">{usersMap[log.targetUserId] || log.targetUserId}</span>
                            </span>
                          )}
                        </div>
                        {log.details && (
                          <div className="text-xs text-gray-400 mt-1 font-mono bg-black/30 p-2 rounded border border-white/5 max-w-xl overflow-x-auto">
                            {typeof log.details === 'object' ? JSON.stringify(log.details, null, 2) : String(log.details)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
