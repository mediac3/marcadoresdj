import { SignJWT, jwtVerify } from "jose";

/**
 * JWT secret used to sign auth tokens.
 * In production, set JWT_SECRET env var to a strong random string (>= 32 chars).
 * Falls back to a development-only value when not configured.
 */
const RAW_SECRET =
  process.env.JWT_SECRET || "marcadoresdj-secret-key-v1-dev-only";

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16)
) {
  console.warn(
    "⚠️  WARNING: JWT_SECRET not set or too short in production. " +
      "Set a strong random secret (>= 32 chars) via JWT_SECRET env var."
  );
}

const JWT_SECRET = new TextEncoder().encode(RAW_SECRET);

export interface JwtPayload {
  userId: string;
  role: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export function extractBearerToken(
  request: Request
): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}