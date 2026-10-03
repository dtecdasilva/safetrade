import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 });
  return NextResponse.json({ user: session });
}
