import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getFirebaseAuth, getGoogleProvider, isFirebaseConfigured } from '../services/firebase';

const AuthContext = createContext(null);

// ── Mock Auth (when Firebase isn't configured) ──────────────────────────
const MOCK_USERS_KEY = 'gangamaxx_mock_users';
const MOCK_SESSION_KEY = 'gangamaxx_mock_session';

function getMockUsers() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || '{}');
  } catch { return {}; }
}

function saveMockUsers(users) {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

function getMockSession() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_SESSION_KEY) || 'null');
  } catch { return null; }
}

function setMockSession(user) {
  if (user) {
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(MOCK_SESSION_KEY);
  }
}

// ── Auth Provider ───────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firebaseAvailable, setFirebaseAvailable] = useState(false);

  useEffect(() => {
    const fbAvailable = isFirebaseConfigured();
    setFirebaseAvailable(fbAvailable);

    if (fbAvailable) {
      const auth = getFirebaseAuth();
      if (auth) {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            setUser({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email,
              phoneNumber: firebaseUser.phoneNumber || '',
              photoURL: firebaseUser.photoURL,
              emailVerified: firebaseUser.emailVerified,
              provider: firebaseUser.providerData?.[0]?.providerId || 'password',
            });
          } else {
            setUser(null);
          }
          setLoading(false);
        });
        return () => unsubscribe();
      }
    }

    // Fallback: check mock session
    const sessionUser = getMockSession();
    if (sessionUser) setUser(sessionUser);
    setLoading(false);
  }, []);

  const signUp = useCallback(async (email, password, displayName, profile = {}) => {
    if (firebaseAvailable) {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase auth not initialized');
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    }

    // Mock fallback
    const users = getMockUsers();
    if (users[email]) throw new Error('An account with this email already exists');
    const newUser = {
      uid: 'mock_' + Date.now(),
      displayName: displayName || email.split('@')[0],
      email,
      phoneNumber: profile.phone || '',
      age: profile.age || null,
      gender: profile.gender || '',
      photoURL: null,
      emailVerified: false,
      provider: 'password',
      createdAt: new Date().toISOString(),
    };
    users[email] = { password, user: newUser };
    saveMockUsers(users);
    setMockSession(newUser);
    setUser(newUser);
    return newUser;
  }, [firebaseAvailable]);

  const signIn = useCallback(async (email, password) => {
    if (firebaseAvailable) {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase auth not initialized');
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    }

    // Mock fallback
    const users = getMockUsers();
    const record = users[email];
    if (!record || record.password !== password) throw new Error('Invalid email or password');
    setMockSession(record.user);
    setUser(record.user);
    return record.user;
  }, [firebaseAvailable]);

  const signInWithGoogle = useCallback(async () => {
    if (firebaseAvailable) {
      const auth = getFirebaseAuth();
      const provider = getGoogleProvider();
      if (!auth || !provider) throw new Error('Firebase auth not initialized');
      const result = await signInWithPopup(auth, provider);
      return result.user;
    }
    throw new Error('Firebase is not configured. Please set up Firebase to use Google sign-in.');
  }, [firebaseAvailable]);

  const logout = useCallback(async () => {
    if (firebaseAvailable) {
      const auth = getFirebaseAuth();
      if (auth) await signOut(auth);
    }
    setMockSession(null);
    setUser(null);
  }, [firebaseAvailable]);

  const updateProfile = useCallback((updates) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    setMockSession(updated);
  }, [user]);

  const value = {
    user,
    loading,
    firebaseAvailable,
    signUp,
    signIn,
    signInWithGoogle,
    logout,
    updateProfile,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
