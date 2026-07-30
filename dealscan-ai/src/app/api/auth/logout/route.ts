import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { handleApiError, NO_STORE } from "@/lib/api";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
