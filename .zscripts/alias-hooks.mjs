/**
 * Node loader hook that resolves the "@/..." TS path alias so pure TS libs
 * can be exercised directly with `node --experimental-strip-types`.
 * Usage: node --experimental-strip-types --import .zscripts/alias-register.mjs <script>
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    // "@/lib/x" -> "<repo>/src/lib/x" (+ .ts if extensionless)
    let rel = specifier.slice(2);
    if (!/\.[a-z]+$/.test(rel)) rel += '.ts';
    const url = new URL(`../src/${rel}`, import.meta.url).href;
    return next(url, context);
  }
  return next(specifier, context);
}
