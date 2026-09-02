import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LayoutDashboard, Users, Activity, Settings, Bell, CreditCard, BarChart3, ScrollText, ShieldAlert, Menu, X, MessageSquare, Megaphone, Brain, ArrowLeft, Cpu, Radio } from "lucide-react";

// Import sub-components
import DashboardOverview from "./admin/DashboardOverview";
import UserManagement from "./admin/UserManagement";
import SignalManagement from "./admin/SignalManagement";
import EngineControl from "./admin/EngineControl";
import NotificationControl from "./admin/NotificationControl";
import ActivityLogs from "./admin/ActivityLogs";
import SubscriptionManagement from "./admin/SubscriptionManagement";
import AnalyticsReporting from "./admin/AnalyticsReporting";
import SystemSettings from "./admin/SystemSettings";
import SupportTickets from "./admin/SupportTickets";
import AdminIntelligenceControl from "./AdminIntelligenceControl";
import SystemHealthWidget from "./SystemHealthWidget";
import MarketDataDiagnostics from "./MarketDataDiagnostics";

type AdminTab = "overview" | "users" | "signals" | "engine" | "market_sync" | "subscriptions" | "broadcast" | "analytics" | "settings" | "logs" | "support" | "intelligence" | "health";

export default function AdminPanel({ user, onExit }: { user: any, onExit: () => void }) {

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const tabs = [
    { id: "overview", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: "market_sync", label: "Market Feed & Sync", icon: <Radio className="w-5 h-5 text-gold" /> },
    { id: "users", label: "Users", icon: <Users className="w-5 h-5" /> },
    { id: "support", label: "Support Tickets", icon: <MessageSquare className="w-5 h-5" /> },
    { id: "signals", label: "Signals", icon: <Activity className="w-5 h-5" /> },
    { id: "engine", label: "Trading Engine", icon: <Settings className="w-5 h-5" /> },
    { id: "intelligence", label: "Intelligence", icon: <Brain className="w-5 h-5" /> },
    { id: "health", label: "System Health", icon: <Cpu className="w-5 h-5 text-emerald-400" /> },
    { id: "subscriptions", label: "Subscriptions", icon: <CreditCard className="w-5 h-5" /> },
    { id: "broadcast", label: "Broadcast", icon: <Megaphone className="w-5 h-5" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="w-5 h-5" /> },
    { id: "logs", label: "Activity Logs", icon: <ScrollText className="w-5 h-5" /> },
    { id: "settings", label: "System Settings", icon: <ShieldAlert className="w-5 h-5" /> },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-matte-black overflow-hidden relative">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-black/80 backdrop-blur-md z-40 relative">
        <h2 className="text-gold font-bold tracking-widest uppercase text-sm">Admin Control</h2>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-400 hover:text-white"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="absolute inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        absolute md:relative z-50 md:z-10 w-64 bg-black/95 md:bg-black/50 border-r border-white/5 flex flex-col h-full transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="hidden md:block p-6">
          <h2 className="text-gold font-bold tracking-widest uppercase text-sm mb-4">Admin Control</h2>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 space-y-2 py-6 md:py-0 md:pb-6 custom-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as AdminTab);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium ${
                activeTab === tab.id ? "bg-gold/10 text-gold" : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-white/5">
          <button 
            onClick={onExit}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            Return to App
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-matte-black p-4 md:p-8 custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "overview" && <DashboardOverview />}
            {activeTab === "market_sync" && <MarketDataDiagnostics />}
            {activeTab === "users" && <UserManagement />}
            {activeTab === "support" && <SupportTickets />}
            {activeTab === "signals" && <SignalManagement />}
            {activeTab === "engine" && <EngineControl />}
            {activeTab === "subscriptions" && <SubscriptionManagement />}
            {activeTab === "broadcast" && <NotificationControl />}
            {activeTab === "analytics" && <AnalyticsReporting />}
            {activeTab === "settings" && <SystemSettings />}
            {activeTab === "logs" && <ActivityLogs />}
            {activeTab === "intelligence" && <AdminIntelligenceControl />}
            {activeTab === "health" && (
              <div className="max-w-6xl mx-auto space-y-6">
                <SystemHealthWidget showTitle />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
