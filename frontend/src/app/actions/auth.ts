"use server";

import prisma from "@/lib/prisma";

/**
 * Generates a random 16-character alphanumeric string (a-z, 0-9)
 * to be used as an authentication code
 */
function generateAuthCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function signUp(): Promise<{ authCode?: string; error?: string }> {
  try {
    const authCode = generateAuthCode();
    await prisma.user.create({
      data: {
        authCode: authCode,
      },
    });
    return { authCode };
  } catch (error) {
    console.error("Error during sign up:", error);
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      // Unique constraint failed, highly unlikely with UUIDs but good to handle
      return {
        error:
          "Failed to generate a unique authentication code. Please try again.",
      };
    }
    return {
      error:
        "An unexpected error occurred during sign up. Please try again later.",
    };
  }
}

export async function logIn(
  authCode: string
): Promise<{ success?: boolean; error?: string; userId?: number }> {
  if (!authCode || typeof authCode !== "string" || authCode.trim() === "") {
    return { error: "Authentication code cannot be empty." };
  }

  // Normalize the auth code input:
  // 1. Remove all whitespace characters (spaces, tabs, newlines, etc.)
  // 2. Convert to lowercase
  const normalizedAuthCode = authCode.replace(/\s+/g, "").toLowerCase();

  // Validate the normalized code
  if (
    normalizedAuthCode.length !== 16 ||
    !/^[a-z0-9]{16}$/.test(normalizedAuthCode)
  ) {
    return {
      error:
        "Invalid authentication code. Please check the code and try again.",
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        authCode: normalizedAuthCode, // Query with the normalized code
      },
    });

    if (user) {
      return { success: true, userId: user.id };
    } else {
      return {
        error:
          "Invalid authentication code. Please check the code and try again.",
      };
    }
  } catch (error) {
    console.error("Error during login:", error);
    return {
      error:
        "An unexpected error occurred during login. Please try again later.",
    };
  }
}
