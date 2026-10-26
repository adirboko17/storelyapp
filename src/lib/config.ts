const SECRET = /service_role|sb_secret_/i;

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  if (typeof globalThis.atob === "function") return globalThis.atob(padded);
  return "";
}

function jwtRole(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1] ?? "")) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function publicConfigProblem(env: Record<string, string | undefined> = process.env) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  if (!url || !key) {
    return "חסרים EXPO_PUBLIC_SUPABASE_URL ו־EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ההתחברות לא יצאה לדרך, ולא נשלחה קריאה לשרת.";
  }
  if (!/^https:\/\//i.test(url)) {
    return "כתובת השרת חייבת להתחיל ב־https. לא נשלחה קריאה לשרת.";
  }
  const role = jwtRole(key);
  if (SECRET.test(key) || role === "service_role") {
    return "המפתח שהוגדר הוא מפתח סודי. Storely משתמש רק ב־EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. לא נשלחה קריאה לשרת.";
  }
  if (role === "anon") {
    return "זה מפתח anon ישן. צריך את המפתח הציבורי ב־EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. לא נשלחה קריאה לשרת.";
  }
  if (!key.startsWith("sb_publishable_")) {
    return "המפתח אינו מפתח ציבורי של Supabase. צריך ערך שמתחיל ב־sb_publishable_. לא נשלחה קריאה לשרת.";
  }
  return null;
}

export function readPublicSupabaseConfig() {
  const problem = publicConfigProblem();
  if (problem) return { problem, url: "", key: "" };
  return {
    problem: null,
    url: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim(),
    key: (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim(),
  };
}
