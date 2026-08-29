import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, CheckCircle, Clock, X, Search, Reply, Send, User, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface Ticket {
  id: string;
  userId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "open" | "closed";
  createdAt: any;
  adminReply?: string;
  repliedAt?: any;
}

const formatTicketDate = (ts: any, withTime = false) => {
  if (!ts) return "Recently";
  try {
    let date: Date;
    if (typeof ts.toDate === "function") {
      date = ts.toDate();
    } else if (ts.seconds) {
      date = new Date(ts.seconds * 1000);
    } else {
      date = new Date(ts);
    }
    if (isNaN(date.getTime())) return "Recently";
    return withTime ? date.toLocaleString() : date.toLocaleDateString();
  } catch {
    return "Recently";
  }
};

export default function SupportTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "closed">("open");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "supportTickets"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
      setTickets(ticketsData);
      setLoading(false);
      
      // Update selected ticket if it's currently open
      if (selectedTicket) {
        const updatedSelected = ticketsData.find(t => t.id === selectedTicket.id);
        if (updatedSelected) setSelectedTicket(updatedSelected);
      }
    });

    return () => unsubscribe();
  }, [selectedTicket]);

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setIsReplying(true);
    
    try {
      await updateDoc(doc(db, "supportTickets", selectedTicket.id), {
        status: "closed",
        adminReply: replyText,
        repliedAt: serverTimestamp()
      });
      setReplyText("");
      toast.success("Reply sent & ticket marked closed");
    } catch (error: any) {
      console.error("Error replying to ticket:", error);
      toast.error(error.message || "Failed to send reply");
    } finally {
      setIsReplying(false);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, "supportTickets", ticketId), {
        status: "closed"
      });
      toast.success("Ticket marked as closed");
    } catch (error: any) {
      console.error("Error closing ticket:", error);
      toast.error(error.message || "Failed to close ticket");
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filter === "all" || ticket.status === filter;
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-140px)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-gold" />
            Support Tickets
          </h2>
          <p className="text-gray-400 text-sm mt-1">Manage and respond to user inquiries.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-gold/50"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-gold/50"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="flex gap-6 h-full min-h-0">
        {/* Ticket List */}
        <div className={cn(
          "flex-1 md:w-1/2 lg:w-1/3 flex flex-col bg-black/50 border border-white/5 rounded-xl overflow-hidden",
          selectedTicket ? "hidden md:flex" : "flex"
        )}>
          <div className="overflow-y-auto no-scrollbar flex-1 p-2 space-y-2">
            {filteredTickets.length === 0 ? (
              <div className="text-center p-8 text-gray-500">
                No tickets found.
              </div>
            ) : (
              filteredTickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={cn(
                    "w-full text-left p-4 rounded-lg transition-all border",
                    selectedTicket?.id === ticket.id 
                      ? "bg-gold/10 border-gold/30" 
                      : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm truncate pr-2">
                      {ticket.subject}
                    </span>
                    <span className={cn(
                      "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shrink-0",
                      ticket.status === 'open' ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                    )}>
                      {ticket.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 line-clamp-2 mb-3">
                    {ticket.message}
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span className="truncate">{ticket.name}</span>
                    <span>{formatTicketDate(ticket.createdAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Ticket Details */}
        <div className={cn(
          "flex-1 bg-black/50 border border-white/5 rounded-xl flex flex-col overflow-hidden",
          !selectedTicket ? "hidden md:flex items-center justify-center" : "flex"
        )}>
          {!selectedTicket ? (
            <div className="text-center text-gray-500 space-y-3">
              <MessageSquare className="w-12 h-12 mx-auto stroke-[1.5]" />
              <p>Select a ticket to view details</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 md:p-6 border-b border-white/5 flex gap-4 items-start shrink-0">
                <button 
                  className="md:hidden mt-1 p-1 hover:bg-white/10 rounded-lg shrink-0"
                  onClick={() => setSelectedTicket(null)}
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <h3 className="font-bold text-lg break-words">{selectedTicket.subject}</h3>
                    {selectedTicket.status === 'open' && (
                      <button 
                        onClick={() => handleCloseTicket(selectedTicket.id)}
                        className="shrink-0 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/10 transition-colors flex flex-center gap-2"
                      >
                        Mark Closed
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5 whitespace-nowrap"><User className="w-4 h-4"/> {selectedTicket.name}</span>
                    <span className="flex items-center gap-1.5 whitespace-nowrap"><Reply className="w-4 h-4"/> {selectedTicket.email}</span>
                    <span className="flex items-center gap-1.5 whitespace-nowrap"><Clock className="w-4 h-4"/> {formatTicketDate(selectedTicket.createdAt, true)}</span>
                  </div>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                
                {/* User Message */}
                <div className="flex flex-col items-start gap-2">
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-medium px-1">
                    <User className="w-3 h-3" /> {selectedTicket.name}
                  </div>
                  <div className="bg-white/10 p-4 rounded-2xl rounded-tl-sm text-sm text-gray-200 w-fit max-w-[85%] whitespace-pre-wrap">
                    {selectedTicket.message}
                  </div>
                </div>

                {/* Admin Reply */}
                {selectedTicket.adminReply && (
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2 text-xs text-gold/70 font-medium px-1">
                      Admin Response <CheckCircle className="w-3 h-3 text-green-500" />
                    </div>
                    <div className="bg-gold/10 border border-gold/20 p-4 rounded-2xl rounded-tr-sm text-sm text-gray-200 w-fit max-w-[85%] whitespace-pre-wrap">
                      {selectedTicket.adminReply}
                    </div>
                    {selectedTicket.repliedAt && (
                       <div className="text-[10px] text-gray-600 px-1">
                         {formatTicketDate(selectedTicket.repliedAt, true)}
                       </div>
                    )}
                  </div>
                )}

              </div>

              {/* Reply Box */}
              {selectedTicket.status === 'open' && !selectedTicket.adminReply && (
                <div className="p-4 border-t border-white/5 bg-black/30 shrink-0">
                  <div className="relative">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply to the user..."
                      rows={3}
                      className="w-full bg-matte-black border border-white/10 rounded-xl p-4 pr-14 focus:outline-none focus:border-gold/50 text-sm resize-none custom-scrollbar"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={isReplying || !replyText.trim()}
                      className="absolute bottom-4 right-4 p-2 bg-gold text-black rounded-lg hover:bg-gold/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isReplying ? null : (<Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 px-1">
                    Replying will close this ticket. In a real environment, this could also send an email to the user.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
