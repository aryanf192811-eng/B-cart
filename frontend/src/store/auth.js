import { create } from 'zustand';
import { api } from '../api/client';
import { E } from '../api/endpoints';

const MOCK_USER = {
  _id: 'mock_123',
  name: 'Demo Admin',
  role: 'Admin',
  email: 'admin@bcard.local',
  module_access: []
};

export const useAuth = create((set, get) => ({
  user: null,
  loading: true,
  bootstrap: async () => {
    // Temporary mock to bypass backend
    set({ user: MOCK_USER, loading: false });
  },
  login: async (login_id, password) => {
    // Temporary mock to bypass backend
    set({ user: MOCK_USER });
  },
  signup: async (payload) => {
    // Temporary mock to bypass backend
    return Promise.resolve();
  },
  logout: async () => { 
    set({ user: null }); 
  },
  hasAccess: (module, requiredLevel='user') => {
    const u = get().user;
    if (!u) return false;
    if (u.role === 'Admin') return true;
    const row = u.module_access?.find(m => m.module === module);
    if (!row || row.access_level === 'none') return false;
    if (requiredLevel === 'admin') return row.access_level === 'admin';
    return true;
  }
}));
