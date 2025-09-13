
import './src/polyfills/buffer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './AdminApp';
// Initialize Firebase once on startup
import './services/firebase';
import { initGA } from './src/services/analytics';
import PublicBookingPage from './components/PublicBookingPage';
import PublicPaymentPage from './components/PublicPaymentPage';
import TestimonialForm from './components/TestimonialForm';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import { AuthProvider } from './contexts/AuthContext';
import ApplyCorsPage from './components/ApplyCorsPage';

initGA();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const path = window.location.pathname;

let componentToRender;

// Simple router
// Special-case: Firebase Auth action handler path. When users click the verification
// link Firebase may land them on /__/auth/action with query params (mode, oobCode).
// Detect that and attempt to apply the action code, then redirect to /login.
if (path.startsWith('/__/auth/action')) {
  (async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const oobCode = params.get('oobCode');
      if (mode === 'verifyEmail' && oobCode) {
        // dynamic import to avoid top-level firebase/auth import duplication
        const [{ applyActionCode }, { auth }] = await Promise.all([
          import('firebase/auth'),
          import('./services/firebase')
        ]);
        try {
          await applyActionCode(auth, oobCode);
        } catch (err) {
          // ignore error; we'll still redirect to login so user can sign in or retry
        }
      }
    } catch (e) {
      // ignore
    } finally {
      try { window.location.replace('/login'); } catch { window.location.href = '/login'; }
    }
  })();
  // short-circuit rendering; the page will redirect shortly
  componentToRender = <div />;
}
if (path.startsWith('/admin')) {
    componentToRender = (
      <AuthProvider>
        <AdminApp />
      </AuthProvider>
    );
} else if (path.startsWith('/main')) {
    componentToRender = (
      <AuthProvider>
        <App />
      </AuthProvider>
    );
} else if ([
    '/appointments',
    '/clients',
    '/marketing',
    '/services',
    '/finance',
    '/availability',
    '/profile',
    '/subscription',
    '/reports',
    '/help-center',
    '/settings',
    '/dashboard'
].some(prefix => path.startsWith(prefix))) {
    // Treat these internal app routes as part of the main App so refresh keeps the AuthProvider mounted
    componentToRender = (
      <AuthProvider>
        <App />
      </AuthProvider>
    );
} else if (path.startsWith('/login')) {
    componentToRender = (
      <AuthProvider>
        <AuthPage />
      </AuthProvider>
    );
} else if (path.startsWith('/booking/payment')) {
    componentToRender = (
      <AuthProvider>
        <PublicPaymentPage />
      </AuthProvider>
    );
} else if (path.startsWith('/booking')) {
    // In a real app, you might extract an ID like /booking/professional-id
    componentToRender = (
      <AuthProvider>
        <PublicBookingPage />
      </AuthProvider>
    );
} else if (path.startsWith('/testimonial')) {
    // In a real app, you might extract an ID like /testimonial/professional-id
    componentToRender = <TestimonialForm />;
} else if (path.startsWith('/apply-cors')) {
  componentToRender = <ApplyCorsPage />;
} else {
  // Default route is now the landing page
  componentToRender = <LandingPage />;
}

root.render(
  <React.StrictMode>
    {componentToRender}
  </React.StrictMode>
);
