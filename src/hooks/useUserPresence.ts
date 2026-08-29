import { useEffect } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';

export function useUserPresence(user: User | null, userProfile: any) {
  useEffect(() => {
    if (!user || !userProfile) return;

    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastOnline: serverTimestamp()
        });
      } catch (err) {
        console.error("Failed to update presence:", err);
      }
    };

    // Update immediately on mount/auth change
    updatePresence();

    // Set interval to update every 60 seconds
    const interval = setInterval(updatePresence, 60000);

    // Update on visibility change (when returning to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);
}
