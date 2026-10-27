import { File } from "expo-file-system";
import { hebrewError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import type { ProductBundle, ProductRecord } from "@/lib/snapshot";

export type ProductStatus = "active" | "draft" | "archived";
export type RawPage = Record<string, unknown>;

export type ProductDraft = {
  title: string;
  status: ProductStatus;
  description: string;
  price: number;
  compareAt: number | null;
  cost: number;
  stock: number;
  sku: string;
  barcode: string;
  variant: string;
  vendor: string;
  category: string;
  subcategories: string[];
  tags: string[];
  media: string[];
  bundles: ProductBundle[];
  page: RawPage;
  badge: string;
  badgeHidden: boolean;
  seoTitle: string;
  seoDescription: string;
  handle: string;
};

export type PickedMedia = Record<string, string>;

const BUCKET = "product-media";
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
const SUBCATEGORY_PREFIX = "\u0001sub:";
const HANDLE_TAKEN = "הכתובת כבר בשימוש";
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
const STATUSES: ProductStatus[] = ["active", "draft", "archived"];

function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function isLocalMedia(uri: string) {
  return !/^https:\/\//i.test(uri);
}

export function isVideoMedia(uri: string) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(uri);
}

export function slugify(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .slice(0, 60);
}

export function draftFrom(product: ProductRecord | null): ProductDraft {
  const status = STATUSES.find((item) => item === product?.status) ?? "draft";
  return {
    title: product?.title ?? "",
    status,
    description: product?.description ?? "",
    price: product?.price ?? 0,
    compareAt: product?.compareAt ?? null,
    cost: product?.cost ?? 0,
    stock: product?.stock ?? 0,
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    variant: product?.variant ?? "",
    vendor: product?.vendor ?? "",
    category: product?.category ?? "",
    subcategories: product?.subcategories ?? [],
    tags: product?.tags ?? [],
    media: product?.media ?? [],
    bundles: product?.bundles ?? [],
    page: record(product?.merch?.page) ?? {},
    badge: product?.badge ?? "",
    badgeHidden: product?.badgeHidden === true,
    seoTitle: product?.seoTitle ?? "",
    seoDescription: product?.seoDescription ?? "",
    handle: product?.handle ?? "",
  };
}

function packTags(rawTags: string[] | undefined, tags: string[], subcategories: string[]) {
  const hidden = (rawTags ?? []).filter((tag) => tag.startsWith("\u0001") && !tag.startsWith(SUBCATEGORY_PREFIX));
  const visible = [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag && !tag.startsWith("\u0001")))];
  const encoded = [...new Set(subcategories.map((name) => name.trim()).filter(Boolean))].map((name) => `${SUBCATEGORY_PREFIX}${name}`);
  return [...visible, ...encoded, ...hidden];
}

function cleanBundles(bundles: ProductBundle[]) {
  return bundles.map((bundle) => ({
    qty: bundle.qty,
    price: Math.round(bundle.price * 100) / 100,
    label: bundle.label.trim(),
    ...(bundle.image ? { image: bundle.image } : {}),
    ...(bundle.tag?.trim() ? { tag: bundle.tag.trim() } : {}),
  }));
}

function buildMerch(source: ProductRecord | null, draft: ProductDraft, handle: string) {
  return {
    bundles: cleanBundles(draft.bundles),
    page: draft.page,
    badge: { label: draft.badge.trim().slice(0, 24), hidden: draft.badgeHidden },
    headline: record(source?.merch?.headline) ?? { mode: "single", subtitle: "" },
    seo: { title: draft.seoTitle.trim().slice(0, 70), description: draft.seoDescription.trim().slice(0, 160) },
    ...(handle ? { handle } : {}),
  };
}

function storedPath(url: string, storeId: string, productId: string) {
  const index = url.indexOf(MARKER);
  if (index < 0) return null;
  const path = decodeURIComponent(url.slice(index + MARKER.length).split("?")[0] ?? "");
  return path.startsWith(`${storeId}/${productId}/`) ? path : null;
}

function mediaType(uri: string, mime: string | undefined) {
  const type = mime === "image/jpg" ? "image/jpeg" : mime ?? "";
  if (EXTENSIONS[type]) return type;
  const extension = uri.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  const guessed = `image/${extension}`;
  return EXTENSIONS[guessed] ? guessed : "";
}

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("אין חיבור לשרת.");
  return supabase;
}

async function saveMedia(storeId: string, productId: string, draft: ProductDraft, picked: PickedMedia) {
  const supabase = client();
  const storage = supabase.storage.from(BUCKET);
  const paths: string[] = [];
  const uploaded: string[] = [];
  try {
    for (const item of draft.media) {
      if (!isLocalMedia(item)) {
        paths.push(storedPath(item, storeId, productId) ?? item);
        continue;
      }
      const type = mediaType(item, picked[item]);
      if (!type) throw new Error("אפשר להעלות תמונות jpg, png, webp, gif או avif.");
      const path = `${storeId}/${productId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}.${EXTENSIONS[type]}`;
      const bytes = await new File(item).arrayBuffer();
      const { error } = await storage.upload(path, bytes, { contentType: type, upsert: false });
      if (error) throw new Error("העלאת התמונה נכשלה.");
      uploaded.push(path);
      paths.push(path);
    }
    const { data, error } = await supabase.rpc("save_store_product_media", { target_store: storeId, product_id: productId, media_paths: paths });
    if (error) throw new Error(hebrewError(error));
    const bundleImages = new Set(draft.bundles.flatMap((bundle) => {
      const path = bundle.image ? storedPath(bundle.image, storeId, productId) : null;
      return path ? [path] : [];
    }));
    const stale = Array.isArray(data)
      ? data.filter((path): path is string => typeof path === "string" && !/^https?:\/\//i.test(path) && !bundleImages.has(path))
      : [];
    if (stale.length) await storage.remove(stale);
  } catch (failure) {
    if (uploaded.length) await storage.remove(uploaded);
    throw failure;
  }
}

async function saveMerch(storeId: string, productId: string, merch: ReturnType<typeof buildMerch>) {
  const supabase = client();
  const { error } = await supabase.rpc("save_store_product_merch", { target_store: storeId, product_id: productId, merch });
  if (error) throw new Error(hebrewError(error));
}

export class PartialSave extends Error {
  productId: string;

  constructor(message: string, productId: string) {
    super(message);
    this.productId = productId;
  }
}

export async function saveProduct(storeId: string, source: ProductRecord | null, draft: ProductDraft, picked: PickedMedia) {
  if (draft.media.some((item) => isLocalMedia(item) && !mediaType(item, picked[item]))) {
    throw new Error("אפשר להעלות תמונות jpg, png, webp, gif או avif.");
  }
  const supabase = client();
  const { data, error } = await supabase.rpc("save_store_product", {
    target_store: storeId,
    product_id: source?.id ?? null,
    product_title: draft.title.trim(),
    product_status: draft.status,
    product_price: draft.price,
    product_compare: draft.compareAt,
    product_cost: draft.cost,
    product_vendor: draft.vendor.trim(),
    product_category: draft.category.trim(),
    product_description: draft.description,
    product_tags: packTags(source?.rawTags, draft.tags, draft.subcategories),
    product_sku: draft.sku.trim(),
    product_barcode: draft.barcode.trim() || null,
    product_stock: draft.stock,
    variant_title: draft.variant.trim(),
  });
  if (error) throw new Error(hebrewError(error));
  if (typeof data !== "string" || !data) throw new Error("שמירת המוצר נכשלה.");
  const productId = data;
  try {
    await saveExtras(storeId, productId, source, draft, picked);
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : "חלק מהשינויים לא נשמרו.";
    throw source ? new Error(message) : new PartialSave(message, productId);
  }
  return productId;
}

async function saveExtras(storeId: string, productId: string, source: ProductRecord | null, draft: ProductDraft, picked: PickedMedia) {
  const before = draftFrom(source);
  const typed = draft.handle.trim() && draft.handle.trim() !== source?.handle ? slugify(draft.handle) : "";
  const handle = typed || (source?.handle ? "" : slugify(draft.title));
  const merch = buildMerch(source, draft, handle);
  if (!source || JSON.stringify(merch) !== JSON.stringify(buildMerch(source, before, ""))) {
    try {
      await saveMerch(storeId, productId, merch);
    } catch (failure) {
      if (source || !handle || !(failure instanceof Error) || !failure.message.includes(HANDLE_TAKEN)) throw failure;
      await saveMerch(storeId, productId, { ...merch, handle: `${handle.slice(0, 54)}-${productId.slice(0, 5)}` });
    }
  }
  if (JSON.stringify(draft.media) !== JSON.stringify(before.media)) {
    await saveMedia(storeId, productId, draft, picked);
  }
}
