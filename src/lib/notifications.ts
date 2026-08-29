import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AppNotification } from '../types';

export async function sendNotification(
  userId: string,
  type: AppNotification['type'],
  title: string,
  message: string,
  priority: AppNotification['priority'] = 'MEDIUM'
) {
  try {
    await addDoc(collection(db, `users/${userId}/notifications`), {
      userId,
      type,
      title,
      message,
      priority,
      isRead: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}
