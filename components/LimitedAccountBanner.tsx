import React from 'react';
import useSubscriptionState from '@/hooks/useSubscriptionState';
import { Link } from 'react-router-dom';

export default function LimitedAccountBanner() {
  const { loading, isLimited } = useSubscriptionState();
  if (loading || !isLimited) return null;

  return (
    <div className="w-full bg-red-50 border-l-4 border-red-400 text-red-700 p-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div>
          <strong className="font-semibold">Sua conta está no modo gratuito limitado.</strong>
          <div className="text-sm">Depois do período grátis você perde acesso a criação de novos agendamentos. Escolha um plano para continuar usando todos os recursos.</div>
        </div>
        <div>
          <Link to="/subscription" className="bg-red-600 text-white px-3 py-2 rounded-md text-sm">Escolher um plano</Link>
        </div>
      </div>
    </div>
  );
}
