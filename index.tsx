
import './src/polyfills/buffer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './AdminApp';
// Initialize Firebase once on startup
import './services/firebase';
import PublicBookingPage from './components/PublicBookingPage';
import PublicPaymentPage from './components/PublicPaymentPage';
import TestimonialForm from './components/TestimonialForm';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import { AuthProvider } from './contexts/AuthContext';
import ApplyCorsPage from './components/ApplyCorsPage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const path = window.location.pathname;

let componentToRender;

// Simple router
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
