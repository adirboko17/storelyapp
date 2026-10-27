import { File } from "expo-file-system";
import { readPublicSupabaseConfig } from "@/lib/config";
import { hebrewError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";

export type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  author: string;
  updated: string;
  blog: string;
  visible: boolean;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  handle: string;
  template: string;
  image: string;
};

export type EventStatus = "draft" | "open" | "full" | "ended" | "cancelled";

export type StoreEvent = {
  id: string;
  slug: string;
  title: string;
  short: string;
  body: string;
  date: string;
  from: string;
  to: string;
  online: boolean;
  address: string;
  price: number;
  status: EventStatus;
  image: string;
  zoomUrl: string;
};

export const BLOGS = ["חדשות", "בלוג החנות", "מאחורי הקלעים"];
export const TEMPLATES = ["פוסט בלוג ברירת מחדל", "פוסט בלוג מלא"];
export const EVENT_STATUSES: { id: EventStatus; label: string; hint: string }[] = [
  { id: "draft", label: "טיוטה", hint: "לא מופיע באתר" },
  { id: "open", label: "פתוח", hint: "מופיע באתר ופתוח להרשמה" },
  { id: "full", label: "מלא", hint: "מופיע באתר, ההרשמה סגורה" },
  { id: "ended", label: "הסתיים", hint: "מופיע באתר כאירוע שעבר" },
  { id: "cancelled", label: "בוטל", hint: "מופיע באתר כמבוטל" },
];

const BUCKET = "product-media";
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("אין חיבור לשרת.");
  return supabase;
}

function text(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function tagsOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asPost(row: Record<string, unknown>, index: number): BlogPost {
  const id = text(row, "id") || String(index + 1);
  return {
    id,
    title: text(row, "title"),
    excerpt: text(row, "excerpt"),
    body: text(row, "body"),
    author: text(row, "author"),
    updated: text(row, "updated"),
    blog: text(row, "blog") || BLOGS[0],
    visible: row.visible !== false,
    tags: tagsOf(row.tags),
    seoTitle: text(row, "seoTitle"),
    seoDescription: text(row, "seoDescription"),
    handle: text(row, "handle"),
    template: text(row, "template") || TEMPLATES[0],
    image: text(row, "image"),
  };
}

async function rawPosts(storeId: string) {
  const { data, error } = await client().rpc("store_admin_slice", { target_store: storeId, slice: "content" });
  if (error) throw new Error(hebrewError(error));
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const posts = Array.isArray(row.posts) ? row.posts : [];
  return posts.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

export async function loadBlogPosts(storeId: string) {
  const posts = await rawPosts(storeId);
  return posts.map(asPost);
}

function nextPostId(posts: Record<string, unknown>[]) {
  const numbers = posts.map((post) => Number(post.id)).filter((value) => Number.isInteger(value) && value > 0);
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

function writtenPost(raw: Record<string, unknown>, draft: BlogPost, id: string | number) {
  const next: Record<string, unknown> = {
    ...raw,
    id,
    title: draft.title.trim(),
    excerpt: draft.excerpt.trim(),
    body: draft.body,
    author: draft.author.trim(),
    updated: draft.updated.trim(),
    blog: draft.blog.trim() || BLOGS[0],
    visible: draft.visible,
    tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
    seoTitle: draft.seoTitle.trim().slice(0, 70),
    seoDescription: draft.seoDescription.trim().slice(0, 160),
    handle: draft.handle.trim(),
    template: draft.template.trim() || TEMPLATES[0],
    image: draft.image.trim(),
  };
  if (text(raw, "image") !== draft.image.trim()) {
    next.imageX = 50;
    next.imageY = 50;
    next.imageScale = 1;
  }
  return next;
}

async function writePosts(storeId: string, posts: Record<string, unknown>[]) {
  const { error } = await client().rpc("save_store_sections", { target_store: storeId, sections: { posts } });
  if (error) throw new Error(hebrewError(error));
}

export async function saveBlogPost(storeId: string, draft: BlogPost, creating: boolean) {
  if (!draft.title.trim()) throw new Error("יש להזין כותרת");
  const posts = await rawPosts(storeId);
  if (creating) {
    const id = nextPostId(posts);
    await writePosts(storeId, [writtenPost({
      productId: "",
      productNote: "",
      tone: "",
      imageX: 50,
      imageY: 50,
      imageScale: 1,
      video: "",
    }, draft, id), ...posts]);
    return String(id);
  }
  const index = posts.findIndex((post, item) => (text(post, "id") || String(item + 1)) === draft.id);
  if (index < 0) throw new Error("הפוסט לא נמצא.");
  const current = posts[index];
  if (!current) throw new Error("הפוסט לא נמצא.");
  const id = typeof current.id === "number" || typeof current.id === "string" ? current.id : draft.id;
  const next = posts.slice();
  next[index] = writtenPost(current, draft, id);
  await writePosts(storeId, next);
  return draft.id;
}

export async function deleteBlogPost(storeId: string, id: string) {
  const posts = await rawPosts(storeId);
  const next = posts.filter((post, index) => (text(post, "id") || String(index + 1)) !== id);
  if (next.length === posts.length) throw new Error("הפוסט לא נמצא.");
  await writePosts(storeId, next);
}

function asStatus(value: string): EventStatus {
  if (value === "open" || value === "full" || value === "ended" || value === "cancelled" || value === "draft") return value;
  return "draft";
}

function asEvent(row: Record<string, unknown>): StoreEvent | null {
  if (typeof row.id !== "string" || typeof row.title !== "string") return null;
  const body = Array.isArray(row.body) ? row.body.filter((item): item is string => typeof item === "string").join("\n\n") : "";
  return {
    id: row.id,
    slug: text(row, "slug"),
    title: row.title,
    short: text(row, "short"),
    body,
    date: text(row, "event_date").slice(0, 10),
    from: text(row, "starts_at").slice(0, 5),
    to: text(row, "ends_at").slice(0, 5),
    online: row.online === true,
    address: text(row, "address"),
    price: Number.isFinite(Number(row.price)) ? Math.round(Number(row.price)) : 0,
    status: asStatus(text(row, "status")),
    image: text(row, "image").startsWith("https://") ? text(row, "image") : "",
    zoomUrl: text(row, "zoom_url"),
  };
}

export function blankEvent(): StoreEvent {
  return {
    id: "",
    slug: "",
    title: "",
    short: "",
    body: "",
    date: "",
    from: "20:00",
    to: "21:30",
    online: true,
    address: "",
    price: 0,
    status: "draft",
    image: "",
    zoomUrl: "",
  };
}

export function eventProblem(event: StoreEvent) {
  const title = event.title.trim();
  const slug = event.slug.trim().toLowerCase();
  if (title.length < 1 || title.length > 120) return "השם צריך להיות עד 120 תווים";
  if (event.short.trim().length > 280) return "התיאור הקצר צריך להיות עד 280 תווים";
  if (/[<>]/.test(event.body)) return "התיאור המלא הוא טקסט בלי HTML";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "הכתובת יכולה להכיל אותיות לטיניות, מספרים ומקף";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return "צריך תאריך";
  if (!/^\d{2}:\d{2}$/.test(event.from) || !/^\d{2}:\d{2}$/.test(event.to)) return "צריך שעת התחלה ושעת סיום";
  if (event.to <= event.from) return "שעת הסיום צריכה להיות אחרי שעת ההתחלה";
  if (!event.online && !event.address.trim()) return "למפגש פרונטלי צריך כתובת";
  if (event.online && event.zoomUrl.trim() && !event.zoomUrl.trim().startsWith("https://")) return "קישור הזום צריך להתחיל ב-https";
  if (!Number.isInteger(event.price) || event.price < 0 || event.price > 1000000) return "המחיר הוא מספר שלם";
  return null;
}

export function eventParagraphs(value: string) {
  const paragraphs = value.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  if (paragraphs.some((paragraph) => paragraph.length > 2000)) throw new Error("פסקה ארוכה מדי");
  return paragraphs;
}

export async function loadStoreEvent(storeId: string, id: string) {
  const { data, error } = await client()
    .from("store_events")
    .select("id, slug, title, short, body, event_date, starts_at, ends_at, online, address, price, status, image, zoom_url")
    .eq("store_id", storeId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(hebrewError(error));
  return data ? asEvent(data as Record<string, unknown>) : null;
}

export async function saveStoreEvent(storeId: string, event: StoreEvent) {
  const problem = eventProblem(event);
  if (problem) throw new Error(problem);
  const paragraphs = eventParagraphs(event.body);
  if (paragraphs.length > 40) throw new Error("יותר מדי פסקאות");
  const id = event.id || uuid();
  const online = event.online;
  const row = {
    id,
    store_id: storeId,
    slug: event.slug.trim().toLowerCase(),
    title: event.title.trim(),
    short: event.short.trim(),
    body: paragraphs,
    event_date: event.date,
    starts_at: event.from,
    ends_at: event.to,
    online,
    address: online ? null : event.address.trim(),
    price: event.price,
    status: event.status,
    image: event.image.trim().startsWith("https://") ? event.image.trim() : null,
    zoom_url: online && event.zoomUrl.trim() ? event.zoomUrl.trim() : null,
  };
  const { error } = await client().from("store_events").upsert(row, { onConflict: "id" });
  if (error) {
    if (error.code === "23505") throw new Error("הכתובת כבר בשימוש");
    throw new Error(hebrewError(error));
  }
  return id;
}

export async function deleteStoreEvent(storeId: string, id: string) {
  const { error } = await client().from("store_events").delete().eq("store_id", storeId).eq("id", id);
  if (error) throw new Error(hebrewError(error));
}

function imageType(uri: string, mime: string | undefined) {
  const type = mime === "image/jpg" ? "image/jpeg" : mime ?? "";
  if (IMAGE_TYPES[type]) return type;
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  const guessed = `image/${extension}`;
  return IMAGE_TYPES[guessed] ? guessed : "";
}

export async function uploadContentImage(storeId: string, folder: "posts" | "events", uri: string, mime?: string) {
  const type = imageType(uri, mime);
  if (!type) throw new Error("אפשר להעלות תמונות jpg, png, webp, gif או avif.");
  const config = readPublicSupabaseConfig();
  if (config.problem || !config.url) throw new Error("אין חיבור לשרת.");
  const path = `${storeId}/${folder}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${IMAGE_TYPES[type]}`;
  const bytes = await new File(uri).arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("התמונה גדולה מ-5MB");
  const { error } = await client().storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (error) throw new Error("העלאת התמונה נכשלה.");
  return `${config.url.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;
}
