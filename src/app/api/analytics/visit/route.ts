import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function parseUA(ua: string): {
  browser: string;
  os: string;
  deviceType: string;
} {
  let browser = "Unknown";
  let os = "Unknown";
  let deviceType = "desktop";

  if (/Mobile|Android.*Mobile|iPhone|iPod/i.test(ua)) deviceType = "mobile";
  else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) deviceType = "tablet";

  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  const m = browser.match(/\/[\d.]+/);
  if (m) browser += m[0];

  return { browser, os, deviceType };
}

async function fetchGeo(ip: string): Promise<{
  country: string | null;
  region: string | null;
  city: string | null;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,city`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { country: null, region: null, city: null };
    const data = await res.json();
    if (data.status !== "success") return { country: null, region: null, city: null };
    return {
      country: data.countryCode || data.country || null,
      region: data.region || null,
      city: data.city || null,
    };
  } catch {
    return { country: null, region: null, city: null };
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { fingerprint, path } = body;

  if (!fingerprint) {
    return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const ua = request.headers.get("user-agent") || "";
  const { browser, os, deviceType } = parseUA(ua);
  const referer = request.headers.get("referer") || null;

  const geo = ip !== "unknown" ? await fetchGeo(ip) : { country: null, region: null, city: null };

  await db.siteVisit.create({
    data: {
      fingerprint,
      ip: ip === "unknown" ? null : ip,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      browser,
      os,
      deviceType,
      referer,
      path,
    },
  });

  return NextResponse.json({ success: true });
}