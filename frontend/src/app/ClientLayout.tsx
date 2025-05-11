"use client";

import Link from "next/link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Create an instance of QueryClient.
  // To avoid recreating the client on every render, you might want to store it in state or ref if this component re-renders frequently.
  // Or, better yet, define it outside the component if it doesn't depend on the component's props/state.
  // In this case, since ClientLayout is a high-level layout, creating it once here is fine.
  // Alternatively, it can be created at the module level: const queryClient = new QueryClient();
  const [queryClient] = React.useState(() => new QueryClient());

  const { isAuthenticated, userAuthCode, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Get the first 4 and last 4 characters of the code to display
  const displayCode = userAuthCode
    ? `${userAuthCode.substring(0, 4)}...${userAuthCode.substring(userAuthCode.length - 4)}`
    : "";

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <header className="bg-primary text-primary-foreground p-4 shadow-md">
          <nav className="container mx-auto flex justify-between items-center">
            <Link href="/" className="text-xl font-bold">
              Imgenhancify
            </Link>
            <div className="space-x-4 flex items-center">
              {isAuthenticated ? (
                <>
                  <span className="text-sm">Hello, {displayCode}!</span>
                  <Button variant="secondary" onClick={handleLogout}>
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link href="/login">Login</Link>
                  </Button>
                  <Button variant="secondary" asChild>
                    <Link href="/signup">Sign Up</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="flex-grow container mx-auto p-4">{children}</main>
        <footer className="bg-gray-100 dark:bg-gray-800 text-center p-4 text-sm text-gray-600 dark:text-gray-400">
          © {new Date().getFullYear()} Imgenhancify. All rights reserved.
        </footer>
      </div>
    </QueryClientProvider>
  );
}
