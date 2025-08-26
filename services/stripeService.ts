// Stripe service for payment processing
import { loadStripe, Stripe } from '@stripe/stripe-js';

// Stripe publishable key - should be set in environment variables
const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// Initialize Stripe
let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    if (!STRIPE_PUBLIC_KEY) {
      // Stripe not configured - fail silently in production
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(STRIPE_PUBLIC_KEY);
  }
  return stripePromise;
};

// Stripe Payment Links for subscription plans
export const STRIPE_PAYMENT_LINKS = {
  prof_monthly: import.meta.env.VITE_STRIPE_PROF_MONTHLY_LINK || '',
  adv_monthly: import.meta.env.VITE_STRIPE_ADV_MONTHLY_LINK || '',
} as const;

// Redirect to Stripe Payment Link
export const redirectToStripePayment = (planId: keyof typeof STRIPE_PAYMENT_LINKS, userId?: string) => {
  const paymentLink = STRIPE_PAYMENT_LINKS[planId];
  
  if (!paymentLink) {
    // Payment link not configured - show user-friendly message
    alert('Link de pagamento não configurado para este plano. Entre em contato com o suporte.');
    return;
  }

  // Add customer reference if userId is provided
  const url = userId 
    ? `${paymentLink}?client_reference_id=${encodeURIComponent(userId)}`
    : paymentLink;

  // Redirect to Stripe Payment Link
  window.open(url, '_blank');
};

// Check if Stripe is properly configured
export const isStripeConfigured = () => {
  return Boolean(STRIPE_PUBLIC_KEY) && 
         Boolean(STRIPE_PAYMENT_LINKS.prof_monthly) && 
         Boolean(STRIPE_PAYMENT_LINKS.adv_monthly);
};

export default {
  getStripe,
  STRIPE_PAYMENT_LINKS,
  redirectToStripePayment,
  isStripeConfigured,
};
