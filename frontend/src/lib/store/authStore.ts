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
    // Trong thực tế, bạn sẽ xác thực mã này với backend
    // Tạm thời, chỉ cần mã không trống là coi như thành công
    if (code.trim() !== "") {
      set({ userAuthCode: code, isAuthenticated: true, error: null });
    } else {
      set({
        error: "Mã đăng nhập không hợp lệ.",
        isAuthenticated: false,
        userAuthCode: null,
      });
    }
  },
  logout: () =>
    set({ userAuthCode: null, isAuthenticated: false, error: null }),
  setError: (errorMessage) => set({ error: errorMessage }),
}));
