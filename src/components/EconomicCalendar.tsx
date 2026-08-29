import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Clock, Target, ChevronDown, ChevronUp, AlertCircle, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { User as UserProfile } from '../types';

interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

interface EconomicCalendarProps {
  selectedPair?: string;
  user?: FirebaseUser | null;
  userProfile?: UserProfile | null;
}

export default function EconomicCalendar({ selectedPair, user, userProfile }: EconomicCalendarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());
  const notifiedEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Update current time every minute
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Filter high-impact events (upcoming and recently passed)
  const displayEvents = events.filter((event) => {
    if (event.impact !== "High") return false;
    const eventTime = new Date(event.date);
    const timeDiffMs = eventTime.getTime() - now.getTime();
    const timeDiffMinutes = Math.floor(timeDiffMs / (1000 * 60));
    
    // Show events up to 15 minutes after they occur
    if (timeDiffMinutes < -15) return false;

    if (selectedPair) {
      const bases = selectedPair.split('/');
      // The event country usually matches the currency symbol (e.g. "USD", "EUR")
      if (!bases.includes(event.country)) return false;
    }
    
    return true;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Check and push notifications for matched events at 15 minutes mark
  useEffect(() => {
    if (!user || !userProfile || !userProfile.preferredPairs || events.length === 0) return;

    events.forEach(event => {
      if (event.impact !== "High") return;

      const eventTime = new Date(event.date);
      const timeDiffMs = eventTime.getTime() - now.getTime();
      const timeDiffMinutes = Math.floor(timeDiffMs / (1000 * 60));

      // Alert exactly at 15 minutes before the event
      if (timeDiffMinutes === 15) {
        const eventId = `${event.title}-${event.date}`;
        
        if (!notifiedEventsRef.current.has(eventId)) {
          // Check if this event affects any of the user's preferred pairs
          const matchesPreferred = userProfile.preferredPairs.some(pair => {
             const bases = pair.split('/');
             return bases.includes(event.country);
          });

          if (matchesPreferred) {
            notifiedEventsRef.current.add(eventId);
            
            // Push Notification
            addDoc(collection(db, "users", user.uid, "notifications"), {
              userId: user.uid,
              type: "ALERT",
              title: `High-Impact Market News in 15 mins`,
              message: `High-impact news for ${event.country} (${event.title}) will be released in exactly 15 minutes. Prepare for potential volatility on your preferred pairs.`,
              priority: "HIGH",
              isRead: false,
              timestamp: new Date().toISOString()
            }).catch(e => console.error("News notification failed", e));
          }
        }
      }
    });
  }, [now, events, user, userProfile]);

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const response = await fetch('/api/calendar');
        if (!response.ok) return;
        const result = await response.json();
        if (result.success && result.data) {
          setEvents(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch economic calendar:", error);
      }
    };

    fetchCalendar();
    // Refresh every hour
    const timer = setInterval(fetchCalendar, 3600000);
    return () => clearInterval(timer);
  }, []);

  if (displayEvents.length === 0) {
    return (
      <div className="glass-card mb-8 overflow-hidden border-white/10 flex flex-col h-[500px]">
        <div className="p-4 sm:p-6 bg-gradient-to-r from-gold/20 to-transparent border-b border-white/10 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold" />
            Economic Calendar {selectedPair && <span className="text-gray-400 text-sm ml-2">({selectedPair})</span>}
          </h3>
        </div>
        <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
           <Calendar className="w-12 h-12 mb-4 opacity-20" />
           <p>No upcoming high-impact events for {selectedPair || "the market"}.<br/>Volatility risk is currently low.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card mb-8 overflow-hidden border-white/10 flex flex-col h-[500px]">
      <div className="p-4 sm:p-6 bg-gradient-to-r from-gold/20 to-transparent border-b border-white/10 flex justify-between items-center shrink-0">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gold" />
          Economic Calendar {selectedPair && <span className="text-gray-400 text-sm ml-2">({selectedPair})</span>}
        </h3>
      </div>
      <div className="overflow-y-auto no-scrollbar flex-1 p-2">
      {displayEvents.map((event, index) => {
        const eventTime = new Date(event.date);
        const timeDiffMs = eventTime.getTime() - now.getTime();
        const timeDiffMinutes = Math.floor(timeDiffMs / (1000 * 60));
        
        const isPast = timeDiffMinutes < 0;
        const isCriticalRisk = !isPast && timeDiffMinutes <= 20;

        return (
          <div key={index} className="glass-card overflow-hidden">
            <div 
              className={cn(
                "p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer transition-colors border-b-2",
                isPast ? "bg-gray-900/50 border-gray-800 hover:bg-gray-800/50 opacity-60" :
                isCriticalRisk ? "bg-red-500/10 border-red-500 hover:bg-red-500/20" : "bg-gold/5 border-gold/50 hover:bg-gold/10"
              )}
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            >
              <div className="flex items-center gap-3 w-full sm:w-auto mb-3 sm:mb-0">
                {isPast ? (
                  <div className="p-2 bg-gray-800 rounded-lg">
                    <Calendar className="w-6 h-6 text-gray-500" />
                  </div>
                ) : isCriticalRisk ? (
                  <div className="p-2 bg-red-500/20 rounded-lg animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                ) : (
                  <div className="p-2 bg-gold/10 rounded-lg">
                    <Calendar className="w-6 h-6 text-gold" />
                  </div>
                )}
                
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn("font-bold text-lg", isPast ? "text-gray-400" : "text-white")}>{event.country}</span>
                    <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest border",
                        isPast ? "bg-gray-800 text-gray-500 border-gray-700" : "bg-black/40 text-gray-300 border-white/10"
                    )}>{event.impact} Impact</span>
                  </div>
                  <h3 className={cn("font-medium", isPast ? "text-gray-500 line-through" : "text-gray-300")}>{event.title}</h3>
                </div>
              </div>

              <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                <div className="text-left sm:text-right">
                  {isPast ? (
                    <div className="text-gray-500 font-bold flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      COMPLETED
                    </div>
                  ) : isCriticalRisk ? (
                    <div className="text-red-400 font-bold flex items-center gap-2 animate-pulse">
                      <AlertCircle className="w-4 h-4" />
                      CRITICAL: {timeDiffMinutes} MINS
                    </div>
                  ) : (
                    <div className="text-gold font-bold flex items-center gap-2">
                       <Clock className="w-4 h-4" />
                       In {timeDiffMinutes >= 60 ? `${Math.floor(timeDiffMinutes / 60)}h ${timeDiffMinutes % 60}m` : `${timeDiffMinutes}m`}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 font-mono">
                     {eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                  </div>
                </div>
                
                <div className="p-1 rounded-full bg-black/30">
                  {expandedIndex === index ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {expandedIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-black/40 p-4 border-t border-white/5"
                >
                  {!isPast && (
                    <p className="text-sm text-gray-400 mb-4 flex items-start gap-2">
                      <Target className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                      Warning: Extreme market volatility and spread widening is expected during this {event.country} release. Do not place new trades right before the event. If you are in a trade, consider taking partial profits or adjusting stop losses.
                    </p>
                  )}
                  
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10 mb-4">
                    <h4 className="text-sm font-bold text-white mb-2">Event Reason & Context</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {event.title} is a critical economic indicator for the {event.country} economy. It generally drives massive institutional volume. Traders watch this to gauge the central bank's next move regarding interest rates.
                    </p>
                    {isPast && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <h4 className="text-sm font-bold text-blue-400 mb-1">Event Outcome</h4>
                        <p className="text-xs text-gray-300">
                          The event has concluded. Forecast was {event.forecast || "N/A"} and Previous was {event.previous || "N/A"}. Market structure may now begin to stabilize into a directional trend. Watch for post-news liquidity sweeps.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                     <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                       <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Currency</p>
                       <p className={cn("font-bold text-lg", isPast ? "text-gray-400" : "text-white")}>{event.country}</p>
                     </div>
                     <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                       <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Expected Impact</p>
                       <p className={cn("font-bold text-lg", isPast ? "text-gray-500" : event.impact === "High" ? "text-red-500" : "text-yellow-500")}>{event.impact}</p>
                     </div>
                     <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                       <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Forecast</p>
                       <p className={cn("font-bold text-lg font-mono", isPast ? "text-gray-400" : "text-white")}>{event.forecast || "N/A"}</p>
                     </div>
                     <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                       <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Previous Result</p>
                       <p className="text-gray-500 font-bold text-lg font-mono">{event.previous || "N/A"}</p>
                     </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
      </div>
    </div>
  );
}
