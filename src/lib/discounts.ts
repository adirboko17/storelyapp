import { formatIls } from "@/lib/format";
import { DISCOUNT_KIND } from "@/lib/orders";
import type { DiscountRecord } from "@/lib/snapshot";

export type DiscountKind = "order" | "product" | "ship" | "bxgy";
export type DiscountStatus = "active" | "scheduled" | "expired";

export const DISCOUNT_TYPES: { kind: DiscountKind; label: string; detail: string }[] = [
  { kind: "product", label: "הנחה על מוצרים", detail: "אחוז או סכום על מוצרים או קטגוריות" },
  { kind: "order", label: "הנחה על ההזמנה", detail: "אחוז או סכום מכל ההזמנה" },
  { kind: "bxgy", label: "קנה X קבל Y", detail: "מוצר תמורת מוצר, או מתנה מקטגוריה" },
  { kind: "ship", label: "משלוח חינם", detail: "ביטול דמי משלוח כשהתנאים מתקיימים" },
];

const dayFormat = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" });
const jerusalemDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });

export function todayIso() {
  return jerusalemDay.format(new Date());
}

export function discountKind(value: string | undefined): DiscountKind {
  return value === "product" || value === "ship" || value === "bxgy" ? value : "order";
}

export function discountStatus(discount: Pick<DiscountRecord, "status" | "start" | "hasEnd" | "end">): DiscountStatus {
  const today = todayIso();
  const start = (discount.start ?? "").slice(0, 10);
  const end = (discount.end ?? "").slice(0, 10);
  if (start && start > today) return "scheduled";
  if (discount.hasEnd && end && end < today) return "expired";
  if (!start && (discount.status === "scheduled" || discount.status === "expired" || discount.status === "active")) return discount.status;
  return "active";
}

export function discountStamp(start: string | undefined) {
  const day = (start ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 0;
  return new Date(`${day}T12:00:00`).getTime();
}

export function discountDay(start: string | undefined) {
  const stamp = discountStamp(start);
  if (!stamp) return "ללא תאריך";
  const day = (start ?? "").slice(0, 10);
  const today = todayIso();
  const yesterday = jerusalemDay.format(new Date(Date.now() - 86400000));
  if (day === today) return "היום";
  if (day === yesterday) return "אתמול";
  return dayFormat.format(new Date(`${day}T12:00:00`));
}

function scope(discount: DiscountRecord) {
  if (discount.kind === "ship") return "משלוח חינם";
  if (discount.kind === "bxgy") return "קנה X קבל Y";
  if (discount.kind === "order") return "על ההזמנה";
  if (discount.applies === "prods") return "על מוצרים נבחרים";
  if (discount.applies === "colls") return "על קטגוריות";
  if (discount.applies === "subs") return "על תתי קטגוריות";
  return "על מוצרים";
}

export function discountLine(discount: DiscountRecord) {
  if (discount.kind === "ship") return "משלוח חינם";
  if (discount.kind === "bxgy") return DISCOUNT_KIND.bxgy;
  const amount = discount.value == null ? "" : discount.valueType === "fixed" ? formatIls(discount.value) : `${discount.value}%`;
  const head = [amount, "הנחה", scope(discount)].filter(Boolean).join(" ");
  return discount.once ? `${head} • שימוש אחד ללקוח` : head;
}
