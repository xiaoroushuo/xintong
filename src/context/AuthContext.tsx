import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole } from '../lib/types';
import { supabase } from '../lib/supabase';

interface AuthState {
  role: UserRole;
  isLoggedIn: boolean;
  userName: string;
}

interface AuthContextType extends AuthState {
  login: (role: UserRole, name: string) => void;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'erp_auth_role';
const NAME_KEY = 'erp_auth_name';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const savedRole = localStorage.getItem(STORAGE_KEY) as UserRole | null;
    const savedName = localStorage.getItem(NAME_KEY) || '';
    return {
      role: savedRole || 'employee',
      isLoggedIn: !!savedRole,
      userName: savedName,
    };
  });

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {});
    return () => data.subscription.unsubscribe();
  }, []);

  const login = (role: UserRole, name: string) => {
    localStorage.setItem(STORAGE_KEY, role);
    localStorage.setItem(NAME_KEY, name);
    setState({ role, isLoggedIn: true, userName: name });
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NAME_KEY);
    setState({ role: 'employee', isLoggedIn: false, userName: '' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isAdmin: state.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
