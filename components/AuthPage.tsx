import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from './Icons';
import { useAuth } from '@/contexts/AuthContext';

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:ring-indigo-300 bg-white text-gray-800 ${props.className ?? ''}`}
  />
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <button
    {...props}
    className={`w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring focus:ring-indigo-300 disabled:opacity-60 ${props.className ?? ''}`}
  >
    {children}
  </button>
);

const AuthPage: React.FC = () => {
  const { login, register, loginWithGoogle, resetPassword, user } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pick initial mode from query param (?signup=1)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if ((params.get('signup') || '').toString() === '1') {
        setIsRegister(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // If already authenticated, go straight to the app (preserve /admin)
  // Avoid automatic redirect when auth state changes (prevents clients from
  // being silently sent to the professional/admin app). Instead show a small
  // notice and let the user explicitly continue to the panel.
  const [alreadyLoggedInNotice, setAlreadyLoggedInNotice] = useState(false);
  useEffect(() => {
    if (user) setAlreadyLoggedInNotice(true);
  }, [user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isRegister) {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
  // On success, go to the appropriate panel
  const target = window.location.pathname.startsWith('/admin') ? '/admin' : '/main';
  window.location.href = target;
    } catch (err: any) {
      setError(err?.message ?? 'Falha na autenticação');
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await loginWithGoogle();
  {
    const target = window.location.pathname.startsWith('/admin') ? '/admin' : '/main';
    window.location.href = target;
  }
    } catch (err: any) {
      setError(err?.message ?? 'Falha no Google Login');
    } finally {
      setSubmitting(false);
    }
  };

  const onResetPassword = async () => {
    if (!email) return;
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(email);
      setError('Enviamos um link de redefinição para seu email.');
    } catch (err: any) {
      setError(err?.message ?? 'Falha ao enviar o email de redefinição');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-800 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-1 text-center">Agendiia</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">{isRegister ? 'Crie sua conta' : 'Entre na sua conta'}</p>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        {alreadyLoggedInNotice && (
          <div className="mb-4 p-3 rounded bg-green-50 text-green-700 text-sm">
            Você já está autenticado.{' '}
            <button
              onClick={() => {
                const target = window.location.pathname.startsWith('/admin') ? '/admin' : '/main';
                window.location.href = target;
              }}
              className="text-indigo-600 hover:underline ml-2"
            >
              Ir para o painel
            </button>
            <button
              onClick={async () => { try { await (await import('@/contexts/AuthContext')).useAuth().logout(); } catch {} }}
              className="ml-4 text-sm text-gray-600 hover:underline"
            >
              Sair
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          {isRegister && (
            <div>
              <label className="block text-sm mb-1">Nome</label>
              <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="block text-sm mb-1">Email</label>
            <Input type="email" placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm mb-1">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:ring-indigo-300 bg-white text-gray-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={submitting}>{isRegister ? 'Cadastrar' : 'Entrar'}</Button>
        </form>

        {!isRegister && (
          <div className="mt-2 text-right">
            <button disabled={submitting} onClick={onResetPassword} className="text-xs text-indigo-600 hover:underline">Esqueci minha senha</button>
          </div>
        )}

        <div className="my-4 flex items-center gap-2">
          <div className="h-px bg-gray-200 flex-1" />
          <span className="text-xs text-gray-400">ou</span>
          <div className="h-px bg-gray-200 flex-1" />
        </div>

  <Button onClick={onGoogle} disabled={submitting} className="bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 !bg-white !text-gray-800">
          <span className="inline-flex items-center gap-2 justify-center">
            <img alt="Google" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" />
            Entrar com Google
          </span>
        </Button>

        <p className="text-sm text-center text-gray-600 mt-4">
          {isRegister ? 'Já tem conta?' : 'Novo por aqui?'}{' '}
          <button className="text-indigo-600 hover:underline" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? 'Entrar' : 'Criar conta'}
          </button>
        </p>

        <p className="text-xs text-gray-400 text-center mt-6">Ao continuar, você concorda com nossos Termos e Política de Privacidade.</p>
      </div>
    </div>
  );
};

export default AuthPage;
