import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const VerifyEmail: React.FC = () => {
  const { user, sendVerification, logout } = useAuth();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const onResend = async () => {
    setBusy(true);
    setInfo(null);
    setError(null);
    try {
      await sendVerification();
      setInfo('Email de verificação enviado. Verifique sua caixa de entrada.');
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível enviar o email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-800 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-2 text-center">Verifique seu email</h1>
        <p className="text-sm text-gray-600 mb-4 text-center">
          Enviamos um link de verificação para <strong>{user.email}</strong>. Após confirmar, atualize a página ou faça login novamente.
        </p>

        {info && <div className="mb-3 p-3 rounded bg-green-50 text-green-700 text-sm">{info}</div>}
        {error && <div className="mb-3 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}

        <div className="space-y-2">
          <button disabled={busy} onClick={onResend} className="w-full py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60">Reenviar email</button>
          <button disabled={busy} onClick={() => logout()} className="w-full py-2 px-4 bg-white border rounded hover:bg-gray-50 disabled:opacity-60">Sair</button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
