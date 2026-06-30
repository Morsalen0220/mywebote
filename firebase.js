
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyBQMh_ZotlxqGqvmP-WYHniWgOV91vcL0o",
  authDomain: "noteapp-50e81.firebaseapp.com",
  projectId: "noteapp-50e81",
  storageBucket: "noteapp-50e81.firebasestorage.app",
  messagingSenderId: "799063588495",
  appId: "1:799063588495:web:4e687a40655ef7e92cbafa",
  measurementId: "G-X9L3PVK2KY"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app)
