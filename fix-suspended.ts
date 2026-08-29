import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

import fs from 'fs';
const configPath = './firebase-applet-config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  let count = 0;
  for (const docSnap of snap.docs) {
    if (docSnap.data().suspended) {
        await updateDoc(docSnap.ref, { suspended: false });
        count++;
    }
  }
  console.log('Fixed', count, 'users');
  process.exit(0);
}
main();
