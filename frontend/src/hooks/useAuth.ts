'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user, isLoading: false }),

  login: async (email, password) => {
    const user = await api.post<User>('/auth/login', { email, password });
    set({ user });
  },

  register: async (email, password, name) => {
    const user = await api.post<User>('/auth/register', { email, password, name });
    set({ user });
  },

  logout: async () => {
    await api.post('/auth/logout');
    set({ user: null });
  },

  fetchUser: async () => {
    try {
      const user = await api.get<User>('/auth/me');
      set({ user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },
}));
