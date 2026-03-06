'use client';
import { useState, useEffect } from 'react';
import { onSnapshot, collection, query, where, type Query, type QueryDocumentSnapshot, orderBy, limit, type FirestoreError, type DocumentData } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useMemoFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toDateSafe } from '@/lib/utils';

/** Campos que siempre deben convertirse a Date (jugadores importados/migrados pueden tener { seconds, nanoseconds }). */
const DATE_FIELDS = ['birthDate', 'createdAt', 'submittedAt', 'archivedAt', 'uploadedAt', 'approvedAt', 'rejectedAt'];

// Helper to convert Firestore Timestamps to JS Dates
function processDoc<T>(docSnap: QueryDocumentSnapshot): T {
    const raw = docSnap.data();
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

export function useCollection<T extends { id: string }>(
    path: string, 
    options?: {
        where?: [string, any, any];
        orderBy?: [string, 'asc' | 'desc'];
        limit?: number;
    }
) {
    const firestore = useFirestore();
    const [data, setData] = useState<T[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<FirestoreError | null>(null);

    const collectionQuery = useMemoFirebase(() => {
        if (!path) return null;
        let q: Query<DocumentData> = collection(firestore, path);
        if (options?.where) {
            q = query(q, where(...options.where));
        }
        if (options?.orderBy) {
            q = query(q, orderBy(...options.orderBy));
        }
        if (options?.limit) {
            q = query(q, limit(options.limit));
        }
        return q;
    }, [firestore, path, JSON.stringify(options)]);


    useEffect(() => {
        if (!collectionQuery) {
            setLoading(false);
            return;
        }
        const unsubscribe = onSnapshot(collectionQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => processDoc<T>(doc));
            setData(data);
            setError(null);
            setLoading(false);
        }, (err: FirestoreError) => {
            const permissionError = new FirestorePermissionError({
                path: path,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            setError(err); 
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionQuery, path]);

    return { data, loading, error };
}
