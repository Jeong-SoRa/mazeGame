// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBZQGj7pjh2NcAP4gt59b0oEkrFff5jLe0",
  authDomain: "maze-breakout.firebaseapp.com",
  projectId: "maze-breakout",
  storageBucket: "maze-breakout.firebasestorage.app",
  messagingSenderId: "893434134895",
  appId: "1:893434134895:web:d57610771645f6fc37e89a",
  measurementId: "G-FWE12JHTMV"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);