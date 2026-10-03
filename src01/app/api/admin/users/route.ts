import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = getDb();
    const snap = await db.collection("users").get();
    const users = snap.docs
      .map(d => {
        const { password, ...safe } = d.data();
        return safe;
      })
      .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    return NextResponse.json({ users });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
