// app/api/auth/signup/route.ts
import { signUp } from "@/app/actions/auth";
import { NextResponse } from "next/server";

export async function POST() {
  const result = await signUp();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ authCode: result.authCode });
}
