export type PopupStatus = "draft" | "active" | "paused";
export type PopupTrigger = "immediate" | "delay" | "scroll" | "exit";
export type PopupFrequency = "always" | "session" | "day" | "once";
export type PopupDevice = "all" | "desktop" | "mobile";

export type PopupPages = {
  all: boolean;
  home: boolean;
  product: boolean;
  catalog: boolean;
  checkout: boolean;
  content: boolean;
  paths: string[];
};

export type PopupRecord = {
  id: string;
  name: string;
  status: PopupStatus;
  leads: number;
  updatedAt: string;
  pages: PopupPages;
  trigger: PopupTrigger;
  delaySeconds: number;
  scrollPercent: number;
  frequency: PopupFrequency;
  device: PopupDevice;
  startsAt: string | null;
  endsAt: string | null;
};

export type QuizChoiceView = { id: string; label: string };
export type QuizQuestionView = { id: string; title: string; choices: QuizChoiceView[] };

export type QuizRecord = {
  stored: boolean;
  status: "draft" | "active";
  updatedAt: string | null;
  introTitle: string;
  introText: string;
  questions: QuizQuestionView[];
};

export const BASIC_PATHS = ["/events", "/contact", "/stores", "/podcast"] as const;

export const PAGE_CHOICES: { id: string; label: string; hint: string; flag?: keyof Pick<PopupPages, "home" | "product" | "catalog" | "checkout" | "content">; path?: string }[] = [
  { id: "home", label: "דף הבית", hint: "רק העמוד הראשי", flag: "home" },
  { id: "product", label: "כל המוצרים", hint: "כל עמוד מוצר בחנות", flag: "product" },
  { id: "catalog", label: "החנות", hint: "רשימת המוצרים", flag: "catalog" },
  { id: "checkout", label: "תשלום", hint: "עמוד הקופה", flag: "checkout" },
  { id: "content", label: "כל המאמרים", hint: "הרשימה וכל כתבה", flag: "content" },
  { id: "events", label: "כל האירועים", hint: "עמוד האירועים", path: "/events" },
  { id: "contact", label: "צור קשר", hint: "עמוד יצירת קשר", path: "/contact" },
  { id: "stores", label: "חנויות", hint: "איפה קונים", path: "/stores" },
  { id: "podcast", label: "פודקאסט", hint: "עמודי הפודקאסט", path: "/podcast" },
];

const PATH_NAMES: Record<string, string> = { "/events": "אירועים", "/contact": "צור קשר", "/stores": "חנויות", "/podcast": "פודקאסט" };

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function cleanPaths(value: unknown) {
  if (!Array.isArray(value)) return [];
  const paths: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const path = item.trim().split("?")[0]?.split("#")[0] ?? "";
    if (!path.startsWith("/") || path.startsWith("//") || path.length > 120 || /\s/.test(path)) continue;
    if (!paths.includes(path)) paths.push(path);
    if (paths.length >= 20) break;
  }
  return paths;
}

function isoOrNull(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time.toISOString();
}

export function normalizeTargeting(value: unknown) {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const pages = row.pages && typeof row.pages === "object" ? row.pages as Record<string, unknown> : {};
  const trigger: PopupTrigger = row.trigger === "immediate" || row.trigger === "scroll" || row.trigger === "exit" ? row.trigger : "delay";
  const frequency: PopupFrequency = row.frequency === "always" || row.frequency === "session" || row.frequency === "once" ? row.frequency : "day";
  const device: PopupDevice = row.device === "desktop" || row.device === "mobile" ? row.device : "all";
  return {
    pages: {
      all: pages.all === true,
      home: pages.home === true,
      product: pages.product === true,
      catalog: pages.catalog === true,
      checkout: pages.checkout === true,
      content: pages.content === true,
      paths: cleanPaths(pages.paths),
    },
    trigger,
    delaySeconds: clamp(row.delaySeconds, 0, 180, 5),
    scrollPercent: clamp(row.scrollPercent, 5, 100, 40),
    frequency,
    device,
  };
}

export function parsePopup(row: Record<string, unknown>, leads: number): PopupRecord | null {
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  const targeting = normalizeTargeting(row.targeting);
  const status: PopupStatus = row.status === "active" || row.status === "paused" ? row.status : "draft";
  return {
    id: row.id,
    name: row.name,
    status,
    leads,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
    pages: targeting.pages,
    trigger: targeting.trigger,
    delaySeconds: targeting.delaySeconds,
    scrollPercent: targeting.scrollPercent,
    frequency: targeting.frequency,
    device: targeting.device,
    startsAt: isoOrNull(row.starts_at),
    endsAt: isoOrNull(row.ends_at),
  };
}

export function targetingPayload(popup: PopupRecord) {
  const targeting = normalizeTargeting({
    pages: popup.pages,
    trigger: popup.trigger,
    delaySeconds: popup.delaySeconds,
    scrollPercent: popup.scrollPercent,
    frequency: popup.frequency,
    device: popup.device,
  });
  return targeting;
}

export function popupProblem(popup: PopupRecord) {
  if (!popup.name.trim()) return "חסר שם לפופאפ";
  const pages = popup.pages;
  const chosen = pages.all || pages.home || pages.product || pages.catalog || pages.checkout || pages.content || pages.paths.length > 0;
  if (!chosen) return "בחרו לפחות עמוד אחד";
  if (popup.startsAt && popup.endsAt && new Date(popup.endsAt).getTime() <= new Date(popup.startsAt).getTime()) {
    return "מועד הסיום צריך להיות אחרי ההתחלה";
  }
  return "";
}

export function popupStatusLabel(status: PopupStatus) {
  if (status === "active") return "פעיל";
  if (status === "paused") return "מושהה";
  return "טיוטה";
}

export function frequencyLabel(frequency: PopupFrequency) {
  if (frequency === "always") return "בכל מעבר עמוד";
  if (frequency === "session") return "פעם בסשן";
  if (frequency === "once") return "פעם אחת";
  return "פעם ביום";
}

export function deviceLabel(device: PopupDevice) {
  if (device === "desktop") return "מחשב";
  if (device === "mobile") return "טלפון";
  return "כל המסכים";
}

export function triggerSummary(popup: Pick<PopupRecord, "trigger" | "delaySeconds" | "scrollPercent">) {
  if (popup.trigger === "immediate") return "מיד בכניסה";
  if (popup.trigger === "scroll") return `אחרי גלילה של ${popup.scrollPercent}%`;
  if (popup.trigger === "exit") return "כשעוזבים את העמוד";
  return popup.delaySeconds === 0 ? "מיד בכניסה" : `אחרי ${popup.delaySeconds} שניות`;
}

export function pagesSummary(pages: PopupPages) {
  if (pages.all) return "כל העמודים";
  const parts = [
    pages.home ? "דף הבית" : "",
    pages.product ? "כל המוצרים" : "",
    pages.catalog ? "החנות" : "",
    pages.checkout ? "תשלום" : "",
    pages.content ? "כל המאמרים" : "",
  ].filter(Boolean);
  let products = 0;
  let articles = 0;
  let events = 0;
  let other = 0;
  for (const path of pages.paths) {
    if (PATH_NAMES[path]) {
      parts.push(PATH_NAMES[path]);
      continue;
    }
    if (path.startsWith("/product/")) products += 1;
    else if (path.startsWith("/articles/") || path.startsWith("/journal/")) articles += 1;
    else if (path.startsWith("/events/")) events += 1;
    else other += 1;
  }
  if (products) parts.push(products === 1 ? "מוצר אחד" : `${products} מוצרים`);
  if (articles) parts.push(articles === 1 ? "מאמר אחד" : `${articles} מאמרים`);
  if (events) parts.push(events === 1 ? "אירוע אחד" : `${events} אירועים`);
  if (other) parts.push(other === 1 ? "עמוד אחד" : `${other} עמודים`);
  return parts.join(" · ") || "בלי עמוד";
}

export function localDateValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseLocalDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!match) throw new Error("התאריך צריך להיות בפורמט 2026-10-27 18:00");
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4] ?? "00"}:${match[5] ?? "00"}`);
  if (Number.isNaN(date.getTime())) throw new Error("התאריך לא תקין");
  return date.toISOString();
}

export function parseQuiz(row: { status?: unknown; flow?: unknown; updated_at?: unknown } | null): QuizRecord {
  if (!row) return { stored: false, status: "draft", updatedAt: null, introTitle: "", introText: "", questions: [] };
  const flow = row.flow && typeof row.flow === "object" ? row.flow as Record<string, unknown> : {};
  const questions: QuizQuestionView[] = [];
  if (Array.isArray(flow.questions)) {
    for (const item of flow.questions) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title : "";
      const id = typeof record.id === "string" && record.id ? record.id : title;
      const choices: QuizChoiceView[] = [];
      if (Array.isArray(record.choices)) {
        for (const choice of record.choices) {
          if (!choice || typeof choice !== "object") continue;
          const next = choice as Record<string, unknown>;
          const label = typeof next.label === "string" ? next.label : "";
          const choiceId = typeof next.id === "string" && next.id ? next.id : label;
          if (!choiceId && !label) continue;
          choices.push({ id: choiceId || label, label });
        }
      }
      if (!id && !title) continue;
      questions.push({ id: id || `q${questions.length + 1}`, title, choices });
      if (questions.length >= 40) break;
    }
  }
  return {
    stored: true,
    status: row.status === "active" ? "active" : "draft",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    introTitle: typeof flow.introTitle === "string" ? flow.introTitle : "",
    introText: typeof flow.introText === "string" ? flow.introText : "",
    questions,
  };
}

export function copyPopup(popup: PopupRecord): PopupRecord {
  return { ...popup, pages: { ...popup.pages, paths: [...popup.pages.paths] } };
}
