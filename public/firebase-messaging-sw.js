importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD2bURFV9nciEbf4T0d20PavoQp1eL3z7Y",
  authDomain: "king-fx-b17b7.firebaseapp.com",
  projectId: "king-fx-b17b7",
  storageBucket: "king-fx-b17b7.firebasestorage.app",
  messagingSenderId: "393345848838",
  appId: "1:393345848838:web:f58a2ddb68647802615587"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
