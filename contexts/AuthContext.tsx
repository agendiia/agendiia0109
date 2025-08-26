
import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { auth, db } from '@/services/firebase';
import {
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

type SubscriptionPlanName = 'Profissional' | 'Avançado';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  plan: SubscriptionPlanName;
  setPlan: (plan: SubscriptionPlanName) => void;
  hasAccess: (featureKey: string) => boolean;
  // Auth API
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerification: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

// Define feature access rules based on the user's final table
const featureAccessConfig: { [key: string]: SubscriptionPlanName[] } = {
  // Views
  'reports.view': ['Avançado'],
  'marketing.view': ['Avançado'],

  // Specific Features within views
  'finance.forecast': ['Avançado'],
  'finance.strategies': ['Avançado'],
  'dashboard.ai_chat': ['Avançado'],
  'dashboard.action_center': ['Avançado'], // "Central de Ações"
  'automations.advanced': ['Avançado'], // Automações Avançadas (SMS, Workflows)
  
  // Implicitly, all other views are available to 'Profissional'
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlanState] = useState<SubscriptionPlanName>('Profissional');

  // Persist and observe auth state
  useEffect(() => {
    let unsubscribe = () => {};
    setPersistence(auth, browserLocalPersistence)
      .catch(() => {})
      .finally(() => {
        unsubscribe = onAuthStateChanged(auth, async (u) => {
          setUser(u);
          if (u) {
            // Load or initialize the user's Firestore profile and plan
            try {
              const ref = doc(db, 'users', u.uid);
              const snap = await getDoc(ref);

              if (!snap.exists()) {
                // First time sign-in (likely Google sign-up): create a minimal profile
                try {
                  await setDoc(ref, {
                    email: u.email ?? '',
                    name: u.displayName ?? '',
                    plan: 'Profissional',
                    createdAt: new Date().toISOString(),
                    lastLoginAt: new Date().toISOString(),
                    emailVerified: u.emailVerified,
                  }, { merge: true });
                  setPlanState('Profissional');
                } catch (err) {
                  // fallback to default plan in-memory
                  setPlanState('Profissional');
                }
              } else {
                const data = snap.data() as any;
                const planFromDb = data?.plan as SubscriptionPlanName | undefined;
                setPlanState(planFromDb ?? 'Profissional');

                // Ensure createdAt exists for older/google accounts so subscription UI can compute trials
                try {
                  if (!data?.createdAt) {
                    await setDoc(ref, { createdAt: new Date().toISOString() }, { merge: true });
                  }
                  // Update lastLoginAt and email verification flag
                  await setDoc(ref, { lastLoginAt: new Date().toISOString(), emailVerified: u.emailVerified, email: u.email ?? '', name: u.displayName ?? '' }, { merge: true });
                } catch (err) {
                  // ignore write errors
                }
              }
            } catch (e) {
              setPlanState('Profissional');
            }
          } else {
            setPlanState('Profissional');
          }
          setLoading(false);
        });
      });
    return () => unsubscribe();
  }, []);

  const setPlan = async (newPlan: SubscriptionPlanName) => {
    setPlanState(newPlan);
    if (user) {
      const ref = doc(db, 'users', user.uid);
      // Ensure doc exists and update plan
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, { plan: newPlan, email: user.email ?? '', name: user.displayName ?? '' }, { merge: true });
        } else {
          await updateDoc(ref, { plan: newPlan });
        }
      } catch {
        // ignore write failure in UI, state already updated; handle elsewhere if needed
      }
    }
  };

  const hasAccess = (featureKey: string): boolean => {
    const requiredPlans = featureAccessConfig[featureKey];
    if (!requiredPlans) return true;
    return requiredPlans.includes(plan);
  };

  // Auth methods
  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      try { await updateProfile(cred.user, { displayName: name }); } catch {}
    }
    try {
      await setDoc(doc(db, 'users', cred.user.uid), {
        name,
        email,
        plan: 'Profissional',
        createdAt: new Date().toISOString(),
      }, { merge: true });
    } catch {}
  // Best practice: enviar email de verificação após cadastro
  try { await sendEmailVerification(cred.user); } catch {}
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    // Ensure minimal user doc exists immediately after popup sign-in
    try {
      const u = cred.user;
      const ref = doc(db, 'users', u.uid);
      await setDoc(ref, {
        email: u.email ?? '',
        name: u.displayName ?? '',
        plan: 'Profissional',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        emailVerified: u.emailVerified,
      }, { merge: true });
    } catch (err) {
      // ignore
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const sendVerification = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  const reloadUser = async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    setUser(auth.currentUser);
  };

  const value = useMemo<AuthContextType>(() => ({
    user,
    loading,
    plan,
    setPlan,
    hasAccess,
    login,
    register,
    loginWithGoogle,
    logout,
  resetPassword,
  sendVerification,
  reloadUser,
  }), [user, loading, plan]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
