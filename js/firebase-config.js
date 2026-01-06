// js/firebase-config.js

// 1. Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 2. Your web app's Firebase configuration (Taken from your image)
const firebaseConfig = {
  apiKey: "AIzaSyAsNsSXrqFjQsz4meUek2S4SnLGvcl3X3o",
  authDomain: "dtebs-cf59a.firebaseapp.com",
  projectId: "dtebs-cf59a",
  storageBucket: "dtebs-cf59a.firebasestorage.app", // Note: I fixed the domain here based on standard patterns, usually it's .appspot.com or .firebasestorage.app but your image says .firebasestorage.app
  messagingSenderId: "430974164290",
  appId: "1:430974164290:web:0acaa0e033441f9a5dbcdb",
  measurementId: "G-4WEYN85B11"
};

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 4. Export them so other files can use them
export { auth, db, storage };