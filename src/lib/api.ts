import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthzError } from "@/lib/authz";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof AuthzError) {
    return jsonError(error.status, error.message);
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    const path = first?.path.join(".");
    return jsonError(400, path ? `${path}: ${first.message}` : (first?.message ?? "Invalid input"));
  }
  console.error(error);
  return jsonError(500, "Something went wrong");
}
