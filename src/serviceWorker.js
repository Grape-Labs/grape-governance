// This is the "Offline copy of pages" service worker

const CACHE = "governance-offline";

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');
// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

workbox.routing.registerRoute(
  new RegExp('/*'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE
  })
);

const firebaseConfig = {
  apiKey: "AIzaSyD4fhk-i2FR4lm6EWlz05Bypj8LRq7r_CA",
  authDomain: "grp-gov-push.firebaseapp.com",
  projectId: "grp-gov-push",
  storageBucket: "grp-gov-push.appspot.com",
  messagingSenderId: "55096092431",
  appId: "1:55096092431:web:b58de51bbb7c3f3c0cc07a",
  measurementId: "G-6CNWJLWFQK"
};

firebase.initializeApp(firebaseConfig);

// Retrieve firebase messaging
const messaging = firebase.messaging();

// Handle incoming messages while the app is not in focus (i.e in the background, hidden behind other tabs, or completely closed).
messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message ', payload);

});


self.addEventListener('push', (event) => {
    console.log("HERE PUSHED...");
    event.waitUntil(
      self.registration.showNotification('Governance', {
        body: 'Its Freakin Grape!!!',
        icon: 'https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/governanceicon.png',
      })
    );
});

// Use event.data and extract notification information
/*
self.addEventListener('push', (event) => {
    const notificationData = event ? event?.data?.json() : null; // Assuming your server payload is JSON
    const title = notificationData?.title || "Notification";
    const body = notificationData?.body || "No message";
    const icon = notificationData?.icon || ""; // Use a default icon if no icon provided
  
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon
      })
    );
      
});
*/

self.addEventListener('notificationclick', (event) => {
    event.notification.close(); 
    console.log("HERE CLICKED...");
    var fullPath = self.location.origin + event.notification.data.path; 
    clients.openWindow(fullPath); 
});