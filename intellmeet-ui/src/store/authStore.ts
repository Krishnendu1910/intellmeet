import { create } from 'zustand';

interface User {
  _id?: string;
  name?: string;
  username?: string;
  firstName?: string;
  email?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void; 
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user)); 
    set({ token, user });
  },
  
  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
}));