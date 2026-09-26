import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jwtDecode } from "jwt-decode";

// Shape of the JWT payload issued by the backend
interface JwtPayload {
  userId: string; // backend uses "userId" not "id"
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setToken: (token: string) => void;
  logout: () => void;
}

function decodeUser(token: string): AuthUser {
  const decoded = jwtDecode<JwtPayload>(token);
  if (!decoded.userId || !decoded.email || !decoded.name) {
    throw new Error("Invalid token payload");
  }
  return { id: decoded.userId, name: decoded.name, email: decoded.email };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      hasHydrated: false,

      setToken: (token: string) => {
        try {
          const user = decodeUser(token);
          set({ token, user, isAuthenticated: true, hasHydrated: true });
        } catch {
          set({ token: null, user: null, isAuthenticated: false, hasHydrated: true });
        }
      },

      logout: () => set({ token: null, user: null, isAuthenticated: false, hasHydrated: true }),
    }),
    {
      name: "prepkit-auth",
      // Persist only the token; derive user on rehydration
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.token) {
            try {
              state.user = decodeUser(state.token);
              state.isAuthenticated = true;
            } catch {
              state.token = null;
              state.user = null;
              state.isAuthenticated = false;
            }
          }
          state.hasHydrated = true;
        }
      },
    }
  )
);
