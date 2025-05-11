"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { logIn as serverLogIn } from "../actions/auth"; // Renamed to avoid conflict with store's login

export default function LoginPage() {
  const [authCode, setAuthCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, error: authError, setError: setAuthError } = useAuthStore();
  const router = useRouter();

  const handleLogin = async () => {
    if (!authCode.trim()) {
      setAuthError("Code cannot be empty.");
      return;
    }

    setIsLoading(true);
    setAuthError(null);

    try {
      const result = await serverLogIn(authCode.trim());

      if (result.success && result.userId) {
        // If verification is successful, update the auth store
        login(authCode.trim(), result.userId); // Pass userId to the store's login

        // Show success toast and redirect to main page
        toast.success("Login successful", {
          description: "Welcome back to IMG Enhancify!",
        });

        // Redirect to main page
        router.push("/");
      } else {
        // If verification fails, set the error
        setAuthError(result.error || "Invalid authentication code.");
      }
    } catch (err) {
      console.error("Error during login:", err);
      setAuthError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
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
            placeholder="XXXX XXXX XXXX XXXX"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            maxLength={19} // 16 characters + 3 spaces
            className="font-mono"
          />
          {authError && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleLogin} className="w-full" disabled={isLoading}>
            {isLoading ? "Verifying..." : "Login"}
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
