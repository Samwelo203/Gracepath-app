import { createContext, useContext, useState, useEffect } from 'react';
import { getUser, saveAuth, clearAuth, isAuthenticated } from '../lib/auth';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (!isAuthenticated()) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/api/auth/me');
        setUser(data);
        localStorage.setItem('gpc_user', JSON.stringify(data));
      } catch {
        clearAuth();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, []);

  async function login(username, password) {
    const { data } = await api.post('/api/auth/login', { username, password });
    saveAuth(data.access_token, data.user);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearAuth();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}