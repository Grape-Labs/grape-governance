// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

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
console.log("initialized firebase???");
// Retrieve firebase messaging
const messaging = firebase.messaging();

console.log("messaging: "+JSON.stringify(messaging));

messaging.onBackgroundMessage((payload) => {
  console.log(
      "[firebase-messaging-sw.js] Received background message ",
      payload
  );
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
      body: payload.notification.body,
      icon: payload.notification.image,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

/*
self.addEventListener('push', (event) => {
    console.log("HERE PUSHED...");
    event.waitUntil(
      self.registration.showNotification('Governance', {
        body: 'Its Freakin Grape!!!',
        icon: 'https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/governanceicon.png',
      })
    );
});
*/
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
/*
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); 
    console.log("HERE CLICKED...");
    var fullPath = self.location.origin + event.notification.data.path; 
    clients.openWindow(fullPath); 
});
*/