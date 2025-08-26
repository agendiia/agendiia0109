import React, { useEffect, useState } from 'react';
import AdminPanel from './components/AdminPanel';
import AuthPage from './components/AuthPage';
import VerifyEmail from './components/VerifyEmail';
import { useAuth } from './contexts/AuthContext';
import { db } from './services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AdminApp: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setAllowed(null);
        return;
      }
      try {
        const FALLBACK_ADMINS = ['admin@agendiia.com.br', 'contato@agendiia.com.br'];
        const settingsRef = doc(db, 'platform', 'settings');
        const docSnap = await getDoc(settingsRef);
        let emails: string[] = [];
        if (docSnap.exists()) {
          const settingsData = docSnap.data();
          emails = Array.isArray(settingsData.adminEmails) ? settingsData.adminEmails : [];
        } else {
          // create settings doc with fallback admins so platform is manageable
          await setDoc(settingsRef, { adminEmails: FALLBACK_ADMINS, createdAt: new Date().toISOString() }, { merge: true });
          emails = FALLBACK_ADMINS;
        }
        if (emails.length === 0) emails = FALLBACK_ADMINS; // ensure at least fallback
        const userEmail = (user.email || '').toLowerCase();
        const normalizedEmails = emails.map(e => (typeof e === 'string' ? e.toLowerCase() : '')).filter(Boolean);
        setAllowed(normalizedEmails.includes(userEmail));
      } catch (e) {
        console.error('Erro ao verificar acesso de administrador:', e);
        setAllowed(false);
      }
    };
    checkAccess();
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        <div className="animate-pulse text-sm text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!user.emailVerified) {
    return <VerifyEmail />;
  }

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        <div className="animate-pulse text-sm text-gray-500">Verificando acesso…</div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center space-y-4">
          <h1 className="text-xl font-bold">Acesso restrito</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Sua conta não está autorizada a acessar o painel do administrador da plataforma.</p>
          <button onClick={() => logout()} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 flex flex-col">
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h1 className="text-lg font-bold">Admin da Plataforma</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm">{user.email}</span>
          <button 
            onClick={() => logout()} 
            className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Sair
          </button>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <AdminPanel />
      </div>
    </div>
  );
};

export default AdminApp;
