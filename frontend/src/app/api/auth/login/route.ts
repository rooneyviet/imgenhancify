// app/api/auth/login/route.ts
import { logIn } from "@/app/actions/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authCode = body.authCode;

    if (!authCode) {
      return NextResponse.json(
        { error: "authCode is required" },
        { status: 400 }
      );
    }

    const result = await logIn(authCode);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 }); // 401 for unauthorized
    }
    return NextResponse.json({
      success: result.success,
      userId: result.userId,
    });
  } catch (error) {
    // Handle cases where request.json() fails (e.g., invalid JSON)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
