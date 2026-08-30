import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import firebaseConfig from "../firebase-applet-config.json";

// Suppress transient benign connection retry logs in console
try {
  setLogLevel("error");
} catch (e) {
  // Ignore
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Firestore with auto-detect transport and robust cache
function getFirestoreInstance() {
  const databaseId = firebaseConfig.firestoreDatabaseId || undefined;
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      },
      databaseId
    );
  } catch (err) {
    // Fallback if IndexedDB is restricted or already initialized
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        localCache: memoryLocalCache()
      },
      databaseId
    );
  }
}

export const db = getFirestoreInstance();
export const storage = getStorage(app);

// Initialize Firebase Cloud Messaging safely
export let messaging: any = null;
if (typeof window !== "undefined") {
  try {
    messaging = getMessaging(app);
  } catch (e) {
    // Messaging may not be supported in all environments (e.g. non-HTTPS iframe)
  }
}

