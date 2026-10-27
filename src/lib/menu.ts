export type AreaKey =
  | "returns"
  | "abandoned"
  | "collections"
  | "inventory"
  | "reviews"
  | "gift-cards"
  | "segments"
  | "growth"
  | "attribution"
  | "integrations"
  | "messages"
  | "automations"
  | "popups"
  | "posts"
  | "events"
  | "analytics"
  | "reports"
  | "live"
  | "store"
  | "general"
  | "notifications"
  | "ai"
  | "users"
  | "shipping"
  | "policies";

export type AreaItem = {
  key: AreaKey;
  label: string;
  permission?: string;
  settings?: boolean;
};

export type MenuGroup = {
  title: string;
  items: AreaItem[];
};

export const MENU: MenuGroup[] = [
  {
    title: "הזמנות",
    items: [
      { key: "returns", label: "החזרות והחזרים כספיים", permission: "orders.read" },
      { key: "abandoned", label: "עגלות נטושות", permission: "orders.read" },
    ],
  },
  {
    title: "מוצרים",
    items: [
      { key: "collections", label: "קטגוריות", permission: "products.read" },
      { key: "inventory", label: "מלאי", permission: "products.read" },
      { key: "reviews", label: "ביקורות", permission: "products.read" },
      { key: "gift-cards", label: "כרטיסי מתנה", permission: "products.read" },
    ],
  },
  {
    title: "לקוחות",
    items: [{ key: "segments", label: "פלחים", permission: "customers.read" }],
  },
  {
    title: "צמיחה",
    items: [
      { key: "growth", label: "צמיחה", permission: "analytics.read" },
      { key: "attribution", label: "ייחוס", permission: "analytics.read" },
    ],
  },
  {
    title: "שיווק",
    items: [
      { key: "integrations", label: "אינטגרציות", permission: "marketing.read" },
      { key: "messages", label: "מיילים ו-SMS", permission: "marketing.read" },
      { key: "automations", label: "אוטומציות", permission: "marketing.read" },
      { key: "popups", label: "פופאפים", permission: "marketing.read" },
    ],
  },
  {
    title: "תוכן",
    items: [
      { key: "posts", label: "פוסטים בבלוג", permission: "content.read" },
      { key: "events", label: "אירועים", permission: "content.read" },
    ],
  },
  {
    title: "ניתוח נתונים",
    items: [
      { key: "analytics", label: "ניתוח נתונים", permission: "analytics.read" },
      { key: "reports", label: "דוחות", permission: "analytics.read" },
      { key: "live", label: "צפייה חיה", permission: "analytics.live" },
    ],
  },
  {
    title: "חנות",
    items: [{ key: "store", label: "חנות אונליין" }],
  },
  {
    title: "הגדרות",
    items: [
      { key: "general", label: "כללי", settings: true },
      { key: "notifications", label: "התראות", settings: true },
      { key: "ai", label: "חיבור AI", settings: true },
      { key: "users", label: "משתמשים", settings: true },
      { key: "shipping", label: "משלוחים", settings: true },
      { key: "policies", label: "פוליסות", settings: true },
    ],
  },
];

const AREAS = MENU.flatMap((group) => group.items);

export function areaByKey(key: string | undefined) {
  return AREAS.find((item) => item.key === key) ?? null;
}

export const SEGMENTS = [
  { id: "vip", name: "לקוחות VIP", minSpent: 1500, minOrders: 5, subOnly: false },
  { id: "subs", name: "מנויים לדיוור", minSpent: 0, minOrders: 0, subOnly: true },
  { id: "fresh", name: "לקוחות חדשים", minSpent: 0, minOrders: 1, subOnly: false },
  { id: "repeat", name: "רכשו יותר מפעמיים", minSpent: 0, minOrders: 3, subOnly: false },
] as const;

export const ACCESS_AREA_LABEL: Record<string, string> = {
  orders: "הזמנות",
  products: "מוצרים",
  customers: "לקוחות",
  marketing: "שיווק",
  discounts: "הנחות",
  content: "תוכן",
  reports: "ניתוח נתונים",
  live: "צפייה חיה",
  settings: "הגדרות",
};
