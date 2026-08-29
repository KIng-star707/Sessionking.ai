import admin from "firebase-admin";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
admin.initializeApp({ projectId: config.projectId });

async function test() {
  try {
    const users = await admin.auth().listUsers();
    console.log("Success! Users count:", users.users.length);
  } catch (e) {
    console.error("Failed:", e);
  }
}
test();
