"use server";

import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma";

export async function signUp(): Promise<{ authCode?: string; error?: string }> {
  try {
    const authCode = uuidv4();
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

  try {
    const user = await prisma.user.findUnique({
      where: {
        authCode: authCode.trim(),
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
