export type OrderLine = {
  productId?: string;
  title?: string;
  quantity?: number;
  unitPrice?: number;
  variant?: string;
  sku?: string;
};

export type TimelineEntry = {
  text: string;
  at?: string;
};

export type OrderRecord = {
  id?: string;
  number: number;
  createdAt?: string;
  customerId?: string;
  customerName?: string;
  channel?: string;
  pay?: string;
  fulfillment?: string;
  customerStatus?: string;
  total?: number;
  note?: string;
  tags?: string[];
  discountCode?: string;
  discountAmount?: number;
  shippingName?: string;
  shippingAmount?: number;
  refunded?: number;
  carrier?: string;
  tracking?: string;
  timeline?: TimelineEntry[];
  lines?: OrderLine[];
};

export type ProductRecord = {
  id: string;
  title?: string;
  status?: string;
  price?: number;
  compareAt?: number;
  stock?: number;
  sku?: string;
  barcode?: string;
  variant?: string;
  vendor?: string;
  category?: string;
  description?: string;
};

export type CustomerRecord = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  zip?: string;
  orders?: number;
  note?: string;
  tags?: string[];
  createdAt?: string;
  subscribed?: boolean;
};

export type CollectionRecord = {
  id: string;
  title: string;
  description?: string;
  productIds?: string[];
  hidden?: boolean;
  image?: string;
};

export type CheckoutRecord = {
  id: string;
  updatedAt?: string;
  name?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  zip?: string;
  subtotal?: number;
  shippingAmount?: number;
  total?: number;
  reminded?: boolean;
  recovered?: boolean;
  lines?: OrderLine[];
};

export type GiftCardRecord = {
  code: string;
  value?: number;
  balance?: number;
  customer?: string;
  expires?: string;
  note?: string;
};

export type PostRecord = {
  id: string;
  title?: string;
  excerpt?: string;
  body?: string;
  author?: string;
  updated?: string;
  blog?: string;
  visible?: boolean;
  handle?: string;
};

export type MarketingEmailRecord = {
  id: string;
  name?: string;
  subject?: string;
  preview?: string;
  body?: string;
};

export type MarketingSmsRecord = {
  id: string;
  name?: string;
  text?: string;
};

export type FlowRecord = {
  id: string;
  name: string;
  trigger?: string;
  on?: boolean;
  steps?: string[];
};

export type MarketingRecord = {
  emails?: MarketingEmailRecord[];
  sms?: MarketingSmsRecord[];
  flows?: FlowRecord[];
  connected?: string[];
};

export type ShipRuleRecord = {
  id: string;
  name?: string;
  days?: string;
  fee?: string;
};

export type ShipProfileRecord = {
  id: string;
  name?: string;
};

export type StoreContact = {
  email?: string;
  phone?: string;
  company?: string;
  street?: string;
  city?: string;
  zip?: string;
};

export type ShippingRecord = {
  rules?: ShipRuleRecord[];
  profiles?: ShipProfileRecord[];
  estimates?: boolean;
  localDelivery?: boolean;
  pickup?: boolean;
  contact?: StoreContact;
};

export type PolicyRecord = {
  id: string;
  title: string;
  body?: string;
  kind?: string;
};

export type DiscountRecord = {
  id: string;
  code?: string;
  title?: string;
  kind?: string;
  valueType?: string;
  value?: number;
  method?: string;
  status?: string;
  uses?: number;
  start?: string;
  end?: string;
  hasEnd?: boolean;
};

export type AdminSnapshot = {
  name?: string;
  hostname?: string;
  currency?: string;
  sales?: number;
  orders?: OrderRecord[];
  products?: ProductRecord[];
  customers?: CustomerRecord[];
  discounts?: DiscountRecord[];
  collections?: CollectionRecord[];
  checkouts?: CheckoutRecord[];
  giftCards?: GiftCardRecord[];
  posts?: PostRecord[];
  marketing?: MarketingRecord;
  shipping?: ShippingRecord;
  policies?: PolicyRecord[];
};

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function owns(row: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(row, key);
}

function text(row: Record<string, unknown>, key: string) {
  if (!owns(row, key) || typeof row[key] !== "string") return undefined;
  return row[key];
}

function num(row: Record<string, unknown>, key: string) {
  if (!owns(row, key) || row[key] == null || row[key] === "") return undefined;
  const value = typeof row[key] === "number" ? row[key] : typeof row[key] === "string" ? Number(row[key]) : Number.NaN;
  return Number.isFinite(value) ? value : undefined;
}

function strings(row: Record<string, unknown>, key: string) {
  if (!owns(row, key) || !Array.isArray(row[key])) return undefined;
  return (row[key] as unknown[]).filter((item): item is string => typeof item === "string");
}

function flag(row: Record<string, unknown>, key: string) {
  if (!owns(row, key) || typeof row[key] !== "boolean") return undefined;
  return row[key];
}

function parseLine(value: unknown): OrderLine | null {
  const row = record(value);
  if (!row) return null;
  return {
    productId: text(row, "productId"),
    title: text(row, "title"),
    quantity: num(row, "quantity"),
    unitPrice: num(row, "unitPrice"),
    variant: text(row, "variant"),
    sku: text(row, "sku"),
  };
}

function parseTimeline(value: unknown): TimelineEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((entry) => {
    const row = record(entry);
    const body = row ? text(row, "text") : undefined;
    if (!row || !body) return [];
    return [{ text: body, at: text(row, "at") }];
  });
}

function parseOrder(value: unknown): OrderRecord | null {
  const row = record(value);
  const number = row ? num(row, "number") : undefined;
  if (!row || number == null || !Number.isInteger(number)) return null;
  const lines = Array.isArray(row.lines) ? row.lines.flatMap((line) => {
    const parsed = parseLine(line);
    return parsed ? [parsed] : [];
  }) : undefined;
  return {
    id: text(row, "id"),
    number,
    createdAt: text(row, "createdAt"),
    customerId: text(row, "customerId"),
    customerName: text(row, "customerName"),
    channel: text(row, "channel"),
    pay: text(row, "pay"),
    fulfillment: text(row, "fulfillment"),
    customerStatus: text(row, "customerStatus"),
    total: num(row, "total"),
    note: text(row, "note"),
    tags: strings(row, "tags"),
    discountCode: text(row, "discountCode"),
    discountAmount: num(row, "discountAmount"),
    shippingName: text(row, "shippingName"),
    shippingAmount: num(row, "shippingAmount"),
    refunded: num(row, "refunded"),
    carrier: text(row, "carrier"),
    tracking: text(row, "tracking"),
    timeline: owns(row, "timeline") ? parseTimeline(row.timeline) : undefined,
    lines: owns(row, "lines") ? lines : undefined,
  };
}

function parseProduct(value: unknown): ProductRecord | null {
  const row = record(value);
  const id = row ? text(row, "id") : undefined;
  if (!row || !id) return null;
  return {
    id,
    title: text(row, "title"),
    status: text(row, "status"),
    price: num(row, "price"),
    compareAt: num(row, "compareAt"),
    stock: num(row, "stock"),
    sku: text(row, "sku"),
    barcode: text(row, "barcode"),
    variant: text(row, "variant"),
    vendor: text(row, "vendor"),
    category: text(row, "category"),
    description: text(row, "description"),
  };
}

function parseCustomer(value: unknown): CustomerRecord | null {
  const row = record(value);
  const id = row ? text(row, "id") : undefined;
  if (!row || !id) return null;
  return {
    id,
    name: text(row, "name"),
    email: text(row, "email"),
    phone: text(row, "phone"),
    street: text(row, "street"),
    city: text(row, "city"),
    zip: text(row, "zip"),
    orders: num(row, "orders"),
    note: text(row, "note"),
    tags: strings(row, "tags"),
    createdAt: text(row, "createdAt"),
    subscribed: flag(row, "subscribed"),
  };
}

function parseDiscount(value: unknown): DiscountRecord | null {
  const row = record(value);
  const id = row ? text(row, "id") : undefined;
  if (!row || !id) return null;
  return {
    id,
    code: text(row, "code"),
    title: text(row, "title"),
    kind: text(row, "kind"),
    valueType: text(row, "valueType"),
    value: num(row, "value"),
    method: text(row, "method"),
    status: text(row, "status"),
    uses: num(row, "uses"),
    start: text(row, "start"),
    end: text(row, "end"),
    hasEnd: flag(row, "hasEnd"),
  };
}

function parseCollection(value: unknown): CollectionRecord | null {
  const row = record(value);
  const title = row ? text(row, "title") : undefined;
  if (!row || !title) return null;
  const id = text(row, "id") || title;
  return {
    id,
    title,
    description: text(row, "description"),
    productIds: strings(row, "productIds"),
    hidden: flag(row, "hidden"),
    image: text(row, "image"),
  };
}

function parseCheckout(value: unknown): CheckoutRecord | null {
  const row = record(value);
  const id = row ? text(row, "id") : undefined;
  if (!row || !id) return null;
  const lines = Array.isArray(row.lines) ? row.lines.flatMap((line) => {
    const parsed = parseLine(line);
    return parsed ? [parsed] : [];
  }) : undefined;
  return {
    id,
    updatedAt: text(row, "updatedAt"),
    name: text(row, "name"),
    email: text(row, "email"),
    phone: text(row, "phone"),
    street: text(row, "street"),
    city: text(row, "city"),
    zip: text(row, "zip"),
    subtotal: num(row, "subtotal"),
    shippingAmount: num(row, "shippingAmount"),
    total: num(row, "total"),
    reminded: flag(row, "reminded"),
    recovered: flag(row, "recovered"),
    lines: owns(row, "lines") ? lines : undefined,
  };
}

function parseGiftCard(value: unknown): GiftCardRecord | null {
  const row = record(value);
  const code = row ? text(row, "code") : undefined;
  if (!row || !code) return null;
  return {
    code,
    value: num(row, "value"),
    balance: owns(row, "balance") ? num(row, "balance") : num(row, "value"),
    customer: text(row, "customer"),
    expires: text(row, "expires"),
    note: text(row, "note"),
  };
}

function parsePost(value: unknown, index: number): PostRecord | null {
  const row = record(value);
  if (!row) return null;
  const rawId = text(row, "id") || (num(row, "id") != null ? String(num(row, "id")) : "") || text(row, "handle");
  const id = rawId || String(index + 1);
  return {
    id,
    title: text(row, "title"),
    excerpt: text(row, "excerpt"),
    body: text(row, "body"),
    author: text(row, "author"),
    updated: text(row, "updated"),
    blog: text(row, "blog"),
    visible: flag(row, "visible"),
    handle: text(row, "handle"),
  };
}

function blockText(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const parts = value.flatMap((entry) => {
    const row = record(entry);
    if (!row) return [];
    const body = text(row, "text") || text(row, "label") || text(row, "left");
    return body ? [body] : [];
  });
  return parts.length ? parts.join("\n") : undefined;
}

function parseEmail(value: unknown): MarketingEmailRecord | null {
  const row = record(value);
  const id = row ? text(row, "id") : undefined;
  if (!row || !id) return null;
  return {
    id,
    name: text(row, "name"),
    subject: text(row, "subject"),
    preview: text(row, "preview"),
    body: blockText(row.blocks) || text(row, "body"),
  };
}

function parseSms(value: unknown): MarketingSmsRecord | null {
  const row = record(value);
  const id = row ? text(row, "id") : undefined;
  if (!row || !id) return null;
  return { id, name: text(row, "name"), text: text(row, "text") };
}

function stepLabel(value: unknown): string | null {
  const row = record(value);
  const type = row ? text(row, "type") : undefined;
  if (!type) return null;
  if (type === "wait") return `המתנה ${text(row!, "value") ?? ""} ${text(row!, "unit") ?? ""}`.trim();
  if (type === "email") return "מייל";
  if (type === "sms") return "SMS";
  if (type === "cond") return "תנאי";
  if (type === "end") return "סיום";
  return type;
}

function parseFlow(value: unknown): FlowRecord | null {
  const row = record(value);
  const name = row ? text(row, "name") : undefined;
  if (!row || !name) return null;
  const rawId = text(row, "id") || (num(row, "id") != null ? String(num(row, "id")) : "");
  if (!rawId) return null;
  const steps = Array.isArray(row.steps) ? row.steps.flatMap((step) => {
    const label = stepLabel(step);
    return label ? [label] : [];
  }) : undefined;
  return { id: rawId, name, trigger: text(row, "trigger"), on: flag(row, "on"), steps: owns(row, "steps") ? steps : undefined };
}

function parseMarketing(value: unknown): MarketingRecord | undefined {
  const row = record(value);
  if (!row) return undefined;
  const marketing: MarketingRecord = {};
  if (owns(row, "emails")) marketing.emails = list(row.emails, parseEmail) ?? [];
  if (owns(row, "sms")) marketing.sms = list(row.sms, parseSms) ?? [];
  if (owns(row, "flows")) marketing.flows = list(row.flows, parseFlow) ?? [];
  if (owns(row, "connected")) {
    const connected = record(row.connected);
    marketing.connected = connected ? Object.keys(connected).filter((key) => {
      const item = record(connected[key]);
      if (!item) return false;
      return Boolean(text(item, "id") || text(item, "token") || text(item, "head") || text(item, "body"));
    }) : [];
  }
  return marketing;
}

function parseShipping(value: unknown): ShippingRecord | undefined {
  const row = record(value);
  if (!row) return undefined;
  const shipping: ShippingRecord = {};
  if (owns(row, "rules")) {
    shipping.rules = list(row.rules, (entry) => {
      const item = record(entry);
      const id = item ? text(item, "id") : undefined;
      if (!item || !id) return null;
      return { id, name: text(item, "name"), days: text(item, "days"), fee: text(item, "fee") };
    }) ?? [];
  }
  if (owns(row, "profiles")) {
    shipping.profiles = list(row.profiles, (entry) => {
      const item = record(entry);
      const id = item ? text(item, "id") : undefined;
      if (!item || !id) return null;
      return { id, name: text(item, "name") };
    }) ?? [];
  }
  if (owns(row, "estimates")) shipping.estimates = flag(row, "estimates");
  if (owns(row, "localDelivery")) shipping.localDelivery = flag(row, "localDelivery");
  if (owns(row, "pickup")) shipping.pickup = flag(row, "pickup");
  if (owns(row, "contact")) {
    const contact = record(row.contact);
    if (contact) {
      shipping.contact = {
        email: text(contact, "email"),
        phone: text(contact, "phone"),
        company: text(contact, "company"),
        street: text(contact, "street"),
        city: text(contact, "city"),
        zip: text(contact, "zip"),
      };
    }
  }
  return shipping;
}

function parsePolicies(value: unknown): PolicyRecord[] | undefined {
  const row = record(value);
  if (!row) return undefined;
  if (Array.isArray(row.items)) {
    return row.items.flatMap((entry) => {
      const item = record(entry);
      const id = item ? text(item, "id") : undefined;
      const title = item ? text(item, "title") : undefined;
      if (!item || !id || !title) return [];
      return [{ id, title, body: text(item, "body"), kind: text(item, "kind") }];
    });
  }
  return Object.entries(row).flatMap(([key, entry]) => {
    if (typeof entry !== "string" || !entry.trim()) return [];
    return [{ id: key, title: key, body: entry, kind: key }];
  });
}

function list<T>(value: unknown, parse: (item: unknown) => T | null): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const parsed = parse(item);
    return parsed ? [parsed] : [];
  });
}

export function parseSnapshot(value: unknown): AdminSnapshot {
  const row = record(value);
  if (!row) return {};
  const snapshot: AdminSnapshot = {};
  if (owns(row, "name") && typeof row.name === "string") snapshot.name = row.name;
  if (owns(row, "hostname") && typeof row.hostname === "string") snapshot.hostname = row.hostname;
  if (owns(row, "currency") && typeof row.currency === "string") snapshot.currency = row.currency;
  const sales = num(row, "sales");
  if (sales != null) snapshot.sales = sales;
  if (owns(row, "orders")) snapshot.orders = list(row.orders, parseOrder) ?? [];
  if (owns(row, "products")) snapshot.products = list(row.products, parseProduct) ?? [];
  if (owns(row, "customers")) snapshot.customers = list(row.customers, parseCustomer) ?? [];
  if (owns(row, "discounts")) snapshot.discounts = list(row.discounts, parseDiscount) ?? [];
  if (owns(row, "collections")) snapshot.collections = list(row.collections, parseCollection) ?? [];
  if (owns(row, "checkouts")) snapshot.checkouts = list(row.checkouts, parseCheckout) ?? [];
  if (owns(row, "giftCards")) snapshot.giftCards = list(row.giftCards, parseGiftCard) ?? [];
  if (owns(row, "posts") && Array.isArray(row.posts)) {
    snapshot.posts = row.posts.flatMap((item, index) => {
      const parsed = parsePost(item, index);
      return parsed ? [parsed] : [];
    });
  }
  if (owns(row, "marketing")) snapshot.marketing = parseMarketing(row.marketing);
  if (owns(row, "shipping")) snapshot.shipping = parseShipping(row.shipping);
  if (owns(row, "policies")) snapshot.policies = parsePolicies(row.policies);
  return snapshot;
}

/** Matches the admin "פתוחות" tab: fulfilled and not waiting for payment is closed. */
export function isOpenOrder(order: OrderRecord) {
  if (!order.fulfillment) return false;
  if (order.fulfillment !== "fulfilled") return true;
  return order.pay === "pending";
}

export function sortedOrders(orders: OrderRecord[]) {
  return [...orders].sort((a, b) => {
    const at = Date.parse(a.createdAt ?? "");
    const bt = Date.parse(b.createdAt ?? "");
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
    return b.number - a.number;
  });
}

export function openOrderCount(orders: OrderRecord[] | undefined) {
  if (!orders) return undefined;
  return orders.filter(isOpenOrder).length;
}
