import { formatCount, formatIls } from "@/lib/format";
import type { TrafficSnapshot } from "@/lib/remote";
import type { AdminSnapshot, OrderRecord } from "@/lib/snapshot";

export type ReportRow = { label: string; value: string };

export const REPORTS = [
  { id: "sales-over-time", name: "סך המכירות לאורך זמן", category: "מכירות" },
  { id: "orders-over-time", name: "הזמנות לאורך זמן", category: "הזמנות" },
  { id: "fulfilled-over-time", name: "הזמנות שנשלחו לאורך זמן", category: "הזמנות" },
  { id: "sales-by-product", name: "סך המכירות לפי מוצר", category: "מכירות" },
  { id: "payments-by-method", name: "תשלומים לפי סטטוס", category: "כספים" },
  { id: "new-vs-returning", name: "לקוחות חדשים מול חוזרים", category: "לקוחות" },
  { id: "inventory-value", name: "ערך מלאי לפי מוצר", category: "מלאי" },
  { id: "out-of-stock", name: "מוצרים שאזלו מהמלאי", category: "מלאי" },
  { id: "sessions-over-time", name: "ביקורים לאורך זמן", category: "רכישת לקוחות" },
  { id: "visitors-now", name: "מבקרים כעת", category: "רכישת לקוחות" },
  { id: "visits-by-location", name: "ביקורים לפי מיקום", category: "רכישת לקוחות" },
  { id: "conversion-breakdown", name: "פירוט שיעור ההמרה", category: "התנהגות" },
] as const;

export function reportById(id: string) {
  return REPORTS.find((report) => report.id === id) ?? null;
}

function dayKey(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(date);
}

function net(order: OrderRecord) {
  const total = order.total ?? 0;
  const refunded = order.refunded ?? 0;
  return Math.max(0, total - refunded);
}

function lastDays(orders: OrderRecord[], days: number) {
  const end = Date.now();
  const start = end - days * 86400000;
  return orders.filter((order) => {
    const time = Date.parse(order.createdAt ?? "");
    return Number.isFinite(time) && time >= start && time <= end;
  });
}

function moneyRows(entries: [string, number][]) {
  return entries
    .filter(([, value]) => value !== 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value: formatIls(value) }));
}

export function buildReport(id: string, snapshot: AdminSnapshot, traffic: TrafficSnapshot | null): { rows: ReportRow[]; missing?: string } {
  const orders = snapshot.orders;
  const products = snapshot.products;
  if ((id === "sales-over-time" || id === "orders-over-time" || id === "fulfilled-over-time" || id === "sales-by-product" || id === "payments-by-method" || id === "new-vs-returning") && !orders) {
    return { rows: [], missing: "הסנאפשוט לא כולל הזמנות." };
  }
  if ((id === "inventory-value" || id === "out-of-stock") && !products) {
    return { rows: [], missing: "הסנאפשוט לא כולל מוצרים." };
  }
  if ((id === "sessions-over-time" || id === "visitors-now" || id === "visits-by-location" || id === "conversion-breakdown") && !traffic) {
    return { rows: [], missing: "אין נתוני תנועה." };
  }

  if (id === "sales-over-time" && traffic && traffic.days.sales.length) {
    return { rows: traffic.days.sales.map((value, index) => ({ label: `יום ${index + 1}`, value: formatIls(value) })).filter((row) => row.value !== formatIls(0)) };
  }
  if (id === "sales-over-time") {
    const grouped = new Map<string, number>();
    lastDays(orders ?? [], 30).forEach((order) => {
      const key = dayKey(order.createdAt);
      if (!key) return;
      grouped.set(key, (grouped.get(key) ?? 0) + net(order));
    });
    return { rows: [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([label, value]) => ({ label, value: formatIls(value) })) };
  }
  if (id === "orders-over-time" && traffic && traffic.days.orders.length) {
    return { rows: traffic.days.orders.map((value, index) => ({ label: `יום ${index + 1}`, value: formatCount(value) })).filter((row) => row.value !== "0") };
  }
  if (id === "orders-over-time" || id === "fulfilled-over-time") {
    const source = id === "fulfilled-over-time" ? (orders ?? []).filter((order) => order.fulfillment === "fulfilled") : orders ?? [];
    const grouped = new Map<string, number>();
    lastDays(source, 30).forEach((order) => {
      const key = dayKey(order.createdAt);
      if (!key) return;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    });
    return { rows: [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([label, value]) => ({ label, value: formatCount(value) })) };
  }
  if (id === "sales-by-product") {
    const grouped = new Map<string, number>();
    (orders ?? []).forEach((order) => {
      (order.lines ?? []).forEach((line) => {
        const label = line.title || line.sku || "";
        if (!label || line.unitPrice == null) return;
        grouped.set(label, (grouped.get(label) ?? 0) + line.unitPrice * (line.quantity ?? 1));
      });
    });
    return { rows: moneyRows([...grouped.entries()]) };
  }
  if (id === "payments-by-method") {
    const labels: Record<string, string> = { paid: "שולם", pending: "ממתין לתשלום", partially_refunded: "הוחזר חלקית", refunded: "הוחזר" };
    const grouped = new Map<string, number>();
    (orders ?? []).forEach((order) => {
      if (!order.pay || order.total == null) return;
      const label = labels[order.pay] ?? order.pay;
      grouped.set(label, (grouped.get(label) ?? 0) + net(order));
    });
    return { rows: moneyRows([...grouped.entries()]) };
  }
  if (id === "new-vs-returning") {
    const first = new Map<string, number>();
    (orders ?? []).forEach((order) => {
      const key = order.customerId || order.customerName || "";
      const time = Date.parse(order.createdAt ?? "");
      if (!key || !Number.isFinite(time)) return;
      const known = first.get(key);
      if (known == null || time < known) first.set(key, time);
    });
    let fresh = 0;
    let returning = 0;
    (orders ?? []).forEach((order) => {
      const key = order.customerId || order.customerName || "";
      const time = Date.parse(order.createdAt ?? "");
      if (!key || !Number.isFinite(time)) return;
      if (first.get(key) === time) fresh += 1;
      else returning += 1;
    });
    return { rows: [{ label: "הזמנות ראשונות", value: formatCount(fresh) }, { label: "הזמנות חוזרות", value: formatCount(returning) }] };
  }
  if (id === "inventory-value") {
    const rows = (products ?? []).flatMap((product) => {
      if (product.stock == null || product.price == null || !product.title) return [];
      return [[product.title, product.stock * product.price] as [string, number]];
    });
    return { rows: moneyRows(rows) };
  }
  if (id === "out-of-stock") {
    const rows = (products ?? []).filter((product) => product.stock === 0 && product.title);
    return { rows: rows.map((product) => ({ label: product.title ?? "", value: "אזל" })) };
  }
  if (id === "sessions-over-time" && traffic) {
    return { rows: traffic.days.visits.map((value, index) => ({ label: `יום ${index + 1}`, value: formatCount(value) })).filter((row) => row.value !== "0") };
  }
  if (id === "visitors-now" && traffic) {
    return {
      rows: [
        { label: "מבקרים כעת", value: formatCount(traffic.now.visitors) },
        { label: "ביקורים", value: formatCount(traffic.now.visits) },
        { label: "חדשים", value: formatCount(traffic.now.newVisitors) },
        { label: "חוזרים", value: formatCount(traffic.now.returningVisitors) },
        ...traffic.now.locations.map((place) => ({ label: place.label, value: formatCount(place.count) })),
      ],
    };
  }
  if (id === "visits-by-location" && traffic) {
    const places = traffic.today.locations.length ? traffic.today.locations : traffic.now.locations;
    return { rows: places.map((place) => ({ label: place.label, value: formatCount(place.count) })) };
  }
  if (id === "conversion-breakdown" && traffic) {
    return {
      rows: [
        { label: "ביקורים היום", value: formatCount(traffic.today.visits) },
        { label: "עגלות", value: formatCount(traffic.now.carts) },
        { label: "הגיעו לקופה", value: formatCount(traffic.now.checkouts) },
        { label: "רכשו", value: formatCount(traffic.now.purchased) },
      ],
    };
  }
  return { rows: [], missing: "הדוח הזה לא זמין." };
}
