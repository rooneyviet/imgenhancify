import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  userAuthCode: string | null;
  isAuthenticated: boolean;
  error: string | null;
  login: (code: string) => void;
  logout: () => void;
  setError: (errorMessage: string | null) => void;
}

// Using persist middleware to keep auth state across page refreshes
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userAuthCode: null,
      isAuthenticated: false,
      error: null,
      login: (code) => {
        if (code.trim() !== "") {
          // The actual verification is done in the login page using server action
          // Here we just update the state based on the result
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
    }),
    {
      name: "auth-storage", // name of the item in the storage
      partialize: (state) => ({
        userAuthCode: state.userAuthCode,
        isAuthenticated: state.isAuthenticated,
      }), // only store these fields
    }
  )
);
