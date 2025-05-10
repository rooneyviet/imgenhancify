"use client";

import Link from "next/link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; // Import QueryClient và Provider
import React from "react"; // Import React
import { useAuthStore } from "@/lib/store/authStore";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation"; // Import useRouter

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Tạo một instance của QueryClient.
  // Để tránh tạo lại client mỗi lần render, bạn có thể muốn lưu trữ nó trong state hoặc ref nếu component này có thể re-render thường xuyên
  // Hoặc, tốt hơn, định nghĩa nó bên ngoài component nếu nó không phụ thuộc vào props/state của component.
  // Trong trường hợp này, vì ClientLayout là một layout cấp cao, tạo một lần ở đây là ổn.
  // Hoặc có thể tạo ở cấp module: const queryClient = new QueryClient();
  const [queryClient] = React.useState(() => new QueryClient()); // Sử dụng React.useState để client chỉ được tạo một lần

  const { isAuthenticated, userAuthCode, logout } = useAuthStore();
  const router = useRouter(); // Khởi tạo router

  const handleLogout = () => {
    logout();
    router.push("/"); // Chuyển hướng về trang chủ sau khi logout
  };

  // Lấy 4 ký tự đầu và 4 ký tự cuối của mã để hiển thị
  const displayCode = userAuthCode
    ? `${userAuthCode.substring(0, 4)}...${userAuthCode.substring(userAuthCode.length - 4)}`
    : "";

  return (
    <QueryClientProvider client={queryClient}>
      {" "}
      {/* Bọc bằng QueryClientProvider */}
      <div className="min-h-screen flex flex-col">
        <header className="bg-primary text-primary-foreground p-4 shadow-md">
          <nav className="container mx-auto flex justify-between items-center">
            <Link href="/" className="text-xl font-bold">
              Imgenhancify
            </Link>
            <div className="space-x-4 flex items-center">
              {isAuthenticated ? (
                <>
                  <span className="text-sm">Xin chào, {displayCode}!</span>
                  <Button variant="secondary" onClick={handleLogout}>
                    Đăng xuất
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link href="/login">Đăng nhập</Link>
                  </Button>
                  <Button variant="secondary" asChild>
                    <Link href="/signup">Đăng ký</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="flex-grow container mx-auto p-4">{children}</main>
        <footer className="bg-gray-100 dark:bg-gray-800 text-center p-4 text-sm text-gray-600 dark:text-gray-400">
          © {new Date().getFullYear()} Imgenhancify. Bảo lưu mọi quyền.
        </footer>
      </div>
    </QueryClientProvider>
  );
}
