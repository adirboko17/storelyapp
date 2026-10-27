import { hebrewError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";

export type SaleVariant = { id: string; title: string; price: number; stock: number };
export type SaleProduct = { id: string; title: string; image?: string; variants: SaleVariant[] };

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("אין חיבור לשרת.");
  return supabase;
}

function payload(data: unknown) {
  return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
}

function fail(data: Record<string, unknown>): never {
  const reason = typeof data.reason === "string" && data.reason.trim() ? data.reason : "הפעולה נכשלה.";
  throw new Error(reason);
}

export function paymentLink(hostname: string | undefined, checkoutId: string) {
  const host = (hostname ?? "").trim().replace(/^https?:\/\//i, "").split("/")[0]?.trim() ?? "";
  if (!host || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(checkoutId)) return "";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || host.endsWith(".localhost");
  return `${local ? "http" : "https"}://${host}/checkout?recover=${checkoutId}`;
}

export async function loadSaleCatalog(storeId: string) {
  const { data, error } = await client().rpc("store_sale_catalog", { target_store: storeId });
  if (error) throw new Error(hebrewError(error));
  const row = payload(data);
  if (row.ok !== true) fail(row);
  const products = Array.isArray(row.products) ? row.products : [];
  return products.flatMap((item): SaleProduct[] => {
    const product = payload(item);
    const id = typeof product.id === "string" ? product.id : "";
    const title = typeof product.title === "string" ? product.title : "";
    if (!id || !title) return [];
    const variants = Array.isArray(product.variants) ? product.variants.flatMap((entry): SaleVariant[] => {
      const variant = payload(entry);
      const variantId = typeof variant.id === "string" ? variant.id : "";
      const price = Number(variant.price);
      const stock = Number(variant.stock);
      if (!variantId || !Number.isFinite(price)) return [];
      return [{ id: variantId, title: typeof variant.title === "string" ? variant.title : "", price, stock: Number.isFinite(stock) ? stock : 0 }];
    }) : [];
    if (!variants.length) return [];
    const image = typeof product.image === "string" && product.image.startsWith("https://") ? product.image : undefined;
    return [{ id, title, image, variants }];
  });
}

export async function createPaymentLink(
  storeId: string,
  lines: { variantId: string; quantity: number; unitPrice: number }[],
  customAmount: number,
  shippingAmount: number,
) {
  const { data, error } = await client().rpc("create_store_payment_link", {
    target_store: storeId,
    sale_lines: lines,
    custom_amount: customAmount,
    shipping_amount: shippingAmount,
  });
  if (error) throw new Error(hebrewError(error));
  const row = payload(data);
  if (row.ok !== true || typeof row.id !== "string") fail(row);
  return { id: row.id, total: Number(row.total) };
}

export async function paymentLinkStatus(storeId: string, checkoutId: string) {
  const { data, error } = await client().rpc("store_payment_link_status", { target_store: storeId, checkout_id: checkoutId });
  if (error) throw new Error(hebrewError(error));
  const row = payload(data);
  if (row.ok !== true) fail(row);
  const orderNumber = Number(row.orderNumber);
  return { recovered: row.recovered === true, orderNumber: Number.isInteger(orderNumber) ? orderNumber : undefined };
}

export async function placeCashSale(
  storeId: string,
  lines: { variantId: string; quantity: number; unitPrice: number }[],
  customAmount: number,
  shippingAmount: number,
) {
  const { data, error } = await client().rpc("place_store_cash_sale", {
    target_store: storeId,
    sale_lines: lines,
    custom_amount: customAmount,
    shipping_amount: shippingAmount,
  });
  if (error) throw new Error(hebrewError(error));
  const row = payload(data);
  if (row.ok !== true) fail(row);
  const orderNumber = Number(row.orderNumber);
  if (!Number.isInteger(orderNumber)) throw new Error("ההזמנה לא נשמרה.");
  return { orderNumber, total: Number(row.total) };
}
