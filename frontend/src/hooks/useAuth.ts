'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string | null;
}

interface AuthResponse {
  user: User;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string, captcha: string, captchaId: string) => Promise<void>;
  register: (email: string, password: string, name: string, captcha: string, captchaId: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user, isLoading: false }),

  login: async (email, password, captcha, captchaId) => {
    const data = await api.post<AuthResponse>('/auth/login', { email, password, captcha, captchaId });
    set({ user: data.user });
  },

  register: async (email, password, name, captcha, captchaId) => {
    const data = await api.post<AuthResponse>('/auth/register', { email, password, name, captcha, captchaId });
    set({ user: data.user });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // 即使登出接口失败也清除本地状态
    }
    set({ user: null });
  },

  fetchUser: async () => {
    try {
      const data = await api.get<AuthResponse>('/auth/me');
      set({ user: data.user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },
}));
