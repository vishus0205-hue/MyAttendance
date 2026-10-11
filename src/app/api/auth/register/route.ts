import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/token";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Please provide a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  name: z.string().min(1, "Name is required.").optional(),
  targetThreshold: z.number().min(50).max(100).optional().default(75.0),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({
      where: { email: parsed.email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const user = await prisma.user.create({
      data: {
        email: parsed.email.toLowerCase().trim(),
        passwordHash,
        name: parsed.name || "Student",
        targetThreshold: parsed.targetThreshold,
      },
    });

    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name || "Student",
      targetThreshold: user.targetThreshold,
      createdAt: Date.now(),
    });

    const response = NextResponse.json({
      success: true,
      message: "Account created successfully.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        targetThreshold: user.targetThreshold,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: err.errors[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
