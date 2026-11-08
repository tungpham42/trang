/* eslint-disable no-undef */
// Service worker for Firebase Cloud Messaging (study reminders when the tab is closed).
// The web config is passed through the registration URL's query string
// (see src/lib/reminders.ts), so no keys are hard-coded here.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

// Messages that carry a `notification` payload are displayed by the SDK itself,
// and clicking one opens the link set in webpush.fcmOptions.link on the server.
firebase.messaging();
