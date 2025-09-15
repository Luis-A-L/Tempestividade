
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAzgd2Zt-giAcns0sh1xzTP506vhW7AiDo", // IMPORTANT: Use environment variables in a real project
  authDomain: "djen-4a2fb.firebaseapp.com",
  projectId: "djen-4a2fb",
  storageBucket: "djen-4a2fb.appspot.com",
  messagingSenderId: "928977146281",
  appId: "1:928977146281:web:42f206788ec1d68c2b34b8",
  measurementId: "G-LM8T5WZXNX"
};

const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
