const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatIls(value: number) {
  const sign = value < -0.004 ? "−" : "";
  return `${sign}₪${money.format(Math.abs(value))}`;
}

export function formatCount(value: number) {
  return whole.format(value);
}

function jerusalemDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(date);
}

export function hebrewWhen(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const time = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).format(date);
  const day = jerusalemDay(date);
  const today = jerusalemDay(new Date());
  const yesterday = jerusalemDay(new Date(Date.now() - 86400000));
  if (day === today) return `היום ב-${time}`;
  if (day === yesterday) return `אתמול ב-${time}`;
  const label = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", timeZone: "Asia/Jerusalem" }).format(date);
  return `${label} ב-${time}`;
}

export function hebrewDate(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(date);
}
