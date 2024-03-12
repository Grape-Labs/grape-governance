// This is the "Offline copy of pages" service worker

const CACHE = "governance-offline";

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

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