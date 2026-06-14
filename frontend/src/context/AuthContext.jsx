import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount via JWT cookie
  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const res = await api.getMe();
        if (!cancelled && res.authenticated && res.data) {
          setUser(res.data);
        }
      } catch {
        // Not authenticated — that's okay
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    checkSession();
    return () => { cancelled = true; };
  }, []);

  const signUp = useCallback(async (email, password, displayName, profile = {}) => {
    const res = await api.signup({ email, password, displayName, ...profile });
    if (res.success && res.data) {
      setUser(res.data);
      return res.data;
    }
    throw new Error(res.error || 'Signup failed');
  }, []);

  const signIn = useCallback(async (email, password) => {
    const res = await api.login({ email, password });
    if (res.success && res.data) {
      setUser(res.data);
      return res.data;
    }
    throw new Error(res.error || 'Invalid email or password');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Even if the request fails, clear local state
    }
    setUser(null);
  }, []);

  const updateProfile = useCallback((updates) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
  }, [user]);

  const value = {
    user,
    loading,
    signUp,
    signIn,
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
