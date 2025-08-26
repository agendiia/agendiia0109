import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useNavigate } from 'react-router-dom';

const isTodayInSaoPaulo = (d: Date | null) => {
  if (!d) return false;
  try {
    const s = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    return s === today;
  } catch {
    return false;
  }
};

const TrialEndingBanner: React.FC = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return setLoading(false);
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) return setLoading(false);
        const data: any = snap.data();
        const trialEndsAtRaw = data?.trialEndsAt || data?.trialEndsAt?.toDate ? (data.trialEndsAt?.toDate ? data.trialEndsAt.toDate() : new Date(data.trialEndsAt)) : null;
        const trialEndsAt = trialEndsAtRaw ? (trialEndsAtRaw instanceof Date ? trialEndsAtRaw : new Date(trialEndsAtRaw)) : null;
        if (isTodayInSaoPaulo(trialEndsAt)) {
          if (mounted) setShow(true);
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  if (loading || !show) return null;

  return (
    <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <strong>Seu teste gratuito termina hoje.</strong>
          <div className="text-sm">Escolha um plano para não perder seus agendamentos.</div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate('/subscription')}
            className="bg-yellow-600 text-white px-3 py-1 rounded text-sm"
          >
            Escolher plano
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialEndingBanner;
