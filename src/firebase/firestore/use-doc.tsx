'use client';
import { useState, useEffect } from 'react';
import { onSnapshot, doc, type DocumentSnapshot, type FirestoreError } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useMemoFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toDateSafe } from '@/lib/utils';

/** Campos que siempre deben convertirse a Date (jugadores importados/migrados pueden tener { seconds, nanoseconds }). */
const DATE_FIELDS = ['birthDate', 'createdAt', 'submittedAt', 'archivedAt', 'uploadedAt', 'approvedAt', 'rejectedAt'];

// Helper to convert Firestore Timestamps to JS Dates
function processDoc<T>(docSnap: DocumentSnapshot): T {
    const raw = docSnap.data() ?? {};
    const data = { ...raw };
    for (const key in data) {
        const val = data[key];
        if (val && typeof val.toDate === 'function') {
            data[key] = val.toDate();
        } else if (DATE_FIELDS.includes(key) && val && typeof val === 'object' && 'seconds' in val) {
            data[key] = toDateSafe(val);
        }
    }
    return { id: docSnap.id, ...data } as T;
}


export function useDoc<T extends { id: string }>(path: string) {
    const firestore = useFirestore();
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<FirestoreError | null>(null);
    
    const docRef = useMemoFirebase(() => {
        if (!path) return null;
        return doc(firestore, path);
    }, [firestore, path]);

    useEffect(() => {
        if (!docRef) {
            setLoading(false);
            return;
        }
        const unsubscribe = onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
                setData(processDoc<T>(snapshot));
            } else {
                setData(null);
            }
            setError(null);
            setLoading(false);
        }, (err: FirestoreError) => {
            const permissionError = new FirestorePermissionError({
                path: path,
                operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
            setError(err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [docRef, path]);

    return { data, loading, error };
}
