import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';

export default function useSubscriptionState() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setData(snap.exists() ? snap.data() : null);
      setLoading(false);
    }, (err) => {
      console.warn('useSubscriptionState snapshot error', err);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const now = new Date();
  const subscription = data?.subscription || null;
  const subscriptionStatus = data?.subscriptionStatus || (subscription?.status ?? null);
  const trialEndsAtRaw = data?.trialEndsAt ?? null;
  const trialEndsAt = trialEndsAtRaw ? (trialEndsAtRaw.toDate ? trialEndsAtRaw.toDate() : new Date(trialEndsAtRaw)) : null;
  // Determine limited mode: no active subscription, no active subscriptionStatus, and trial expired or absent
  let isLimited = true;
  try {
    if (subscription && (subscription.status === 'active' || subscription.status === 'Ativa')) isLimited = false;
    else if (subscriptionStatus && (String(subscriptionStatus).toLowerCase() === 'ativo' || String(subscriptionStatus).toLowerCase() === 'active')) isLimited = false;
    else if (trialEndsAt && trialEndsAt > now) isLimited = false;
    else isLimited = true;
  } catch (e) {
    isLimited = true;
  }

  return {
    loading,
    data,
    subscription,
    subscriptionStatus,
    trialEndsAt,
    isLimited,
    plan: data?.plan || null,
  } as const;
}
