import { FirebaseOptions, initializeApp, getApps } from 'firebase/app';

// Your web app's Firebase configuration
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyA7Ea1vR2OuaRCZeooGxjl_jN07Jsfks3E",
  authDomain: "lexflow-consultas.firebaseapp.com",
  projectId: "lexflow-consultas",
  storageBucket: "lexflow-consultas.firebasestorage.app",
  messagingSenderId: "664196918383",
  appId: "1:664196918383:web:87f78b39b51e595afdf19a"
};

function initializeFirebase() {
    if (getApps().length > 0) {
        return getApps()[0];
    }
    return initializeApp(firebaseConfig);
}

export { initializeFirebase, firebaseConfig };
