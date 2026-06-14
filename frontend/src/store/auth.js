import { create } from 'zustand';
import { api } from '../api/client';
import { E } from '../api/endpoints';

// Transform the module_access array from the backend into a key→level map
// e.g. [{module:'Sales', access_level:'admin'}] → {Sales:'admin', ...}
function buildAccessMap(moduleAccessArray) {
  if (!Array.isArray(moduleAccessArray)) return {};
  return moduleAccessArray.reduce((acc, row) => {
    acc[row.module] = row.access_level;
    return acc;
  }, {});
}

export const useAuth = create((set, get) => ({
  user: null,
  loading: true,

  bootstrap: async () => {
    try {
      const res = await api.get(E.me());
      const user = res.data.user;
      // Normalize: add access_map for easy hasAccess lookups
      user.access_map = buildAccessMap(user.module_access);
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (login_id, password) => {
    const res = await api.post(E.login(), { login_id, password });
    const user = res.data.user;
    // After login the /me endpoint is called by bootstrap; but set basics now
    user.access_map = buildAccessMap(user.module_access);
    set({ user });
    return res.data;
  },

  signup: async (payload) => {
    const res = await api.post(E.signup(), payload);
    return res.data;
  },

  verifyOtp: async (login_id, otp_code) => {
    const res = await api.post('/auth/verify-otp', { login_id, otp_code });
    const user = res.data.user;
    user.access_map = buildAccessMap(user.module_access);
    set({ user });
    return res.data;
  },

  resendOtp: async (login_id) => {
    const res = await api.post('/auth/resend-otp', { login_id });
    return res.data;
  },

  logout: async () => {
    try {
      await api.post(E.logout());
    } finally {
      set({ user: null });
      window.location.href = '/login';
    }
  },

  // Refresh user data from server (e.g., after profile update)
  refreshUser: async () => {
    try {
      const res = await api.get(E.me());
      const user = res.data.user;
      user.access_map = buildAccessMap(user.module_access);
      set({ user });
    } catch {
      // ignore
    }
  },

  /**
   * hasAccess(module, requiredLevel)
   * - Admin role (role_id=1) always passes
   * - requiredLevel 'user': access_level must be 'admin' or 'user'
   * - requiredLevel 'admin': access_level must be 'admin'
   */
  hasAccess: (module, requiredLevel = 'user') => {
    const u = get().user;
    if (!u) return false;
    // Admin role bypasses all checks
    if (u.role === 'Admin' || u.role_id === 1) return true;
    const level = u.access_map?.[module];
    if (!level || level === 'none') return false;
    if (requiredLevel === 'admin') return level === 'admin';
    return true; // 'user' or 'admin' satisfies requiredLevel='user'
  },
}));
