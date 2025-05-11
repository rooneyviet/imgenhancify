import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  userAuthCode: string | null;
  userId: number | null;
  isAuthenticated: boolean;
  error: string | null;
  login: (code: string, userId: number) => void;
  logout: () => void;
  setError: (errorMessage: string | null) => void;
}

// Using persist middleware to keep auth state across page refreshes
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userAuthCode: null,
      userId: null,
      isAuthenticated: false,
      error: null,
      login: (code, userId) => {
        if (code.trim() !== "" && userId) {
          set({
            userAuthCode: code,
            userId: userId,
            isAuthenticated: true,
            error: null,
          });
        } else {
          set({
            error: "Invalid login details.",
            isAuthenticated: false,
            userAuthCode: null,
            userId: null,
          });
        }
      },
      logout: () =>
        set({
          userAuthCode: null,
          userId: null,
          isAuthenticated: false,
          error: null,
        }),
      setError: (errorMessage) => set({ error: errorMessage }),
    }),
    {
      name: "auth-storage", // name of the item in the storage
      partialize: (state) => ({
        userAuthCode: state.userAuthCode,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
