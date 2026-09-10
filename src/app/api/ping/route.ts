/**
 * Ultra-light healthcheck for the offline connectivity heartbeat.
 * No auth, no DB access, no body — a 204 within a few hundred ms.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return new Response(null, { status: 204 });
}
