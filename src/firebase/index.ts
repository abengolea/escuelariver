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
import { getStorage, FirebaseStorage } from 'firebase/storage';

import { initializeFirebase } from './config';
import { FirebaseApp } from 'firebase/app';

export * from './provider';
export * from './auth/use-user';
export * from './auth/use-user-profile';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './error-emitter';
export * from './errors';


let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let storage: FirebaseStorage;

function getFirebase() {
  if (!app) {
    app = initializeFirebase();
    auth = getAuth(app);
    firestore = getFirestore(app);
    storage = getStorage(app);
  }
  return { app, auth, firestore, storage };
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
