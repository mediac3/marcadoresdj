import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidE164 } from "@/lib/phone";

/**
 * POST /api/public/check-phone
 *
 * Public endpoint – no auth required.
 *
 * Checks whether a phone number (E.164) is already registered to a guest user.
 * Used by the public wizard to enforce the "one phone per visitor" rule and to
 * show remaining credits / the "last credit" WhatsApp prompt.
 *
 * Body: { phone: string }  (E.164 digits only, e.g. "573226575422")
 * Response: { exists: boolean, credits?: number }
 *
 * `credits` is only returned when the phone exists, so the visitor can see how
 * many credits they have left before creating the event. This is not sensitive:
 * the caller already knows the phone number they are querying.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

    if (!phone || !isValidE164(phone)) {
      return NextResponse.json(
        { exists: false },
        { status: 200 },
      );
    }

    const user = await db.user.findUnique({
      where: { phone },
      select: { credits: true },
    });

    if (!user) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({ exists: true, credits: user.credits });
  } catch {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
