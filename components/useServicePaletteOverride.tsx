import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';

// Returns [overrides, setOverride, clearOverride, isLoading]
export default function useServicePaletteOverride() {
    const { user } = useAuth();
    const [overrides, setOverrides] = useState<Record<string, number> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setOverrides(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const docRef = doc(db, 'users', user.uid, 'ui', 'servicePalette');
        const unsub = onSnapshot(docRef, (snap) => {
            if (!snap.exists()) {
                setOverrides({});
                setIsLoading(false);
                return;
            }
            const data = snap.data() || {};
            setOverrides(data as Record<string, number>);
            setIsLoading(false);
        }, (err) => {
            console.warn('Failed to load palette overrides', err);
            setOverrides({});
            setIsLoading(false);
        });

        return () => unsub();
    }, [user?.uid]);

    const setOverride = useCallback(async (serviceId: string, paletteIndex: number) => {
        if (!user) return;
        const docRef = doc(db, 'users', user.uid, 'ui', 'servicePalette');
        try {
            const newVal = { ...(overrides || {}), [serviceId]: paletteIndex };
            await setDoc(docRef, newVal, { merge: true });
        } catch (e) {
            console.error('Failed to save palette override', e);
        }
    }, [user?.uid, overrides]);

    const clearOverride = useCallback(async (serviceId: string) => {
        if (!user) return;
        const docRef = doc(db, 'users', user.uid, 'ui', 'servicePalette');
        try {
            // set to null to remove key; Firestore merge will keep other keys
            const copy = { ...(overrides || {}) } as Record<string, any>;
            if (serviceId in copy) delete copy[serviceId];
            await setDoc(docRef, copy, { merge: true });
        } catch (e) {
            console.error('Failed to clear palette override', e);
        }
    }, [user?.uid, overrides]);

    return { overrides: overrides || {}, setOverride, clearOverride, isLoading };
}
