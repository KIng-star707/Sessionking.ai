import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Activity, 
  AlertTriangle, 
  Brain, 
  User as UserIcon, 
  Check, 
  Trash2, 
  X, 
  TrendingUp, 
  TrendingDown, 
  Calculator, 
  Info,
  Zap,
  Shield,
  Calendar,
  CheckCheck,
  Filter,
  Volume2,
  VolumeX,
  ExternalLink
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, writeBatch, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { db, messaging } from '../firebase';
import { AppNotification } from '../types';
import { cn } from '../lib/utils';

interface NotificationSystemProps {
  userId: string;
  userProfile?: import('../types').User | null;
  onNavigate?: (page: string) => void;
}

// Global audio alert singleton to prevent dual-render echoing
let lastAudioPlayedTime = 0;
const playAudibleAlertSingleton = () => {
  const now = Date.now();
  if (now - lastAudioPlayedTime < 2500) return; // Debounce by 2.5s
  lastAudioPlayedTime = now;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.12); // C6
    
    gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.warn("Audio notification playback failed:", e);
  }
};

const parseTimestamp = (timestamp: any): number => {
  if (!timestamp) return Date.now();
  if (typeof timestamp === 'number') return timestamp;
  if (typeof timestamp?.toDate === 'function') {
    return timestamp.toDate().getTime();
  }
  if (typeof timestamp?.seconds === 'number') {
    return timestamp.seconds * 1000;
  }
  if (typeof timestamp?._seconds === 'number') {
    return timestamp._seconds * 1000;
  }
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp).getTime();
    return isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
};

const formatTime = (timestamp: any): string => {
  const timeMs = parseTimestamp(timestamp);
  const now = Date.now();
  const diffMs = Math.max(0, now - timeMs);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timeMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getTradeDetails = (notification: AppNotification) => {
  if (notification.metadata && typeof notification.metadata === 'object' && Object.keys(notification.metadata).length > 0) {
    const meta = notification.metadata as any;
    return {
      pair: String(meta.pair || "FOREX"),
      direction: String(meta.direction || "BUY").toUpperCase() as 'BUY' | 'SELL',
      entryPrice: typeof meta.entryPrice === 'number' ? meta.entryPrice : parseFloat(meta.entryPrice || 0) || undefined,
      exitPrice: typeof meta.exitPrice === 'number' ? meta.exitPrice : parseFloat(meta.exitPrice || 0) || undefined,
      stopLoss: typeof meta.stopLoss === 'number' ? meta.stopLoss : parseFloat(meta.stopLoss || 0) || undefined,
      takeProfit: typeof meta.takeProfit === 'number' ? meta.takeProfit : parseFloat(meta.takeProfit || 0) || undefined,
      hitType: (meta.hitType || (meta.hitSL ? 'SL' : 'TP')) as 'SL' | 'TP',
      pips: typeof meta.pips === 'number' ? meta.pips : Math.abs(parseFloat(meta.realizedPips || meta.pips || 0)) || 0,
      reasonDetails: meta.reasonDetails || meta.disclaimer || meta.probableCause || ""
    };
  }
  
  const title = notification.title || "";
  const message = notification.message || "";
  
  const isSL = title.toLowerCase().includes("stop loss") || message.toLowerCase().includes("stop loss") || title.includes("❌");
  const isTP = title.toLowerCase().includes("take profit") || message.toLowerCase().includes("take profit") || title.includes("✅");
  const isClosed = title.toLowerCase().includes("trade closed") || message.toLowerCase().includes("trade closed") || title.toLowerCase().includes("reached");
  
  if (!isClosed && !isSL && !isTP) return null;

  const hitType: 'SL' | 'TP' = isSL ? 'SL' : 'TP';
  
  // Extract pair safely
  const pairMatch = (title + " " + message).match(/([A-Z]{3}\/[A-Z]{3}|[A-Z]{6}|XAU\/USD|XAG\/USD|BTC\/USD|ETH\/USD)/);
  const pair = pairMatch ? pairMatch[1] : "FOREX";
  
  // Extract direction safely
  const dirMatch = (title + " " + message).match(/\b(BUY|SELL)\b/i);
  const direction = (dirMatch ? dirMatch[1].toUpperCase() : "BUY") as 'BUY' | 'SELL';
  
  // Extract target/exit price safely
  const priceMatch = message.match(/(?:at|reached|level|SL:|TP:)\s+([0-9.]+)/i);
  const exitPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
  
  const reasonDetails = hitType === 'SL'
    ? `Defensive risk threshold (Stop Loss) triggered at ${exitPrice || 'the stop loss level'}. Position closed automatically to protect capital.`
    : `Designated Take Profit level captured at ${exitPrice || 'the target level'}. The trade successfully achieved projected profit targets.`;

  return {
    pair,
    direction,
    entryPrice: undefined as number | undefined,
    exitPrice: exitPrice || undefined,
    stopLoss: hitType === 'SL' ? exitPrice : undefined,
    takeProfit: hitType === 'TP' ? exitPrice : undefined,
    hitType,
    pips: hitType === 'SL' ? 25 : 45,
    reasonDetails
  };
};

const getPipCalculationText = (details: any) => {
  const pair = String(details?.pair || "FOREX");
  const direction = details?.direction || "BUY";
  const entryPrice = typeof details?.entryPrice === 'number' ? details.entryPrice : parseFloat(details?.entryPrice || 0);
  const exitPrice = typeof details?.exitPrice === 'number' ? details.exitPrice : parseFloat(details?.exitPrice || 0);
  const pips = details?.pips !== undefined ? details.pips : 0;
  const hitType = details?.hitType || "TP";

  let pipMultiplier = 0.0001;
  if (pair.includes('JPY')) {
    pipMultiplier = 0.01;
  } else if (pair.includes('BTC') || pair.includes('ETH')) {
    pipMultiplier = 1;
  } else if (pair.includes('XAU') || pair.includes('XAG')) {
    pipMultiplier = 0.1;
  } else if (pair.includes('ZAR') || pair.includes('MXN') || pair.includes('BRL') || pair.includes('TRY')) {
    pipMultiplier = 0.001;
  }

  if (exitPrice && entryPrice && entryPrice > 0) {
    const diff = Math.abs(exitPrice - entryPrice);
    const formattedDiff = diff.toFixed(pair.includes('JPY') ? 3 : 5);
    
    const formulaStr = direction === 'BUY'
      ? (hitType === 'TP' 
          ? `(Exit [${exitPrice}] - Entry [${entryPrice}]) / ${pipMultiplier}`
          : `(Entry [${entryPrice}] - Exit [${exitPrice}]) / ${pipMultiplier}`)
      : (hitType === 'TP'
          ? `(Entry [${entryPrice}] - Exit [${exitPrice}]) / ${pipMultiplier}`
          : `(Exit [${exitPrice}] - Entry [${entryPrice}]) / ${pipMultiplier}`);
          
    return {
      formula: formulaStr,
      step1: `Price Delta: ${formattedDiff}`,
      step2: `${formattedDiff} / ${pipMultiplier} = ${pips} Pips`
    };
  }

  return {
    formula: exitPrice ? `Target Price reached at ${exitPrice}` : `Target level achieved`,
    step1: `Market execution on ${pair}`,
    step2: `Result: ${pips > 0 ? `+${pips}` : pips} Pips`
  };
};

type FilterCategory = 'ALL' | 'UNREAD' | 'SIGNALS' | 'SYSTEM';

export default function NotificationSystem({ userId, userProfile, onNavigate }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterCategory>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const processedNotificationsRef = useRef<Set<string>>(new Set());

  // Setup FCM push notifications safely
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;

    if ("Notification" in window && messaging) {
      if (Notification.permission === "granted") {
        initializeFCM();
      } else if (Notification.permission !== "denied" && (userProfile?.notificationsEnabled || userProfile?.volatilityAlertsEnabled)) {
        try {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              initializeFCM();
            }
          }).catch(() => {});
        } catch (e) {}
      }
    }
  }, [userId, userProfile?.notificationsEnabled, userProfile?.volatilityAlertsEnabled]);

  const initializeFCM = async () => {
    try {
      const vapiKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-skvMeZ2lgtsMa7ZcOusgXVtAIBXGzJvS45r-FwG-12nQo_f2l1a7EHU';
      const token = await getToken(messaging, { vapidKey: vapiKey });
      if (token && userId) {
        await updateDoc(doc(db, "users", userId), { fcmToken: token }).catch(() => {});
      }
      onMessage(messaging, (payload) => {
        const isVolatility = payload.data?.type === 'VOLATILITY';
        const shouldSendNotification = isVolatility ? userProfile?.volatilityAlertsEnabled : userProfile?.notificationsEnabled;
        
        if (shouldSendNotification) {
          if (soundEnabled) playAudibleAlertSingleton();
          if (payload.notification) {
            new Notification(payload.notification.title || "SessionKing Alert", {
              body: payload.notification.body,
              icon: '/vite.svg'
            });
          }
        }
      });
    } catch (err) {
      console.warn("FCM init skipped or unavailable in sandbox:", err);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications in real-time
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, `users/${userId}/notifications`),
      orderBy('timestamp', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications: AppNotification[] = [];
      const now = Date.now();
      const ONE_MINUTE_MS = 60000;

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notificationData = change.doc.data() as AppNotification;
          const notificationTime = parseTimestamp(notificationData.timestamp);
          
          // Send push & audio notification if it's new and unread
          if (!notificationData.isRead && now - notificationTime < ONE_MINUTE_MS && !processedNotificationsRef.current.has(change.doc.id)) {
            processedNotificationsRef.current.add(change.doc.id);
            
            if (soundEnabled && (notificationData.priority === 'HIGH' || notificationData.title?.includes('Re-evaluated') || notificationData.title?.includes('Trade Closed') || notificationData.type === 'VOLATILITY')) {
              playAudibleAlertSingleton();
            }
            
            const isVolatility = notificationData.type === 'VOLATILITY';
            const shouldSendNotification = isVolatility ? userProfile?.volatilityAlertsEnabled : userProfile?.notificationsEnabled;

            if (shouldSendNotification && "Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(notificationData.title, {
                  body: notificationData.message,
                  icon: '/vite.svg'
                });
              } catch (e) {
                console.warn("Desktop notification error:", e);
              }
            }
          }
        }
      });

      snapshot.forEach((docSnap) => {
        const raw = docSnap.data();
        const data: AppNotification = {
          id: docSnap.id,
          userId: raw.userId || userId,
          type: raw.type || 'SYSTEM',
          title: raw.title || 'System Notification',
          message: raw.message || '',
          priority: raw.priority || 'MEDIUM',
          isRead: Boolean(raw.isRead),
          timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : new Date(parseTimestamp(raw.timestamp)).toISOString(),
          metadata: raw.metadata || undefined
        };
        newNotifications.push(data);
      });

      setNotifications(newNotifications);
      setIsLoading(false);
    }, (error) => {
      console.warn("Notification listener notice:", error.message);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId, soundEnabled, userProfile?.notificationsEnabled, userProfile?.volatilityAlertsEnabled]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (filter === 'UNREAD') return !n.isRead;
      if (filter === 'SIGNALS') return ['SIGNAL', 'TRADE_ALERT', 'VOLATILITY'].includes(n.type?.toUpperCase());
      if (filter === 'SYSTEM') return ['SYSTEM', 'RISK', 'ACCOUNT', 'CALENDAR', 'ALERT', 'INSIGHT'].includes(n.type?.toUpperCase());
      return true;
    });
  }, [notifications, filter]);

  const toggleExpand = (notification: AppNotification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setExpandedId(prev => prev === notification.id ? null : notification.id);
  };

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, `users/${userId}/notifications`, notificationId), {
        isRead: true
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const toggleReadStatus = async (e: React.MouseEvent, notification: AppNotification) => {
    e.stopPropagation();
    if (!userId) return;
    try {
      await updateDoc(doc(db, `users/${userId}/notifications`, notification.id), {
        isRead: !notification.isRead
      });
    } catch (error) {
      console.error("Error toggling read status:", error);
    }
  };

  const deleteSingleNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    if (!userId) return;
    try {
      await deleteDoc(doc(db, `users/${userId}/notifications`, notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!userId || unreadCount === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.isRead).forEach(n => {
        const ref = doc(db, `users/${userId}/notifications`, n.id);
        batch.update(ref, { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const clearAll = async () => {
    if (!userId || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        const ref = doc(db, `users/${userId}/notifications`, n.id);
        batch.delete(ref);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const getIcon = (type: string) => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'SIGNAL': 
      case 'TRADE_ALERT': 
        return <Activity className="w-4 h-4 text-blue-400" />;
      case 'RISK': 
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'INSIGHT': 
        return <Brain className="w-4 h-4 text-purple-400" />;
      case 'ACCOUNT': 
      case 'SUBSCRIPTION': 
        return <UserIcon className="w-4 h-4 text-emerald-400" />;
      case 'VOLATILITY': 
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'CALENDAR': 
      case 'ALERT': 
        return <Calendar className="w-4 h-4 text-cyan-400" />;
      default: 
        return <Shield className="w-4 h-4 text-gold" />;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    const p = (priority || 'LOW').toUpperCase();
    switch (p) {
      case 'HIGH':
        return "bg-red-500/15 text-red-400 border border-red-500/30";
      case 'MEDIUM':
        return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
      default:
        return "bg-blue-500/15 text-blue-400 border border-blue-500/30";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        id="btn-notification-bell"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-xl transition-all flex items-center justify-center min-w-[38px] min-h-[38px] border",
          isOpen
            ? "bg-gold/15 border-gold/40 text-gold shadow-[0_0_15px_rgba(212,175,55,0.15)]"
            : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 hover:text-white"
        )}
        title="Market & System Notifications"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              notifications.some(n => !n.isRead && n.priority === 'HIGH') ? "bg-red-400" : "bg-gold"
            )}></span>
            <span className={cn(
              "relative inline-flex rounded-full h-4 w-4 items-center justify-center text-[9px] font-black text-matte-black font-mono shadow-md",
              notifications.some(n => !n.isRead && n.priority === 'HIGH') ? "bg-red-400 text-white" : "bg-gold text-matte-black"
            )}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Floating Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="absolute -right-12 sm:right-0 mt-2 w-[calc(100vw-28px)] max-w-[390px] sm:w-[420px] bg-matte-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
            style={{ maxHeight: 'min(580px, calc(100vh - 90px))' }}
          >
            {/* Header */}
            <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gold/10 text-gold border border-gold/20">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
                    Terminal Alerts
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-gold/20 text-gold border border-gold/30 rounded text-[9px] font-mono font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </h3>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    if (next) playAudibleAlertSingleton();
                  }}
                  className={cn(
                    "p-1.5 rounded-lg border transition-colors",
                    soundEnabled
                      ? "text-gold bg-gold/10 border-gold/20 hover:bg-gold/20"
                      : "text-gray-500 bg-white/5 border-white/5 hover:text-gray-400"
                  )}
                  title={soundEnabled ? "Audio Alerts Active (Click to mute)" : "Audio Alerts Muted (Click to enable)"}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="p-1.5 text-gray-400 hover:text-gold hover:bg-gold/10 border border-transparent hover:border-gold/20 rounded-lg transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}

                {notifications.length > 0 && (
                  <button 
                    onClick={clearAll}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg transition-colors"
                    title="Clear all alerts"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors sm:hidden"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="px-3 py-2 bg-black/40 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-[11px]">
              <button
                onClick={() => setFilter('ALL')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider transition-all shrink-0",
                  filter === 'ALL'
                    ? "bg-gold text-matte-black shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                All ({notifications.length})
              </button>

              <button
                onClick={() => setFilter('UNREAD')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider transition-all shrink-0 flex items-center gap-1",
                  filter === 'UNREAD'
                    ? "bg-gold text-matte-black shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                Unread {unreadCount > 0 && <span className="font-mono text-[10px]">({unreadCount})</span>}
              </button>

              <button
                onClick={() => setFilter('SIGNALS')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider transition-all shrink-0",
                  filter === 'SIGNALS'
                    ? "bg-gold text-matte-black shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                Signals
              </button>

              <button
                onClick={() => setFilter('SYSTEM')}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider transition-all shrink-0",
                  filter === 'SYSTEM'
                    ? "bg-gold text-matte-black shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}
              >
                System & Risk
              </button>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto custom-scrollbar flex-1 divide-y divide-white/5 max-h-[380px]">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                  <p className="text-xs font-mono">Syncing alert streams...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center">
                  <Bell className="w-8 h-8 mb-2 opacity-20 text-gray-400" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {filter === 'UNREAD' ? 'All caught up' : 'No notifications in this feed'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Real-time market updates, trade TP/SL hits, and account alerts will appear here.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notification) => {
                  const details = getTradeDetails(notification);
                  const isExpanded = expandedId === notification.id;

                  return (
                    <div 
                      key={notification.id}
                      onClick={() => toggleExpand(notification)}
                      className={cn(
                        "p-3.5 transition-colors cursor-pointer relative group text-left",
                        !notification.isRead
                          ? "bg-gold/[0.03] hover:bg-gold/[0.07]"
                          : "hover:bg-white/[0.02] opacity-80 hover:opacity-100"
                      )}
                    >
                      {/* Left indicator bar for unread notifications */}
                      {!notification.isRead && (
                        <div className={cn(
                          "absolute left-0 top-0 bottom-0 w-1",
                          notification.priority === 'HIGH' ? "bg-red-500" : "bg-gold"
                        )} />
                      )}

                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="p-2 rounded-xl bg-white/5 border border-white/5 shrink-0 mt-0.5">
                          {getIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={cn(
                              "text-xs font-bold truncate leading-tight",
                              !notification.isRead ? "text-white" : "text-gray-300"
                            )}>
                              {notification.title}
                            </h4>
                            <span className="text-[10px] text-gray-500 font-mono shrink-0 whitespace-nowrap">
                              {formatTime(notification.timestamp)}
                            </span>
                          </div>

                          <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">
                            {notification.message}
                          </p>

                          {/* Metadata Badges & Single Actions */}
                          <div className="flex items-center justify-between mt-2 pt-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-bold text-gray-400 bg-white/5 px-1.5 py-0.5 rounded uppercase font-mono">
                                {notification.type}
                              </span>
                              <span className={cn(
                                "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono",
                                getPriorityBadge(notification.priority)
                              )}>
                                {notification.priority || 'LOW'}
                              </span>
                              {details && (
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono",
                                  details.hitType === 'TP' ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
                                )}>
                                  {details.hitType === 'TP' ? `+${details.pips} PIPS` : `-${details.pips} PIPS`}
                                </span>
                              )}
                            </div>

                            {/* Quick action buttons */}
                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => toggleReadStatus(e, notification)}
                                className={cn(
                                  "p-1 rounded hover:bg-white/10 transition-colors",
                                  notification.isRead ? "text-gray-500 hover:text-gold" : "text-gold hover:text-white"
                                )}
                                title={notification.isRead ? "Mark as unread" : "Mark as read"}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => deleteSingleNotification(e, notification.id)}
                                className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete alert"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Details Panel */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 pt-3 border-t border-white/5 space-y-2.5">
                                  {/* Full message view */}
                                  <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs text-gray-300 leading-relaxed font-sans">
                                    {notification.message}
                                  </div>

                                  {/* If Trade details exist, show breakdown */}
                                  {details && (() => {
                                    const isTP = details.hitType === 'TP';
                                    const calc = getPipCalculationText(details);
                                    
                                    return (
                                      <div className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-2.5 text-left">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                            <Info className="w-3 h-3 text-gold" />
                                            Execution Math & Resolution
                                          </span>
                                          <div className="flex gap-1.5">
                                            <span className={cn(
                                              "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                                              details.direction === 'BUY' ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
                                            )}>
                                              {details.direction} {details.pair}
                                            </span>
                                            <span className={cn(
                                              "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-0.5",
                                              isTP ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                            )}>
                                              {isTP ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                              {isTP ? 'TP HIT' : 'SL HIT'}
                                            </span>
                                          </div>
                                        </div>

                                        {details.reasonDetails && (
                                          <div className="space-y-1">
                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                                              Resolution Context:
                                            </span>
                                            <p className="text-[11px] text-gray-300 bg-white/[0.03] p-2 rounded-lg leading-relaxed">
                                              {details.reasonDetails}
                                            </p>
                                          </div>
                                        )}

                                        <div className="p-2 bg-white/[0.02] border border-white/5 rounded-lg space-y-1 font-mono text-[10px]">
                                          <div className="flex justify-between text-gray-400">
                                            <span>Formula:</span>
                                            <span className="text-gray-300 truncate max-w-[180px]">{calc.formula}</span>
                                          </div>
                                          <div className="flex justify-between text-gray-400">
                                            <span>Delta:</span>
                                            <span className="text-gray-300">{calc.step1}</span>
                                          </div>
                                          <div className="flex justify-between pt-1 border-t border-white/5 font-bold">
                                            <span className="text-gray-400">Payout:</span>
                                            <span className={isTP ? "text-emerald-400" : "text-red-400"}>
                                              {calc.step2}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2.5 border-t border-white/10 bg-black/40 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-mono">
                  {unreadCount} unread / {notifications.length} total
                </span>
                {onNavigate && (
                  <button 
                    onClick={() => {
                      setIsOpen(false);
                      onNavigate('signals');
                    }}
                    className="text-[10px] text-gold hover:text-white uppercase tracking-wider font-bold transition-colors flex items-center gap-1"
                  >
                    <span>Signal Terminal</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

