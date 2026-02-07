'use client';
import { useMemo } from 'react';
import {
  getAuth,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
} from 'firebase/firestore';

import { initializeFirebase, firebaseConfig } from './config';
import { FirebaseApp } from 'firebase/app';

export * from './provider';
export * from './auth/use-user';


let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

function getFirebase() {
  if (!app) {
    if (!firebaseConfig.apiKey) {
      throw new Error('Firebase config is not initialized');
    }
    app = initializeFirebase();
    auth = getAuth(app);
    firestore = getFirestore(app);
  }
  return { app, auth, firestore };
}

function useFirebase() {
  return useMemo(() => getFirebase(), []);
}

function useMemoFirebase<T>(
  factory: () => T,
  deps: React.DependencyList | undefined
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo<T>(factory, deps);
}

export { useFirebase, useMemoFirebase };
