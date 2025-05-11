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
      setAuthError("Code cannot be empty.");
      return;
    }
    setAuthError(null);
    console.log("Entered login code:", authCode);
    login(authCode);
    // After calling login, authStore.isAuthenticated will be updated
    // We can redirect the user or display a success message here
    // Example: if (useAuthStore.getState().isAuthenticated) router.push('/');
    // For now, just log to console and rely on alert from store (if any) or logic in store
    if (useAuthStore.getState().isAuthenticated) {
      alert(`Login successful with code: ${authCode}.`);
      // Redirection can be added here, e.g., router.push('/')
    } else {
      // Error has been set in the store and will be displayed via authError
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Login
          </CardTitle>
          <CardDescription className="text-center">
            Enter your 16-character login code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="text"
            placeholder="Enter your login code"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            maxLength={16}
          />
          {authError && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleLogin} className="w-full">
            Login
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            Don't have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Create account
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
