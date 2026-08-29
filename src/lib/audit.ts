import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

export async function logAdminAction(action: string, targetUserId: string | null, details: any) {
  if (!auth.currentUser) return;
  
  try {
    await addDoc(collection(db, "logs"), {
      action,
      adminId: auth.currentUser.uid,
      targetUserId,
      timestamp: serverTimestamp(),
      details
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
}
