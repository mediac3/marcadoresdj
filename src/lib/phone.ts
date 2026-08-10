/**
 * Phone helpers for the public event-creation wizard.
 *
 * No external libraries: country list with dial codes + Unicode flag emoji,
 * E.164 formatting, and lightweight validation.
 */

export interface Country {
  /** ISO 3166-1 alpha-2 code, e.g. "CO". */
  code: string;
  /** Display name. */
  name: string;
  /** Dial code without the leading "+", e.g. "57". */
  dial: string;
  /** Unicode regional-indicator flag emoji, e.g. "🇨🇴". */
  flag: string;
}

/**
 * Curated list of countries (LATAM + common others) with dial codes.
 * The flag emoji is derived from the ISO code via regional indicators.
 */
export const COUNTRY_CODES: Country[] = [
  { code: "CO", name: "Colombia", dial: "57", flag: "🇨🇴" },
  { code: "MX", name: "México", dial: "52", flag: "🇲🇽" },
  { code: "AR", name: "Argentina", dial: "54", flag: "🇦🇷" },
  { code: "ES", name: "España", dial: "34", flag: "🇪🇸" },
  { code: "US", name: "Estados Unidos", dial: "1", flag: "🇺🇸" },
  { code: "CL", name: "Chile", dial: "56", flag: "🇨🇱" },
  { code: "PE", name: "Perú", dial: "51", flag: "🇵🇪" },
  { code: "EC", name: "Ecuador", dial: "593", flag: "🇪🇨" },
  { code: "VE", name: "Venezuela", dial: "58", flag: "🇻🇪" },
  { code: "BR", name: "Brasil", dial: "55", flag: "🇧🇷" },
  { code: "UY", name: "Uruguay", dial: "598", flag: "🇺🇾" },
  { code: "PY", name: "Paraguay", dial: "595", flag: "🇵🇾" },
  { code: "BO", name: "Bolivia", dial: "591", flag: "🇧🇴" },
  { code: "CR", name: "Costa Rica", dial: "506", flag: "🇨🇷" },
  { code: "PA", name: "Panamá", dial: "507", flag: "🇵🇦" },
  { code: "DO", name: "Rep. Dominicana", dial: "1", flag: "🇩🇴" },
  { code: "GT", name: "Guatemala", dial: "502", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", dial: "504", flag: "🇭🇳" },
  { code: "SV", name: "El Salvador", dial: "503", flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua", dial: "505", flag: "🇳🇮" },
  { code: "CA", name: "Canadá", dial: "1", flag: "🇨🇦" },
  { code: "GB", name: "Reino Unido", dial: "44", flag: "🇬🇧" },
  { code: "DE", name: "Alemania", dial: "49", flag: "🇩🇪" },
  { code: "FR", name: "Francia", dial: "33", flag: "🇫🇷" },
  { code: "IT", name: "Italia", dial: "39", flag: "🇮🇹" },
  { code: "PT", name: "Portugal", dial: "351", flag: "🇵🇹" },
];

/** Lookup a country by ISO code; defaults to Colombia if not found. */
export function getCountry(isoCode: string): Country {
  return COUNTRY_CODES.find((c) => c.code === isoCode) ?? COUNTRY_CODES[0];
}

/**
 * Build an E.164 phone string from a dial code and a national number.
 * Strips any non-digit character from the national part.
 */
export function toE164(dialCode: string, nationalNumber: string): string {
  const digits = nationalNumber.replace(/\D/g, "");
  const dial = dialCode.replace(/\D/g, "");
  return `${dial}${digits}`;
}

/**
 * Validate an E.164 phone string: only digits, total length between 8 and 15,
 * starting with a non-zero digit.
 */
export function isValidE164(phone: string): boolean {
  return /^\d{8,15}$/.test(phone);
}

/**
 * Detect the visitor's country from the browser environment.
 * Uses navigator.language first (e.g. "es-CO" → CO), then the IANA timezone
 * (e.g. "America/Bogota" → CO). Returns the ISO code or null if unknown.
 * Client-side only (guards against SSR / non-browser).
 */
export function detectCountryIso(): string | null {
  if (typeof navigator === "undefined" && typeof Intl === "undefined") return null;

  // 1) navigator.language / languages — e.g. "es-CO"
  const lang =
    (typeof navigator !== "undefined" &&
      (navigator.languages?.[0] || navigator.language)) ||
    "";
  const langMatch = lang.match(/[-_]([A-Za-z]{2})$/);
  if (langMatch) {
    const iso = langMatch[1].toUpperCase();
    if (COUNTRY_CODES.some((c) => c.code === iso)) return iso;
  }

  // 2) IANA timezone → ISO mapping (best-effort for LATAM)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const tzToIso: Record<string, string> = {
      "America/Bogota": "CO",
      "America/Mexico_City": "MX",
      "America/Monterrey": "MX",
      "America/Guadalajara": "MX",
      "America/Argentina/Buenos_Aires": "AR",
      "America/Buenos_Aires": "AR",
      "America/Santiago": "CL",
      "America/Lima": "PE",
      "America/Guayaquil": "EC",
      "America/Caracas": "VE",
      "America/Sao_Paulo": "BR",
      "America/Montevideo": "UY",
      "America/Asuncion": "PY",
      "America/La_Paz": "BO",
      "America/Costa_Rica": "CR",
      "America/Panama": "PA",
      "America/Santo_Domingo": "DO",
      "America/Guatemala": "GT",
      "America/Tegucigalpa": "HN",
      "America/El_Salvador": "SV",
      "America/Managua": "NI",
      "Europe/Madrid": "ES",
      "America/New_York": "US",
      "America/Chicago": "US",
      "America/Denver": "US",
      "America/Los_Angeles": "US",
      "America/Toronto": "CA",
      "Europe/London": "GB",
      "Europe/Berlin": "DE",
      "Europe/Paris": "FR",
      "Europe/Rome": "IT",
      "Europe/Lisbon": "PT",
    };
    if (tzToIso[tz]) return tzToIso[tz];
  } catch {
    // ignore
  }

  return null;
}

/**
 * Format an E.164 phone for display, e.g. "573226575422" → "+57 322 657 5422".
 * Falls back to "+<number>" if the dial code is unknown.
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return "—";
  // Try to match a known dial code prefix
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (phone.startsWith(c.dial)) {
      const rest = phone.slice(c.dial.length);
      return `+${c.dial} ${rest}`;
    }
  }
  return `+${phone}`;
}
