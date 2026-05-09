import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const paymentId = body?.paymentId;
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.MONETBIL_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.MONETBIL_API_KEY}`;
  }

  console.log("Monetbil checkPayment request", { paymentId });
  const response = await fetch("https://api.monetbil.com/payment/v1/checkPayment", {
    method: "POST",
    headers,
    body: JSON.stringify({ paymentId }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("Monetbil checkPayment failed", {
      status: response.status,
      statusText: response.statusText,
      body: responseText,
    });
    return NextResponse.json({ error: "Monetbil checkPayment failed", details: responseText }, { status: 502 });
  }

  try {
    const data = JSON.parse(responseText);
    console.log("Monetbil checkPayment response", { paymentId, data });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Failed to parse Monetbil checkPayment response", {
      responseText,
      error: err.message,
    });
    return NextResponse.json({ error: "Invalid Monetbil response", details: err.message }, { status: 502 });
  }
}
