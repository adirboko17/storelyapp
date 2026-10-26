const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatIls(value: number) {
  const sign = value < -0.004 ? "−" : "";
  return `${sign}₪${money.format(Math.abs(value))}`;
}

export function formatCount(value: number) {
  return whole.format(value);
}

const jerusalemDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });
const hebrewTimeFormat = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
const hebrewDayFormat = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" });
const hebrewShortDayFormat = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", timeZone: "Asia/Jerusalem" });
const hebrewDateFormat = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

function jerusalemDay(date: Date) {
  return jerusalemDayFormat.format(date);
}

let relativeStamp = 0;
let relativeToday = "";
let relativeYesterday = "";

function relativeDays() {
  const now = Date.now();
  if (now - relativeStamp > 60_000) {
    relativeStamp = now;
    relativeToday = jerusalemDay(new Date(now));
    relativeYesterday = jerusalemDay(new Date(now - 86400000));
  }
  return { today: relativeToday, yesterday: relativeYesterday };
}

export function hebrewWhen(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const time = hebrewTimeFormat.format(date);
  const day = jerusalemDay(date);
  const { today, yesterday } = relativeDays();
  if (day === today) return `היום ב-${time}`;
  if (day === yesterday) return `אתמול ב-${time}`;
  return `${hebrewShortDayFormat.format(date)} ב-${time}`;
}

export function hebrewTime(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return hebrewTimeFormat.format(date);
}

export function hebrewDay(value: string | undefined) {
  if (!value) return "ללא תאריך";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ללא תאריך";
  const day = jerusalemDay(date);
  const { today, yesterday } = relativeDays();
  if (day === today) return "היום";
  if (day === yesterday) return "אתמול";
  return hebrewDayFormat.format(date);
}

export function compactIls(value: number) {
  if (Math.abs(value) >= 1000) {
    const short = value / 1000;
    return `₪${Number.isInteger(short) ? short : short.toFixed(1)}K`;
  }
  return `₪${Math.round(value)}`;
}

export function compactCount(value: number) {
  if (Math.abs(value) >= 1000) {
    const short = value / 1000;
    return `${Number.isInteger(short) ? short : short.toFixed(1)}K`;
  }
  return String(Math.round(value));
}

export function hebrewDate(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return hebrewDateFormat.format(date);
}
