import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user,
  });
}
