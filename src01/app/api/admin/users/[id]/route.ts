import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { name, email, role } = await req.json();
    const db = getDb();
    await db.collection("users").doc(params.id).update({
      name,
      email: email.toLowerCase(),
      role,
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = getDb();
    const doc = await db.collection("users").doc(params.id).get();
    if (!doc.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (doc.data()?.role === "admin")
      return NextResponse.json({ error: "Cannot delete admin" }, { status: 403 });

    await db.collection("users").doc(params.id).delete();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}