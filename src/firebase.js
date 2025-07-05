// firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDp_U6oOnBVW2FwQgxu3Z3JiaHQ5glGMwA",
  authDomain: "blackout-firebase-e7b41.firebaseapp.com",
  projectId: "blackout-firebase-e7b41",
  storageBucket: "blackout-firebase-e7b41.appspot.com",
  messagingSenderId: "1086301423242",
  appId: "1:1086301423242:web:fbb685816c29a8583acf73",
  measurementId: "G-ZKGC14M8N3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
