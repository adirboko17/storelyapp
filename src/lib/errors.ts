export function hebrewError(error: { message?: string; code?: string } | null) {
  const message = error?.message?.trim() ?? "";
  if (/[\u0590-\u05FF]/.test(message)) return message;
  if (error?.code === "42501" || /forbidden|permission denied|row-level security/i.test(message)) {
    return "אין הרשאה. המסד דחה את הקריאה.";
  }
  if (/invalid api key|jwt/i.test(message)) return "ההתחברות לשרת נדחתה.";
  if (/failed to fetch|network request failed|network error/i.test(message)) return "אין חיבור לשרת.";
  return message || "הפעולה נכשלה.";
}
