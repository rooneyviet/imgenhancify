import { create } from "zustand";

interface AuthState {
  userAuthCode: string | null;
  isAuthenticated: boolean;
  error: string | null;
  login: (code: string) => void;
  logout: () => void;
  setError: (errorMessage: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userAuthCode: null,
  isAuthenticated: false,
  error: null,
  login: (code) => {
    if (code.trim() !== "") {
      set({ userAuthCode: code, isAuthenticated: true, error: null });
    } else {
      set({
        error: "Invalid login code.",
        isAuthenticated: false,
        userAuthCode: null,
      });
    }
  },
  logout: () =>
    set({ userAuthCode: null, isAuthenticated: false, error: null }),
  setError: (errorMessage) => set({ error: errorMessage }),
}));
