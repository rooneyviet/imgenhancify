"use server";

import { prisma } from "@/lib/prisma";

/**
 * Creates a new user with the provided auth code
 * @param authCode The unique authentication code
 * @returns Object with success status and error message if any
 */
export async function createUser(authCode: string) {
  try {
    // Check if auth code already exists
    const existingUser = await prisma.user.findUnique({
      where: { authCode },
    });

    if (existingUser) {
      return {
        success: false,
        error: "Auth code already exists. Please generate a new one.",
      };
    }

    // Create new user with auth code
    await prisma.user.create({
      data: {
        authCode,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating user:", error);
    return {
      success: false,
      error: "Failed to create user. Please try again.",
    };
  }
}

/**
 * Verifies if an auth code exists in the database
 * @param authCode The authentication code to verify
 * @returns Object with success status and error message if any
 */
export async function verifyAuthCode(authCode: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { authCode },
    });

    if (!user) {
      return {
        success: false,
        error: "Invalid authentication code.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error verifying auth code:", error);
    return {
      success: false,
      error: "Failed to verify authentication code. Please try again.",
    };
  }
}
