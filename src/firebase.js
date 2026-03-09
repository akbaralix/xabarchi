import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB9UrFvaWY_a4UuDtobVT22u2l2rjMygvM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "xabarchix.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "xabarchix",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "xabarchix.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "897631891489",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:897631891489:web:ef376233d80c36f5347360",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-N6PK50DWE7",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
