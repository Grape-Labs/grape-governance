// Firebase Cloud Messaging Configuration File.
// Read more at https://firebase.google.com/docs/cloud-messaging/js/client && https://firebase.google.com/docs/cloud-messaging/js/receive

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: "AIzaSyD4fhk-i2FR4lm6EWlz05Bypj8LRq7r_CA",
    authDomain: "grp-gov-push.firebaseapp.com",
    projectId: "grp-gov-push",
    storageBucket: "grp-gov-push.appspot.com",
    messagingSenderId: "55096092431",
    appId: "1:55096092431:web:b58de51bbb7c3f3c0cc07a",
    measurementId: "G-6CNWJLWFQK"
  };

initializeApp(firebaseConfig);

//const messaging = getMessaging();

//initializeApp(firebaseConfig);

/*
// Retrieve firebase messaging
const messaging = firebase.messaging();

console.log("appId: "+messaging.appId);

// Handle incoming messages while the app is not in focus (i.e in the background, hidden behind other tabs, or completely closed).
messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message ', payload);
});
*/

export const requestForToken = () => {
    // The method getToken(): Promise<string> allows FCM to use the VAPID key credential
    // when sending message requests to different push services
    return getToken(messaging, { vapidKey: `BM_s33yFFF-lFBJDsVm_4qp8h4uUM3-ujhCvtJSuzNSWrVZR1WxPs4xcgUZeOujEebUbSOYMLzZfT4GKt_9Rodg` }) //to authorize send requests to supported web push services
        .then((currentToken) => {
            if (currentToken) {
                console.log('current token for client: ', currentToken);

                if(localStorage.getItem('fcmToken') && currentToken !==localStorage.getItem('fcmToken')){
                    localStorage.setItem('fcmToken', currentToken);

                }

                else if(!localStorage.getItem('fcmToken')){
                    localStorage.setItem('fcmToken', currentToken);

                }


            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        })
        .catch((err) => {
            console.log('An error occurred while retrieving token. ', err);
        });
};