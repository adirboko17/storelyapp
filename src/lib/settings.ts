import { File } from "expo-file-system";
import { readPublicSupabaseConfig } from "@/lib/config";
import { hebrewError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import type { PolicyRecord, ShippingRecord, ShipProfileRecord, StoreContact } from "@/lib/snapshot";

export const CURRENCIES = [
  { code: "ILS", label: "שקל חדש (ILS ₪)" },
  { code: "USD", label: "דולר אמריקאי (USD $)" },
  { code: "EUR", label: "אירו (EUR €)" },
] as const;

export type StoreCurrency = (typeof CURRENCIES)[number]["code"];

export const BRAND_COLORS = ["#1a1a1a", "#303030", "#ffffff", "#8e1f0b", "#0c5132", "#005bd3", "#5b3fc4"];

export const BUILTIN_POLICIES = [
  { kind: "return", title: "מדיניות החזרות והחזרים" },
  { kind: "privacy", title: "מדיניות פרטיות" },
  { kind: "terms", title: "תנאי שימוש" },
  { kind: "shipping", title: "מדיניות משלוחים" },
  { kind: "contact", title: "פרטי יצירת קשר" },
  { kind: "legal", title: "הודעה משפטית" },
  { kind: "purchase", title: "מדיניות ביטול אפשרויות רכישה", required: true },
] as const;

export type PolicySurface = "hidden" | "link" | "checkbox";

export type EditablePolicy = {
  id: string;
  kind: string;
  title: string;
  body: string;
  footer: boolean;
  cart: PolicySurface;
  checkout: PolicySurface;
  required: boolean;
};

export type StoreSettingsRow = {
  name: string;
  logo: string;
  colors: string[];
  currency: StoreCurrency;
};

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("אין חיבור לשרת.");
  return supabase;
}

function isCurrency(value: unknown): value is StoreCurrency {
  return value === "ILS" || value === "USD" || value === "EUR";
}

function isSurface(value: unknown): value is PolicySurface {
  return value === "hidden" || value === "link" || value === "checkbox";
}

export function normalizeColors(value: unknown) {
  const saved = Array.isArray(value) ? value : [];
  return BRAND_COLORS.map((fallback, index) => {
    const color = saved[index];
    return typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
  });
}

export function emptyContact(contact?: StoreContact): Required<StoreContact> {
  return {
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    addressMode: contact?.addressMode === "physical" ? "physical" : "none",
    company: contact?.company ?? "",
    country: contact?.country || "ישראל",
    street: contact?.street ?? "",
    apartment: contact?.apartment ?? "",
    zip: contact?.zip ?? "",
    city: contact?.city ?? "",
  };
}

export function addressSummary(contact?: StoreContact) {
  const current = emptyContact(contact);
  if (current.addressMode !== "physical") return "חנות אונליין בלבד, ללא כתובת";
  const parts = [current.street, current.city].map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : "לא הוגדרה כתובת";
}

export function profileSummary(profile: ShipProfileRecord) {
  const zones = profile.zones ?? [];
  if (!zones.length) return "עדיין אין יעד ומחיר";
  const places = zones.map((zone) => zone.name).filter(Boolean).join(", ");
  const rate = zones.flatMap((zone) => zone.rates).find((item) => item.price.trim() || item.name.trim());
  const price = !rate ? "בלי מחיר" : rate.price.trim() ? `₪${rate.price}` : "חינם";
  return [places, price].filter(Boolean).join(" · ");
}

export function policyPlain(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function plainToPolicy(text: string) {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blocks = text.trim().split(/\n{2,}/).filter((block) => block.trim());
  if (!blocks.length) return "";
  return blocks.map((block) => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`).join("");
}

export function policyPlacement(policy: Pick<EditablePolicy, "footer" | "cart" | "checkout">) {
  const parts: string[] = [];
  if (policy.footer) parts.push("פוטר");
  if (policy.cart === "link") parts.push("עגלה · קישור");
  if (policy.cart === "checkbox") parts.push("עגלה · קראתי");
  if (policy.checkout === "link") parts.push("תשלום · קישור");
  if (policy.checkout === "checkbox") parts.push("תשלום · קראתי");
  return parts.length ? parts.join(" · ") : "לא מוצג באתר";
}

export function storePolicies(rows: PolicyRecord[] | undefined): EditablePolicy[] {
  const defaults: EditablePolicy[] = BUILTIN_POLICIES.map((item) => ({
    id: item.kind,
    kind: item.kind,
    title: item.title,
    body: "",
    footer: true,
    cart: "hidden",
    checkout: "link",
    required: "required" in item && item.required === true,
  }));
  const byKind = new Map<string, EditablePolicy>();
  const custom: EditablePolicy[] = [];
  for (const row of rows ?? []) {
    const builtin = BUILTIN_POLICIES.find((item) => item.kind === row.kind || item.kind === row.id);
    const kind = row.kind === "custom" ? "custom" : builtin?.kind ?? "";
    if (!kind || !row.id) continue;
    const fallback = defaults.find((item) => item.kind === kind);
    const title = row.title.trim() && row.title !== kind && row.title !== row.id ? row.title.trim() : fallback?.title ?? row.title;
    const policy: EditablePolicy = {
      id: row.id,
      kind,
      title,
      body: row.body ?? "",
      footer: typeof row.footer === "boolean" ? row.footer : fallback?.footer ?? false,
      cart: isSurface(row.cart) ? row.cart : fallback?.cart ?? "hidden",
      checkout: isSurface(row.checkout) ? row.checkout : fallback?.checkout ?? "hidden",
      required: fallback?.required ?? false,
    };
    if (kind === "custom") custom.push(policy);
    else byKind.set(kind, policy);
  }
  return [...defaults.map((item) => byKind.get(item.kind) ?? item), ...custom];
}

export function policyTemplate(kind: string, storeName: string, contact: string) {
  const name = storeName.trim() || "החנות";
  const reach = contact.trim();
  const pages: Record<string, string> = {
    return: `<p><strong>החזרות</strong></p><p>אפשר לבקש החזרה מ${name} לפי חלון ההחזרה שמוגדר בחנות. המוצר צריך לחזור במצב שאפשר למכור אותו מחדש.</p>`,
    privacy: `<p><strong>פרטיות</strong></p><p>${name} שומרת פרטי הזמנה ופרטי קשר כדי לטפל בהזמנה ולשלוח עדכונים. הפרטים לא נמכרים.</p>`,
    terms: `<p><strong>תנאי שימוש</strong></p><p>השימוש באתר של ${name} מהווה הסכמה לתנאים האלה. המחירים והמלאי המוצגים באתר הם אלה שבתוקף בזמן ההזמנה.</p>`,
    shipping: `<p><strong>משלוחים</strong></p><p>${name} מחשבת משלוח לפי אזור היעד ואפשרויות המשלוח שמוגדרות בחנות.</p>`,
    contact: `<p><strong>יצירת קשר</strong></p><p>${name}${reach ? ` · ${reach}` : ""}</p>`,
    legal: `<p><strong>הודעה משפטית</strong></p><p>התכנים באתר של ${name} מוצגים כפי שהם, והחנות יכולה לעדכן אותם.</p>`,
    purchase: `<p><strong>ביטול רכישה</strong></p><p>אפשר לבטל רכישה מ${name} כל עוד ההזמנה לא נשלחה, לפי הכללים שמופיעים כאן.</p>`,
    custom: `<p><strong>תקנון</strong></p><p>התקנון הזה של ${name} מסביר את הכללים שחלים על השימוש באתר ועל הרכישה.</p>`,
  };
  return pages[kind] ?? pages.custom ?? "";
}

function shippingPayload(shipping: ShippingRecord) {
  const contact = emptyContact(shipping.contact);
  const physical = contact.addressMode === "physical";
  return {
    rules: (shipping.rules ?? []).map((rule) => ({ id: rule.id, name: rule.name ?? "", days: rule.days ?? "", fee: rule.fee ?? "" })),
    profiles: (shipping.profiles ?? []).map((profile) => ({
      id: profile.id,
      name: profile.name?.trim() || "משלוח",
      location: profile.location ? { name: profile.location.name, address: profile.location.address } : null,
      zones: (profile.zones ?? []).map((zone) => ({
        id: zone.id,
        name: zone.name,
        country: zone.country,
        rates: zone.rates.map((rate) => ({ id: rate.id, name: rate.name, price: rate.price })),
      })),
    })),
    estimates: shipping.estimates === true,
    localDelivery: shipping.localDelivery === true,
    pickup: shipping.pickup === true,
    contact: {
      ...contact,
      street: physical ? contact.street : "",
      apartment: physical ? contact.apartment : "",
      zip: physical ? contact.zip : "",
      city: physical ? contact.city : "",
    },
  };
}

function policiesPayload(policies: EditablePolicy[]) {
  const legacy = Object.fromEntries(BUILTIN_POLICIES.map((item) => [item.kind, policies.find((policy) => policy.kind === item.kind)?.body ?? ""]));
  return {
    version: 2,
    items: policies.map((policy) => ({
      id: policy.id,
      kind: policy.kind,
      title: policy.title.trim() || "תקנון",
      body: policy.body,
      footer: policy.footer,
      cart: policy.cart,
      checkout: policy.checkout,
    })),
    ...legacy,
  };
}

export async function loadStoreSettings(storeId: string): Promise<StoreSettingsRow> {
  const { data, error } = await client()
    .from("store_settings")
    .select("display_name, logo_url, brand_colors, currency")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(hebrewError(error));
  const row = (data ?? {}) as Record<string, unknown>;
  const logo = typeof row.logo_url === "string" ? row.logo_url.trim() : "";
  return {
    name: typeof row.display_name === "string" ? row.display_name : "",
    logo: logo.startsWith("https://") ? logo : "",
    colors: normalizeColors(row.brand_colors),
    currency: isCurrency(row.currency) ? row.currency : "ILS",
  };
}

export async function saveStoreName(storeId: string, name: string) {
  const next = name.trim();
  if (next.length < 2) throw new Error("הזינו שם עסק");
  const { data, error } = await client().from("store_settings").update({ display_name: next }).eq("store_id", storeId).select("display_name").maybeSingle();
  if (error || !data) throw new Error(error ? hebrewError(error) : "שמירת שם החנות נכשלה");
  return next;
}

export async function saveStoreCurrency(storeId: string, currency: StoreCurrency) {
  const { data, error } = await client().from("store_settings").update({ currency }).eq("store_id", storeId).select("currency").maybeSingle();
  if (error || !data) throw new Error(error ? hebrewError(error) : "שמירת המטבע נכשלה");
}

export async function saveMenuName(name: string) {
  const next = name.trim();
  if (next.length < 2) throw new Error("הזינו שם");
  const { data, error } = await client().rpc("set_my_menu_name", { next_name: next });
  if (error || typeof data !== "string") throw new Error(error ? hebrewError(error) : "שמירת השם נכשלה");
  return data;
}

export async function saveBrandColors(storeId: string, colors: string[]) {
  const next = normalizeColors(colors);
  const { error } = await client().rpc("save_store_brand_colors", { target_store: storeId, colors: next });
  if (error) throw new Error(hebrewError(error));
  return next;
}

export async function saveStoreLogo(storeId: string, logoUrl: string) {
  const { error } = await client().rpc("save_store_logo", { target_store: storeId, logo_url: logoUrl });
  if (error) throw new Error(hebrewError(error));
}

export async function uploadStoreLogo(storeId: string, uri: string, mime?: string) {
  const type = mime === "image/jpg" ? "image/jpeg" : mime && IMAGE_TYPES[mime] ? mime : guessedType(uri);
  const extension = IMAGE_TYPES[type];
  if (!extension) throw new Error("אפשר להעלות תמונות jpg, png, webp, gif או avif.");
  const bytes = await new File(uri).arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("התמונה גדולה מ-5MB");
  const path = `${storeId}/brand/${stamp()}.${extension}`;
  const { error } = await client().storage.from("email-media").upload(path, bytes, { contentType: type, upsert: false });
  if (error) throw new Error("העלאת הלוגו נכשלה");
  const base = readPublicSupabaseConfig().url.replace(/\/$/, "");
  const url = `${base}/storage/v1/object/public/email-media/${path}`;
  await saveStoreLogo(storeId, url);
  return url;
}

export async function saveShipping(storeId: string, shipping: ShippingRecord) {
  const { error } = await client().rpc("save_store_sections", { target_store: storeId, sections: { shipping: shippingPayload(shipping) } });
  if (error) throw new Error(hebrewError(error));
}

export async function savePolicies(storeId: string, policies: EditablePolicy[]) {
  const { error } = await client().rpc("save_store_sections", { target_store: storeId, sections: { policies: policiesPayload(policies) } });
  if (error) throw new Error(hebrewError(error));
}

function guessedType(uri: string) {
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  const type = `image/${extension}`;
  return IMAGE_TYPES[type] ? type : "";
}

function stamp() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
