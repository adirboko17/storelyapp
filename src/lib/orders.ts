import type { OrderRecord } from "@/lib/snapshot";

export type OrderPatch = {
  pay?: "paid" | "pending" | "partially_refunded" | "refunded";
  fulfillment?: "unfulfilled" | "fulfilled" | "partial" | "onhold" | "progress";
  customer_status?: "received" | "progress" | "hold" | "sent" | "transit" | "delivered";
  comment?: string;
};

export const ORDER_STATUS_ACTIONS: { id: string; label: string; patch: OrderPatch }[] = [
  {
    id: "progress",
    label: "סימון כבטיפול",
    patch: { fulfillment: "progress", customer_status: "progress", comment: "ההזמנה סומנה כבטיפול." },
  },
  {
    id: "hold",
    label: "סימון כבהמתנה",
    patch: { fulfillment: "onhold", customer_status: "hold", comment: "ההזמנה סומנה כבהמתנה." },
  },
  {
    id: "sent",
    label: "סימון כנשלחה",
    patch: { fulfillment: "fulfilled", customer_status: "sent", comment: "ההזמנה סומנה כנשלחה." },
  },
  {
    id: "transit",
    label: "סימון כבדרך אלייך",
    patch: { fulfillment: "fulfilled", customer_status: "transit", comment: "ההזמנה סומנה כבדרך אל הלקוח." },
  },
  {
    id: "delivered",
    label: "סימון כנמסרה",
    patch: { fulfillment: "fulfilled", customer_status: "delivered", comment: "ההזמנה סומנה כנמסרה." },
  },
];

export function statusAlreadyApplied(order: OrderRecord, patch: OrderPatch) {
  if (patch.fulfillment && order.fulfillment !== patch.fulfillment) return false;
  if (patch.customer_status && order.customerStatus !== patch.customer_status) return false;
  if (patch.pay && order.pay !== patch.pay) return false;
  return Boolean(order.fulfillment || order.customerStatus || order.pay);
}

export const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  received: "התקבלה",
  progress: "בטיפול",
  hold: "בהמתנה",
  sent: "נארזה ונשלחה",
  transit: "בדרך אלייך",
  delivered: "נמסרה",
};

export const FULFILLMENT_BADGE: Record<string, { label: string; background: string; color: string }> = {
  unfulfilled: { label: "לא נשלח", background: "#ffeb78", color: "#4f4700" },
  fulfilled: { label: "נשלח", background: "#ebebeb", color: "#303030" },
  partial: { label: "נשלח חלקית", background: "#ffeb78", color: "#4f4700" },
  onhold: { label: "בהמתנה", background: "#ffeb78", color: "#4f4700" },
  progress: { label: "בטיפול", background: "#ffeb78", color: "#4f4700" },
};

export const PAY_BADGE: Record<string, { label: string; background: string; color: string }> = {
  paid: { label: "שולם", background: "#ebebeb", color: "#303030" },
  pending: { label: "ממתין לתשלום", background: "#ffd6a4", color: "#5e4200" },
  partially_refunded: { label: "הוחזר חלקית", background: "#e3e3e3", color: "#303030" },
  refunded: { label: "הוחזר", background: "#e3e3e3", color: "#303030" },
};

export const PRODUCT_BADGE: Record<string, { label: string; background: string; color: string }> = {
  active: { label: "פעיל", background: "#cdfee1", color: "#0c5132" },
  draft: { label: "טיוטה", background: "#e0f0ff", color: "#00527c" },
  archived: { label: "בארכיון", background: "#e3e3e3", color: "#616161" },
};

export const DISCOUNT_KIND: Record<string, string> = {
  order: "הנחה על ההזמנה",
  product: "הנחה על מוצרים",
  ship: "משלוח חינם",
  bxgy: "קנה X קבל Y",
};

export const DISCOUNT_STATUS: Record<string, { label: string; background: string; color: string }> = {
  active: { label: "פעיל", background: "#cdfee1", color: "#0c5132" },
  scheduled: { label: "מתוזמן", background: "#e0f0ff", color: "#00527c" },
  expired: { label: "פג תוקף", background: "#e3e3e3", color: "#616161" },
};

export function knownBadge(map: Record<string, { label: string; background: string; color: string }>, status: string | undefined) {
  if (!status) return null;
  return map[status] ?? { label: status, background: "#ebebeb", color: "#303030" };
}
