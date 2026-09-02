import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, MessageSquare, BookOpen, Lock, CreditCard, Wrench, 
  ChevronDown, ChevronUp, Send, CheckCircle, AlertCircle, 
  RefreshCw, Wifi, UserCheck, Clock, ShieldCheck, Crown, Activity
} from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { cn } from "../lib/utils";
import { SmartHelpModals } from "./support/SmartHelpModals";
import { SupportFAQ } from "./support/SupportFAQ";
import { GoogleGenAI } from "@google/genai";
import type { Plan } from "../types";
import type { User } from "firebase/auth";

interface SupportPageProps {
  user: User | null;
  userProfile: any | null;
  currentPlan: Plan;
}

export default function SupportPage({ user, userProfile, currentPlan }: SupportPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<'signal' | 'learning' | 'account' | 'billing' | null>(null);
  
  // Contact Form
  const [name, setName] = useState(userProfile?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Auto pre-fill if redirected with suspension info
  useEffect(() => {
    try {
      const savedSubject = localStorage.getItem("support_prefill_subject");
      const savedMessage = localStorage.getItem("support_prefill_message");
      if (savedSubject) {
        setSubject(savedSubject);
        localStorage.removeItem("support_prefill_subject");
      }
      if (savedMessage) {
        setMessage(savedMessage);
        localStorage.removeItem("support_prefill_message");
      }
    } catch (e) {}
  }, []);

  // AI Chat
  const [aiQuery, setAiQuery] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isAiTyping]);

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !subject || !message) return;
    
    setIsSubmitting(true);
    setSubmitError("");
    
    try {
      await addDoc(collection(db, "supportTickets"), {
        userId: user ? user.uid : "anonymous",
        name,
        email,
        subject,
        message,
        status: "open",
        createdAt: serverTimestamp()
      });
      setSubmitSuccess(true);
      setSubject("");
      setMessage("");
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (err: any) {
      setSubmitError("Failed to submit ticket. Please try again.");
      console.error("Support ticket error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery || aiQuery;
    if (!query.trim()) return;

    const userText = query;
    setSearchQuery("");
    setAiQuery("");
    
    setChatHistory(prev => [...prev, { role: 'user', text: userText }]);
    setIsAiTyping(true);

    try {
      // Create context string for the AI from user profile
      const userContext = user ? `
      The user is currently logged in.
      Plan: ${currentPlan}
      Name: ${userProfile?.displayName || 'Unknown'}
      ` : "The user is not logged in.";

      const prompt = `
        You are SESSIONKING's intelligent customer support assistant.
        Be helpful, concise, and professional. Match fintech SaaS standards. Use simple language. Avoid overcomplication.
        Never guarantee trading profits. Guide user step-by-step.
        
        **CRITICAL RULES ABOUT FORMATTING:**
        1. You MUST give clear responses paragraph by paragraph. 
        2. Do NOT use markdown symbols like "***", "**", or bullet points ("*", "-"). Instead, use clean paragraph breaks and capitalization to organize your text.

        **CRITICAL RULES ABOUT THE PLATFORM:**
        1. **We only generate signals:** We provide institutional-grade forex signals and market intelligence.
        2. **We are NOT a broker:** We do not hold user funds. "Your money is with your broker." Never give advice on how to deposit or withdraw funds from our platform because we do not have wallets for trading capital.
        3. **Subscriptions:** SESSIONKING provides paid signals on subscription plans (Pro, Premium, Institutional). Free plan users experience a 5-10 minute delay on signals and hidden SL/TP.
        4. **No Fake Responses:** If you do not know something or if a user asks a question outside of the scope of our software, politely inform them of our boundaries.

        Context: ${userContext}
        
        User Question: "${userText}"
        
        Provide a helpful solution instantly formatted cleanly.
      `;

      let aiText = "I'm sorry, I couldn't process that. Please try again.";
      try {
        const { fetchGeminiProxy } = await import("../services/geminiService");
        
        const systemPrompt = `You are the AI Support agent for SESSIONKING. Help users troubleshoot. Do not say you are an AI model. Address the user by their name if provided: ${userProfile?.displayName || 'Trader'}.`;
        
        // Chat format payload
        const resp = await fetchGeminiProxy({
          model: "gemini-3.5-flash-lite",
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: systemPrompt
        });
        aiText = resp.text || "No response generated";
      } catch (err) {
        console.error("Support chat error:", err);
      }
      
      setChatHistory(prev => [...prev, { role: 'ai', text: aiText }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Support system is currently overwhelmed. Please use the contact form below." }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-12 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-16">
        
        {/* Section 1: Hero Header */}
        <header className="text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
            Support Center •
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Get instant help, guidance, and answers to your trading experience.
          </p>
          
          <div className="max-w-2xl mx-auto relative group">
            <form onSubmit={handleAiSearch} className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask anything about SESSIONKING..."
                className="w-full bg-matte-black border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50 transition-all shadow-lg"
              />
              <button 
                type="submit" 
                className="absolute inset-y-0 right-2 flex items-center justify-center px-4 hover:text-gold transition-colors text-gray-400"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Section 2: AI Smart Assistant Chat */}
            {chatHistory.length > 0 && (
              <section className="glass-card p-6 border-white/10 flex flex-col h-[400px]">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gold">
                  <MessageSquare className="w-5 h-5" /> Smart Assistant
                </h3>
                <div className="flex-grow overflow-y-auto pr-2 space-y-4 no-scrollbar">
                  {chatHistory.map((msg, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-4 rounded-xl max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap",
                        msg.role === 'user' 
                          ? "bg-white/10 text-white ml-auto rounded-tr-sm" 
                          : "bg-gold/10 border border-gold/20 text-gray-200 mr-auto rounded-tl-sm flex flex-col gap-2"
                      )}
                    >
                      {msg.role === 'ai' && <span className="font-bold text-gold text-xs mb-1">AMI Assistant:</span>}
                      {msg.text}
                    </motion.div>
                  ))}
                  {isAiTyping && (
                    <div className="bg-gold/10 border border-gold/20 text-gray-200 mr-auto p-4 rounded-xl max-w-[85%] rounded-tl-sm text-sm flex items-center gap-2">
                       <span className="font-bold text-gold text-xs">AMI Assistant:</span>
                       <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce delay-75"></span>
                          <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce delay-150"></span>
                          <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce delay-300"></span>
                       </span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleAiSearch} className="mt-4 relative">
                   <input
                    type="text"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="Type your follow-up here..."
                    className="w-full bg-matte-black border border-white/10 rounded-lg py-3 px-4 pr-12 text-sm focus:outline-none focus:border-gold/30 transition-colors"
                  />
                  <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </section>
            )}

            {/* Section 4: Dynamic FAQ */}
            <SupportFAQ />

            {/* Section 5: Contact Form */}
            <section>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                Contact Support
              </h2>
              <form onSubmit={handleTicketSubmit} className="glass-card p-6 md:p-8 border-white/10 space-y-6">
                
                {submitSuccess && (
                  <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg flex items-center gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    Your message has been sent successfully. Our team will review it shortly.
                  </div>
                )}

                {submitError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {submitError}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400">Name</label>
                    <input 
                      required
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      readOnly={!!userProfile?.displayName}
                      className={cn(
                        "w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none transition-colors",
                         !!userProfile?.displayName ? "opacity-70 cursor-not-allowed" : "focus:border-gold/50"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-400">Email Address</label>
                    <input 
                      required
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      readOnly={!!user?.email}
                      className={cn(
                        "w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none transition-colors",
                         !!user?.email ? "opacity-70 cursor-not-allowed" : "focus:border-gold/50"
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-400">Subject</label>
                  <input 
                    required
                    type="text" 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of the issue"
                    className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-gold/50 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-400">Message</label>
                  <textarea 
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide detailed steps or information..."
                    className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-gold/50 transition-colors resize-y"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg flex items-center justify-center gap-2",
                    isSubmitting ? "bg-gold/50 text-white cursor-wait" : "bg-gold text-matte-black hover:scale-[1.01]"
                  )}
                >
                  {isSubmitting ? (
                    <> Submitting...</>
                  ) : (
                    "Send Message"
                  )}
                </button>
              </form>
            </section>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">
            
            {/* Section 6: Live Status */}
            <div className="glass-card p-6 border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-bold">System Status</h3>
                <p className="text-sm text-gray-400 mt-1">All services operational</p>
              </div>
              <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Online
              </div>
            </div>

            {/* Section 7: User-Specific Context */}
            {user && (
              <div className="glass-card p-6 border-white/10 space-y-4">
                <h3 className="font-bold flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-400" /> Your Profile
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Current Plan</span>
                    <span className="font-bold text-gold bg-gold/10 px-2 py-0.5 rounded text-xs uppercase tracking-wider">{currentPlan}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-gray-400">Activity Status</span>
                     <span className="font-mono text-gray-300">Active</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Last Login Location</span>
                    <span className="font-mono text-gray-300 truncate max-w-[120px]">{userProfile?.lastLoginLocation || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Quick Help Cards */}
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setActiveModal('signal')} className="glass-card p-4 border-white/5 hover:bg-white/5 transition-colors text-left flex flex-col items-center justify-center text-center gap-3">
                <div className="bg-blue-500/10 p-3 rounded-full text-blue-400"><Activity className="w-5 h-5" /></div>
                <span className="text-sm font-bold text-gray-200">Signal Engine Help</span>
              </button>
              <button onClick={() => setActiveModal('learning')} className="glass-card p-4 border-white/5 hover:bg-white/5 transition-colors text-left flex flex-col items-center justify-center text-center gap-3">
                <div className="bg-purple-500/10 p-3 rounded-full text-purple-400"><BookOpen className="w-5 h-5" /></div>
                <span className="text-sm font-bold text-gray-200">Forex Learning</span>
              </button>
              <button onClick={() => setActiveModal('account')} className="glass-card p-4 border-white/5 hover:bg-white/5 transition-colors text-left flex flex-col items-center justify-center text-center gap-3">
                <div className="bg-gold/10 p-3 rounded-full text-gold"><Lock className="w-5 h-5" /></div>
                <span className="text-sm font-bold text-gray-200">Account & Login</span>
              </button>
              <button onClick={() => setActiveModal('billing')} className="glass-card p-4 border-white/5 hover:bg-white/5 transition-colors text-left flex flex-col items-center justify-center text-center gap-3">
                <div className="bg-green-500/10 p-3 rounded-full text-green-400"><CreditCard className="w-5 h-5" /></div>
                <span className="text-sm font-bold text-gray-200">Billing Info</span>
              </button>
            </div>

            {/* Section 8: Troubleshooting Panel */}
            <div className="glass-card p-6 border-white/10">
              <h3 className="font-bold flex items-center gap-2 mb-4">
                <Wrench className="w-5 h-5 text-gray-400" /> Quick Troubleshooting
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <div className="p-1.5 bg-white/5 rounded-md"><RefreshCw className="w-4 h-4 text-gray-400" /></div>
                  <div className="flex-1">
                    <p className="font-bold">Refresh Session</p>
                    <p className="text-xs text-gray-500">Log out and log back in if data freezes.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <div className="p-1.5 bg-white/5 rounded-md"><Wifi className="w-4 h-4 text-gray-400" /></div>
                  <div className="flex-1">
                    <p className="font-bold">Check Network</p>
                    <p className="text-xs text-gray-500">Ensure raw sockets/WebSockets aren't blocked.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <div className="p-1.5 bg-white/5 rounded-md"><Clock className="w-4 h-4 text-gray-400" /></div>
                  <div className="flex-1">
                    <p className="font-bold">Verify Session</p>
                    <p className="text-xs text-gray-500">Signals only fire during active volatile sessions.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 9: Security/Trust */}
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-gold/70" />
              Your data is secure. All interactions are protected and encrypted.
            </div>

          </div>
          <SmartHelpModals 
        activeModal={activeModal} 
        onClose={() => setActiveModal(null)} 
        onRequestAISearch={(q) => {
            setSearchQuery(q);
            setAiQuery(q);
            // Optionally focus the search input, but adding to chat handles it too mostly
            const el = document.getElementById('ai-search-input');
            if (el) { el.focus(); setTimeout(() => { /* trigger submit maybe */ }, 100); }
        }}
      />
      </div>
    </div>
  </div>
);
}