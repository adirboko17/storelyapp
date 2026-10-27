import { formatCount, formatIls } from "@/lib/format";
import type { CustomerRecord, OrderRecord } from "@/lib/snapshot";

type SegmentRule = { minSpent: number; minOrders: number; subOnly: boolean };

export function segmentRule(segment: SegmentRule) {
  const parts: string[] = [];
  if (segment.subOnly) parts.push("רק מנויים לדיוור");
  if (segment.minOrders === 1) parts.push("לפחות הזמנה אחת");
  else if (segment.minOrders > 1) parts.push(`לפחות ${formatCount(segment.minOrders)} הזמנות`);
  if (segment.minSpent > 0) parts.push(`הוציאו לפחות ${formatIls(segment.minSpent)}`);
  return parts.join(" · ");
}

export function customerCountLabel(count: number) {
  if (count === 0) return "אין לקוחות";
  if (count === 1) return "לקוח אחד";
  return `${formatCount(count)} לקוחות`;
}

export function orderStats(orders: OrderRecord[]) {
  const stats = new Map<string, { orders: number; spent: number }>();
  for (const order of orders) {
    if (!order.customerId) continue;
    const current = stats.get(order.customerId) ?? { orders: 0, spent: 0 };
    current.orders += 1;
    current.spent += order.total ?? 0;
    stats.set(order.customerId, current);
  }
  return stats;
}

export function inSegment(segment: SegmentRule, customer: CustomerRecord, stats: Map<string, { orders: number; spent: number }>) {
  const stat = stats.get(customer.id) ?? { orders: 0, spent: 0 };
  if (stat.orders < segment.minOrders || stat.spent < segment.minSpent) return false;
  if (segment.subOnly && customer.subscribed !== true) return false;
  return true;
}
