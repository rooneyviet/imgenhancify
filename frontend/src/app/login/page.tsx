"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { useAuthStore } from "@/lib/store/authStore";

export default function LoginPage() {
  const [authCode, setAuthCode] = useState<string>("");
  const { login, error: authError, setError: setAuthError } = useAuthStore();

  const handleLogin = () => {
    if (!authCode.trim()) {
      setAuthError("Mã không được để trống.");
      return;
    }
    setAuthError(null);
    console.log("Mã đăng nhập đã nhập:", authCode);
    login(authCode);
    // Sau khi gọi login, authStore.isAuthenticated sẽ được cập nhật
    // Chúng ta có thể chuyển hướng người dùng hoặc hiển thị thông báo thành công ở đây
    // Ví dụ: if (useAuthStore.getState().isAuthenticated) router.push('/');
    // Tạm thời chỉ log ra console và dựa vào alert từ store (nếu có) hoặc logic trong store
    if (useAuthStore.getState().isAuthenticated) {
      alert(`Đăng nhập thành công với mã: ${authCode}.`);
      // Có thể thêm chuyển hướng ở đây, ví dụ: router.push('/')
    } else {
      // Lỗi đã được set trong store và sẽ hiển thị qua authError
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Đăng nhập
          </CardTitle>
          <CardDescription className="text-center">
            Nhập mã đăng nhập 16 ký tự của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="text"
            placeholder="Nhập mã đăng nhập của bạn"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            maxLength={16}
          />
          {authError && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Lỗi</AlertTitle>
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleLogin} className="w-full">
            Đăng nhập
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            Chưa có tài khoản?{" "}
            <Link
              href="/signup"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Tạo tài khoản
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
