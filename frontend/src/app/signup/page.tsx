"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Terminal, Copy, Check } from "lucide-react";
import { signUp } from "../actions/auth";

// Helper function to format the auth code for display
function formatAuthCodeForDisplay(code: string): string {
  if (!code || code.length !== 16) return code; // Return as is if not 16 chars
  const upperCode = code.toUpperCase();
  return `${upperCode.substring(0, 4)} ${upperCode.substring(4, 8)} ${upperCode.substring(8, 12)} ${upperCode.substring(12, 16)}`;
}

export default function SignupPage() {
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Derived state for displaying the formatted code
  const displayedAuthCode = authCode
    ? formatAuthCodeForDisplay(authCode)
    : null;

  const generateAuthCode = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // The signUp action now generates the code and saves it.
      const result = await signUp();

      if (result.authCode) {
        setAuthCode(result.authCode);
      } else {
        setError(result.error || "Failed to create account. Please try again.");
      }
    } catch (err) {
      console.error("Error generating auth code:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (displayedAuthCode) {
      try {
        await navigator.clipboard.writeText(displayedAuthCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Create Account
          </CardTitle>
          <CardDescription className="text-center">
            Generate your unique login code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!authCode ? (
            <Button
              onClick={generateAuthCode}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Creating Account..." : "Generate Login Code"}
            </Button>
          ) : (
            <div className="space-y-4">
              <Alert>
                <Terminal className="h-4 w-4" />
                <div className="flex items-center justify-between">
                  <AlertTitle>Your Login Code:</AlertTitle>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6 p-0"
                    onClick={copyToClipboard}
                    aria-label="Copy code to clipboard"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <AlertDescription className="font-mono text-lg break-all mt-1">
                  {displayedAuthCode}
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle className="font-bold">Important!</AlertTitle>
                <AlertDescription>
                  Please save this code somewhere safe. You will need it to log
                  in.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
