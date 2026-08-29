import { useState } from "react";
import toast from "react-hot-toast";
import { collection, addDoc, serverTimestamp, getDocs, query, where, writeBatch, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { Bell, Send, AlertCircle, Megaphone } from "lucide-react";
import { AppNotification } from "../../types";

export default function NotificationControl() {
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AppNotification['type']>("ACCOUNT");
  const [priority, setPriority] = useState<AppNotification['priority']>("MEDIUM");
  const [target, setTarget] = useState("all");
  const [deliveryMethod, setDeliveryMethod] = useState<"dashboard" | "email">("dashboard");
  const [sending, setSending] = useState(false);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !title) return;
    
    setSending(true);
    try {
      // 1. Create the global announcement (for backwards compatibility/banners)
      await addDoc(collection(db, "announcements"), {
        message,
        type: type.toLowerCase(),
        target,
        active: true,
        createdAt: serverTimestamp()
      });

      // 2. Fetch target users
      let usersQuery = collection(db, "users");
      if (target === "pro") {
        usersQuery = query(collection(db, "users"), where("plan", "in", ["pro", "institutional"])) as any;
      } else if (target === "free") {
        usersQuery = query(collection(db, "users"), where("plan", "==", "free")) as any;
      }

      const usersSnap = await getDocs(usersQuery);
      
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      if (deliveryMethod === "dashboard") {
        // Send individual notifications using batches (max 500 per batch)
        usersSnap.docs.forEach((userDoc) => {
          const notifRef = doc(collection(db, `users/${userDoc.id}/notifications`));
          currentBatch.set(notifRef, {
            userId: userDoc.id,
            type,
            title,
            message,
            priority,
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
      } else if (deliveryMethod === "email") {
        // Send emails using the Trigger Email extension
        usersSnap.docs.forEach((userDoc) => {
          const userData = userDoc.data();
          if (userData.email) {
            const mailRef = doc(collection(db, "mail"));
            currentBatch.set(mailRef, {
              to: [userData.email],
              message: {
                subject: title,
                text: message,
                html: `<p>${message.replace(/\n/g, '<br>')}</p>`
              }
            });

            operationCount++;
            if (operationCount === 500) {
              batches.push(currentBatch.commit());
              currentBatch = writeBatch(db);
              operationCount = 0;
            }
          }
        });
      }

      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }

      await Promise.all(batches);

      if (deliveryMethod === "dashboard") {
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
              title,
              body: message,
              type,
              route: "/dashboard"
            })
          });
        } catch (e) {
          console.error("Failed to trigger FCM push", e);
        }
      }

      setMessage("");
      setTitle("");
      toast.success(`Broadcast sent successfully to ${usersSnap.size} users!`);
    } catch (error) {
      console.error("Error sending broadcast:", error);
      toast.error("Failed to send broadcast.");
    }
    setSending(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold uppercase tracking-widest text-white">Broadcast Center</h2>
      
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-8 border-b border-white/10 pb-4">
          <Megaphone className="w-6 h-6 text-gold" />
          <h3 className="text-xl font-bold uppercase tracking-widest text-white">New Broadcast Message</h3>
        </div>

        <form onSubmit={handleBroadcast} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Notification Title</label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold"
              placeholder="e.g., System Update, New Feature, Important Alert"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Message Content</label>
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold resize-none"
              placeholder="Enter notification message..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Category</label>
              <select 
                value={type}
                onChange={(e) => setType(e.target.value as AppNotification['type'])}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold appearance-none"
              >
                <option value="ACCOUNT">Account / System</option>
                <option value="SIGNAL">Trading Signal</option>
                <option value="RISK">Risk Alert</option>
                <option value="INSIGHT">AI Insight</option>
                <option value="VOLATILITY">Volatility Alert</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Priority</label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as AppNotification['priority'])}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold appearance-none"
              >
                <option value="LOW">Low (Neutral)</option>
                <option value="MEDIUM">Medium (Gold)</option>
                <option value="HIGH">High (Red)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Target Audience</label>
              <select 
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold appearance-none"
              >
                <option value="all">All Users</option>
                <option value="pro">Pro & Institutional Only</option>
                <option value="free">Free Users Only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Delivery Method</label>
              <select 
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value as "dashboard" | "email")}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold appearance-none"
              >
                <option value="dashboard">Dashboard Notification</option>
                <option value="email">Registered Email</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              type="submit"
              disabled={sending || !message || !title}
              className="px-8 py-3 bg-gold text-matte-black hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-sm uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              {sending ? "Sending..." : <><Send className="w-4 h-4" /> Broadcast Now</>}
            </button>
          </div>
        </form>
      </div>
      
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 flex gap-4">
        <AlertCircle className="w-6 h-6 text-blue-400 shrink-0" />
        <div>
          <h4 className="text-blue-400 font-bold uppercase tracking-widest text-sm mb-1">Delivery Methods</h4>
          <p className="text-gray-400 text-sm">
            <strong>Dashboard Notification:</strong> Sent directly to the selected users' notification centers in the app. High priority alerts will trigger a red badge.<br/>
            <strong>Registered Email:</strong> Sends an email to the users' registered email addresses. (Requires Firebase Trigger Email extension to be configured).
          </p>
        </div>
      </div>
    </div>
  );
}
